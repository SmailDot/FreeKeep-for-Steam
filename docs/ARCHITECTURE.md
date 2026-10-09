# Architecture

FreeKeep is a Manifest V3 extension built with [WXT](https://wxt.dev) and TypeScript. It has no
runtime dependencies and no server: everything runs in the user's browser against
`store.steampowered.com`, plus Epic's public giveaway list when the user turns on the optional
[Epic reminders](#epic-games-store-reminders-optional).

```
src/
├─ core/                  pure logic, no browser APIs (unit tested)
│  ├─ steam.ts            Steam endpoints + response parsers
│  ├─ epic.ts             Epic giveaway feed parser (reminders only)
│  ├─ policy.ts           owned / needs base game / skipped / eligible
│  ├─ engine.ts           detect → decide → claim → notify, state machine
│  └─ types.ts
├─ lib/                   browser adapters (storage, i18n, diagnostics, messages)
└─ entrypoints/
   ├─ background.ts       alarms, startup, commands from the popup
   ├─ popup/              status, promo list, claim feedback effects
   └─ options/            settings page
public/_locales/          12 languages, English is the reference
tests/                    vitest + fixtures captured from real Steam and Epic responses
scripts/demo/             renders the README GIF and store images from the real popup
```

## Steam endpoints

All requests go to `https://store.steampowered.com`. The browser attaches the user's existing
login cookies only where FreeKeep asks for `credentials: 'include'`.

| Purpose | Request | Login |
|---|---|---|
| Login state, CSRF `sessionid`, store country | `GET /?l=english` → `g_AccountID`, `g_sessionID`, `data-config` `COUNTRY` | yes |
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
- Steam cookies are `SameSite=None`, so the service worker's `fetch` carries the login. Origin is
  not checked: a POST from the service worker behaves exactly like one from a store tab. No tabs,
  content scripts or `cookies` permission are needed.

## Epic Games Store reminders (optional)

Epic can't be claimed with a single request: getting a game goes through Epic's checkout page.
Automating that would mean scripting Epic's site or handling the user's Epic login, so FreeKeep
only **reminds**. The feature is off by default.

| Purpose | Request | Login |
|---|---|---|
| Current and upcoming giveaways | `GET https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US` | no, `credentials: 'omit'` |

- The feed sends no CORS headers, so reading it needs host access. It is declared under
  `optional_host_permissions` and requested with `permissions.request()` when the user ticks the
  option; unticking calls `permissions.remove()`. Without the permission the check records
  `no_permission` and the popup links to the settings.
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

## Engine

Each run (`runCheck`) is serialized with every other engine operation, so alarms, the startup
check and popup actions never overlap.

1. **Session** – refreshed only when the country is unknown, once a day, or when claiming.
2. **Detect** – one search request; `appdetails` only for apps not seen in the last 12 h.
   New promotions also fetch their deadline text.
3. **Decide** – when something is new, on manual runs, or once a day. Needs login; if logged out,
   ownership is unknown and promotions stay pending.
4. **Claim** – auto mode only. One at a time with a 2.5 s gap. Results map to statuses below.
5. **Notify** – one notification per batch of claims, failures, new promotions (ask mode) or a
   needed login (once per logged-out period).
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

## Storage (`chrome.storage.local`)

| Key | Content |
|---|---|
| `settings` | interval, mode, DLC, notifications, Epic reminders |
| `promos` | per-subid state (public store data + status) |
| `epic` | per-offer Epic giveaway state (public feed data + status), only with Epic reminders on |
| `meta` | login state, country, timestamps, app cache |
| `runs` | last 20 run summaries |
| `runningSince` | spinner state for the popup |
| `popupSeenAt` | replays celebrations for claims made while the popup was closed |

No session ids, cookies, account ids or names are stored.

## Testing

- `tests/steam.test.ts` – parsers against trimmed real responses in `tests/fixtures/`.
- `tests/engine.test.ts` – the state machine with a fake Steam client: auto/ask modes, DLC rules,
  retries, login loss, pruning, and no re-claiming across runs; Epic reminders with a fake feed.
- `tests/epic.test.ts` – the Epic parser against a trimmed real feed, plus changeover, bundle,
  missing slug and image edge cases.
- `tests/locales.test.ts` – every locale has the same keys and placeholders as English.
