# Architecture

FreeKeep is a Manifest V3 extension built with [WXT](https://wxt.dev) and TypeScript. It has no
runtime dependencies and no server: everything runs in the user's browser against
`store.steampowered.com`.

```
src/
├─ core/                  pure logic, no browser APIs (unit tested)
│  ├─ steam.ts            Steam endpoints + response parsers
│  ├─ policy.ts           owned / needs base game / skipped / eligible
│  ├─ engine.ts           detect → decide → claim → notify, state machine
│  └─ types.ts
├─ lib/                   browser adapters (storage, i18n, diagnostics, messages)
└─ entrypoints/
   ├─ background.ts       alarms, startup, commands from the popup
   ├─ popup/              status, promo list, claim feedback effects
   └─ options/            settings page
public/_locales/          en, zh_TW, zh_CN
tests/                    vitest + fixtures captured from real Steam responses
scripts/demo/             renders the README GIF from the real popup
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
| `settings` | interval, mode, DLC, notifications |
| `promos` | per-subid state (public store data + status) |
| `meta` | login state, country, timestamps, app cache |
| `runs` | last 20 run summaries |
| `runningSince` | spinner state for the popup |
| `popupSeenAt` | replays celebrations for claims made while the popup was closed |

No session ids, cookies, account ids or names are stored.

## Testing

- `tests/steam.test.ts` – parsers against trimmed real responses in `tests/fixtures/`.
- `tests/engine.test.ts` – the state machine with a fake Steam client: auto/ask modes, DLC rules,
  retries, login loss, pruning, and no re-claiming across runs.
- `tests/locales.test.ts` – every locale has the same keys and placeholders as English.
