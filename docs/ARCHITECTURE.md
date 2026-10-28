# Architecture

FreeKeep is a Manifest V3 extension built with [WXT](https://wxt.dev) and TypeScript. It has no
runtime dependencies and no server: everything runs in the user's browser against
`store.steampowered.com`, plus Epic's public giveaway list and GOG's public home page and catalog
when the user turns on the optional [Epic](#epic-games-store-reminders-optional) or
[GOG reminders](#gog-reminders-optional), and Steam's login renewal when the user picks
[automatic renewal](#steam-login-renewal).

```
src/
├─ core/                  pure logic, no browser APIs (unit tested)
│  ├─ steam.ts            Steam endpoints + response parsers
│  ├─ epic.ts             Epic giveaway feed parser (reminders only)
│  ├─ gog.ts              GOG giveaway and 100%-off parsers (reminders only)
│  ├─ policy.ts           owned / needs base game / skipped / eligible
│  ├─ engine.ts           detect → decide → claim → notify, state machine
│  └─ types.ts
├─ lib/                   browser adapters (storage, i18n, diagnostics, messages)
└─ entrypoints/
   ├─ background.ts       alarms, startup, commands from the popup
   ├─ popup/              status, promo list, claim feedback effects
   └─ options/            settings page
public/_locales/          12 languages, English is the reference
tests/                    vitest + fixtures captured from real Steam, Epic and GOG responses
scripts/demo/             renders the README GIF and store images from the real popup
```

## Steam endpoints

All requests go to `https://store.steampowered.com`. The browser attaches the user's existing
login cookies only where FreeKeep asks for `credentials: 'include'`.

| Purpose | Request | Login |
|---|---|---|
| Login state, CSRF `sessionid`, store country | `GET /?l=english` → `g_AccountID` (or `data-userinfo`), `g_sessionID`, `data-config` `COUNTRY`; loaded twice when logged out, see below | yes |
| Candidate promotions | `GET /search/results/?specials=1&maxprice=free&json=1&count=100&cc=XX` | no |
| Packages of an app | `GET /api/appdetails?appids=N&cc=XX&l=english` | no |
| Promotion deadline | `GET /app/N/?l=english` → "Free to keep when you get it before …" | yes (age gate) |
| Library | `GET /dynamicstore/userdata/` → `rgOwnedApps`, `rgOwnedPackages` | yes |
| Claim | `POST /freelicense/addfreelicense/<subid>` body `ajax=true&sessionid=…` | yes |

Notes from the proof of concept (October 2026):

- The search JSON has no app ids; they are parsed from the capsule URL (`/apps/<id>/`).
- `appdetails` without `cc` returns CDN-cached data from an arbitrary region, so `cc` is always set
  to the country read from the store page.
- During a promotion `price_overview.final` is **not** 0 and `is_free` may be `true`; neither is a
  reliable signal. The reliable one is a package with `is_free_license: true`,
  `price_in_cents_with_discount: 0` and an `option_text` containing
  `Limited Free Promotional Package`. Its `packageid` is the subid to claim.
- The claim endpoint is what Steam's own `AddFreeLicense()` calls. Responses:
  - `200` with `[]` → claimed (verified on a fresh account)
  - `500` `{"purchaseresultdetail":9}` → already owned
  - `500` `{"purchaseresultdetail":24}` → base game required
  - `401` → not logged in; `404` → bad `sessionid`
- When the store page says logged out, FreeKeep loads it once more and compares the two
  `g_sessionID` values. Steam echoes the `sessionid` cookie into the page, so the values match only
  if the browser attached Steam's cookies. The result (`cookiesSent`) goes into the diagnostics'
  `lastCheck`, together with the status, final path and the login signals; no ids are stored.
- Steam cookies are `SameSite=None`, so the service worker's `fetch` carries the login. Origin is
  not checked: a POST from the service worker behaves exactly like one from a store tab. No tabs,
  content scripts or `cookies` permission are needed.

## Steam login renewal

`steamLoginSecure` (store login, HttpOnly) is a JWT valid for 24 hours. The long-lived refresh token
(`steamRefresh_steam`, about 200 days) lives on `login.steampowered.com`. When a browser navigates to
the store with a lapsed login, Steam sends it through `login.steampowered.com/jwt/refresh?redir=…`,
which issues a new store login and redirects back; the store's `auth_refresh.js` also renews open
pages before the token expires. The service worker's `fetch` of the store page does neither, so
without a visit the store reports the user as logged out after a day (`cookiesSent: true`, no
`g_AccountID`).

`meta.login` separates the two logged-out cases: `expired` (seen logged in before, so a renewal
should help; older versions are covered by `decidedAt`, which is only set while logged in) and
`logged_out` (never seen logged in, or the last renewal didn't help). The user picks the handling
in `settings.renew`:

| `renew` | Trigger | How | Permission |
|---|---|---|---|
| `tab` (default) | Notification click or **Renew now** | `tabs.create({ active: false })` on the store, wait for `status: 'complete'` on a store URL (max 25 s), close it, then `runCheck(…, 'renew', 'tab')` | none (store URLs are visible through the store host permission) |
| `auto` | Any session check that finds the user logged out, with cookies sent | `GET https://login.steampowered.com/jwt/refresh?redir=https://store.steampowered.com/?l=english` with credentials, then a normal session check | optional `login.steampowered.com` |
| `remind` | – | Notification only; a click opens the store as a normal tab and checks once it loads | none |

Automatic renewal falls back to the one-click notification when the permission is missing or the
request fails. The response is the store page (verified in Chromium: `redirected: true`, final URL
the store, passes the CSP); Set-Cookie headers are handled by the browser and are not readable by
the extension. `meta.renewal` keeps `{ at, method, result }` for the popup and diagnostics. The
popup also starts a check when opened while logged out (at most once a minute), so a renewal or a
login done in a normal tab shows up right away.

## Epic Games Store reminders (optional)

Epic can't be claimed with a single request: getting a game goes through Epic's checkout page.
Automating that would mean scripting Epic's site or handling the user's Epic login, so FreeKeep
only **reminds**. The feature is off by default.

| Purpose | Request | Login |
|---|---|---|
| Current and upcoming giveaways | `GET https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=<ui>` | no, `credentials: 'omit'` |

- The feed sends no CORS headers, so reading it needs host access. It is declared under
  `optional_host_permissions` and requested with `permissions.request()` when the user ticks the
  option; unticking calls `permissions.remove()`. Without the permission the check records
  `no_permission` and the popup links to the settings.
- `permissions.remove()` takes the host out of the active permissions (`contains()` is false and
  requests to Epic fail), but Chrome keeps the user's approval: `chrome://extensions` still lists
  the site and a later `request()` is granted without a prompt. Diagnostics report the real state
  as `epicAccess`.
- `locale` is the browser's UI language mapped to an Epic store locale (`zh-TW` → `zh-Hant`,
  `es-419` → `es-MX`, unknown → `en-US`). Only titles change with it; ids, links, dates and images
  are identical in every locale (checked October 2026).
- No country is sent. The feed is the same for everyone; regional exceptions are rare and the
  store page has the final word.
- A giveaway is an element with a promotional offer at `discountPercentage: 0`. Both the current
  and the upcoming groups are checked against the date, because right after the weekly switch the
  cached feed can still list this week's games as upcoming. Items Epic lists twice during the
  changeover are merged by id and title.
- Store links use the `productHome` page mapping, then `offerMappings`, then `productSlug`
  (cut at the first `/`, since some end in `/home`). Bundles use `/bundle/`. Without any slug the
  link falls back to `https://store.epicgames.com/free-games`.
- Key art can be a multi-megabyte PNG; images on `*.epicgames.com` get
  `?resize=1&w=360&quality=medium` (a ~15 KB JPEG).

The Epic check runs at the end of every `runCheck`, after the Steam work is saved, so an Epic
failure never affects Steam. Each giveaway goes `new → notified` (one notification per batch of
new games) `→ opened` (user clicked *Get on Epic*) or `hidden` (user dismissed it). Entries are
forgotten a day after they end or after 14 days unseen. The run summary's `epic` field holds the
number of live giveaways, `no_permission` or `error`.

## GOG reminders (optional)

GOG can't be claimed with a single request either: its home page giveaway button posts with the
user's GOG access token (`POST https://www.gog.com/giveaway/claim`, `Authorization: Bearer …`;
without it GOG answers 401/403), and a game at 100% off goes through GOG's checkout. So, like Epic,
FreeKeep only **reminds**, and the feature is off by default.

| Purpose | Request | Login |
|---|---|---|
| Is a giveaway running? | `GET https://sections.gog.com/v1/pages/2f?locale=<ui>` | no, `credentials: 'omit'` |
| The giveaway's product and end date | `GET https://sections.gog.com/v1/pages/2f/sections/<id>?locale=<ui>` | no |
| Games discounted to 0 | `GET https://catalog.gog.com/v1/catalog?price=between:0,0&discounted=eq:true&productType=in:game,pack,dlc&…&locale=<ui>` | no |

- Page `2f` is GOG's home page in its section service, the same list the site renders. A giveaway
  is a section of type `GIVEAWAY_SECTION`; its details hold `properties.product.{title, slug,
  coverHorizontal}` and `properties.endDate`, the fields GOG's own giveaway banner reads (from its
  front-end code, October 2026; no giveaway was running then, so the tests build that response from
  those fields). If the details can't be read, the giveaway is still reported as "GOG giveaway"
  with a link to the home page, so a format change can't hide it. A section whose end date has
  passed is dropped.
- The catalog query also returns permanently free games (demos, free-to-play); only products whose
  base price is above 0 and final price is 0 count, i.e. a real 100% discount. These have no end
  date in the catalog, so the popup shows how to claim instead ("Add to cart, check out for free").
- A game listed both ways is shown once, as the giveaway. If one source fails the other is still
  used; only both failing records `error`.
- Both hosts allow CORS only for `www.gog.com`, so reading them needs host access:
  `sections.gog.com` and `catalog.gog.com` are requested together when the user ticks the option and
  removed when they untick it. `locale` is the UI language mapped to GOG's store languages
  (`en-US`, `de-DE`, `fr-FR`, `pl-PL`, `ru-RU`, `zh-Hans`); no country or currency is sent.
- Covers are `images.gog-statics.com/<hash>.png`; the popup asks for the `_giveaway_381x223.jpg`
  size GOG's banner uses (~40 KB).
- Links: a giveaway opens the home page (the claim button is its banner); a deal opens the
  product page from the catalog's `storeLink`, accepted only on `www.gog.com`.

The same reminder code runs Epic and GOG (`checkReminders` in `engine.ts`), each with its own
storage key, settings flag and run summary field (`gog`). Offers without an end date are kept for
14 days after they were last seen, so a deal that briefly drops out of the catalog isn't announced
twice; the popup lists the ones the last successful GOG check saw. A notification for a single
GOG offer opens it directly, one for several opens the home page.

## Content Security Policy

The manifest declares a CSP for all extension pages and the service worker, so the browser enforces
what the code promises:

| Directive | Value | Effect |
|---|---|---|
| `connect-src` | `data:`, Steam store, `login.steampowered.com`, Epic feed host, `sections.gog.com`, `catalog.gog.com` | Any other `fetch` is refused, even from tampered code; the renewal redirect may only pass through these hosts. `data:` reaches no server: Chrome loads the notification icon (the chest in the user's colours, drawn locally as a `data:` URL) through `connect-src` |
| `img-src` | `'self'`, `data:`, `*.steamstatic.com`, `*.epicgames.com`, `*.unrealengine.com`, `images.gog-statics.com` | Game images only from the stores' CDNs (`data:` is the notification icon) |
| `default-src` / `style-src` | `'self'` | No inline or remote script or stylesheet |
| `object-src`, `base-uri`, `form-action`, `frame-ancestors` | `'none'` | No plugins, base tag tricks, form posts or framing |

If Steam or Epic move their image CDN to a new domain, images show the placeholder until `img-src`
is updated; nothing else is affected. Verified in Chromium: Steam and Epic requests pass, a request
to another host is refused, and an injected inline script does not run.

## Firefox

The same code builds for Firefox (`npm run build:firefox`, Manifest V3). Differences:

- `browser_specific_settings.gecko` carries the permanent add-on id
  `freekeep-for-steam@smaildot.github.io` and declares that no data is collected
  (`data_collection_permissions: none`), which needs Firefox 140 on desktop (142 on Android, not
  tested). The Chrome build has no such key.
- The background runs as an event page instead of a service worker; alarms wake it the same way.
- Firefox grants `store.steampowered.com` at install, but users can turn it off on the add-on's page
  in `about:addons` (Chrome's site access menu can withhold it too). Each run first checks the
  permission and stops with `no_store_access`; the popup then offers **Allow access**, and the
  background checks again as soon as the permission is back.
- Steam cookies reach the extension's `fetch` (verified: an extension request and a store tab get
  the same `sessionid`), so Total Cookie Protection doesn't get in the way.
- Firefox only lets `permissions.request` run inside a real click; the options page calls it first in
  the click handler, as Chrome needs too. A script-made click is refused, a real one works.
- The UI uses no `innerHTML`; icons are built as SVG elements, so `addons-linter` reports nothing.
  CI lints every build with it.

Verified in Firefox 157: store access and cookies, a full check, toolbar icon and notifications, the
one-click renewal tab, automatic renewal and Epic reminders behind real permission prompts, and
turning the store access off and on again.

## Engine

Each run (`runCheck`) is serialized with every other engine operation, so alarms, the startup
check and popup actions never overlap.

1. **Session** – refreshed when the country is unknown, once a day, on manual runs, while logged
   out, or when claiming. With automatic renewal, a lapsed login is renewed here.
2. **Detect** – one search request; `appdetails` only for apps not seen in the last 12 h.
   New promotions also fetch their deadline text.
3. **Decide** – when something is new, on manual runs, or once a day. Needs login; if logged out,
   ownership is unknown and promotions stay pending.
4. **Claim** – auto mode only. One at a time with a 2.5 s gap. Results map to statuses below.
5. **Notify** – one notification per batch of claims, failures, new promotions (ask mode) or a
   needed login (once per logged-out period). The login notification's id prefix
   (`freekeep-renew-`, `freekeep-store-`, `freekeep-login-`) tells the background what a click does.
6. **Prune** – forget promotions not seen for 3 days (claimed ones after 30 days).

```
            ┌──────────── decide ────────────┐
 new ──► pending ──claim──► claimed           │
            │  │                              ▼
            │  ├─ code 9 ─► owned        needs_base ◄─ DLC without base game
            │  ├─ code 24 ─► needs_base       │ (re-evaluated daily)
            │  ├─ error ×3 ─► failed ──user retry──► pending
            │  └─ user skip ─► skipped (sticky)
            └─ policy ─► skipped (DLC disabled / not a game)
```

`claimed`, `owned` and `failed` are final for automatic runs; only the user can retry a failed one.
This is what prevents re-claiming loops.

## Scheduling

- A periodic `chrome.alarms` alarm with the user's interval (1–24 h, default 6 h).
- A one-off alarm about a minute after browser start or install.
- Chrome fires missed alarms once after the device wakes, so sleeping laptops catch up.
- The service worker is idle between checks; a run takes a few seconds.

## Interface

- **Look**: Steam colours with pixel-style frames, buttons and icons. Two pixel fonts are bundled
  (`public/fonts/`, OFL 1.1) and only used at 12 px and 24 px, the sizes their 12 px grid renders
  crisply at; long text uses the system font. Cubic 11 covers Chinese, Japanese and Latin; Cyrillic
  and Greek are routed to Galmuri11 with `unicode-range` because Cubic's are full-width.
- **Font subsets**: `npm run fonts` cuts both fonts down to the interface's characters plus Latin
  and Cyrillic (about 66 KB instead of 880 KB; the popup's fonts are ready in about 45 ms instead
  of 130 ms in Chromium). Text the subsets can't draw, such as a localized Epic title, gets the
  `nopx` class and is shown entirely in the system font. `tests/fonts.test.ts` checks that every
  interface string is covered.
- **Icon**: `src/lib/chest.ts` draws the chest on a 16-cell grid, so it is exact at 16, 32, 48 and
  96 px. Users pick body and lock colours; outline, highlight and the sparkle (opposite hue, or
  Steam green for greys) are derived. The background redraws the toolbar icon with
  `action.setIcon({ imageData })` from an `OffscreenCanvas` when the colours change and whenever the
  worker starts, and uses a PNG data URL of it for notifications. The packaged icons in
  `public/icon/` are rendered from `docs/assets/icon.svg` (the default colours) by `npm run icons`.
- **Options page**: one scrolling page with a sidebar that works as a table of contents; an
  `IntersectionObserver` highlights the section in view. The connections list reads
  `permissions.contains` live and updates on `permissions.onAdded` / `onRemoved`.

## Storage (`chrome.storage.local`)

| Key | Content |
|---|---|
| `settings` | interval, mode, login renewal, DLC, notifications, Epic and GOG reminders, chest colours |
| `promos` | per-subid state (public store data + status) |
| `epic` | per-offer Epic giveaway state (public feed data + status), only with Epic reminders on |
| `gog` | the same for GOG giveaways and 100%-off games, only with GOG reminders on |
| `meta` | login state, last login and renewal times, country, timestamps, app cache, games claimed so far |
| `runs` | last 20 run summaries |
| `runningSince` | spinner state for the popup |
| `popupSeenAt` | replays celebrations for claims made while the popup was closed |

No session ids, cookies, account ids or names are stored.

## Testing

- `tests/steam.test.ts` – parsers against trimmed real responses in `tests/fixtures/`.
- `tests/engine.test.ts` – the state machine with a fake Steam client: auto/ask modes, DLC rules,
  retries, login loss, the three renewal modes, pruning, and no re-claiming across runs; Epic
  and GOG reminders with fake feeds.
- `tests/epic.test.ts` – the Epic parser against a trimmed real feed, plus changeover, bundle,
  missing slug and image edge cases.
- `tests/gog.test.ts` – the GOG parsers against real home page and catalog responses, a giveaway
  built from the fields GOG's banner reads, unreadable details, permanently free games, foreign
  links, and one source failing.
- `tests/locales.test.ts` – every locale has the same keys and placeholders as English.
