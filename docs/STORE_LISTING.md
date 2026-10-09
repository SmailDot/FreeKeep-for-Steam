# Chrome Web Store submission kit

Copy-paste material for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Upload `.output/freekeep-for-steam-<version>-chrome.zip` (from `npm run zip` or a GitHub release).

## Store listing

**Name** – from `extName` in `public/_locales/<lang>/messages.json`, so every language gets its own
store title: the brand plus what it does, e.g. `FreeKeep: Auto-Claim Free Steam Games`. Short name:
`FreeKeep`. Keep it descriptive and honest: the store's spam policy forbids keyword stuffing and
unrelated brand names.

**Summary** – from `extDescription` in the same files (max 132 characters), localized automatically.

**Category** – Productivity (or Fun).

**Description** – one file per language in [`docs/store/`](store/), ready to paste. In the dashboard,
add each language under *Store listing* and paste its file; languages without a description fall back
to English. The first lines say what it does and why it's safe, because they show
before "Read more".

| Language | File | | Language | File |
|---|---|---|---|---|
| English | [`en.txt`](store/en.txt) | | Polski | [`pl.txt`](store/pl.txt) |
| 中文（台灣） | [`zh_TW.txt`](store/zh_TW.txt) | | Português (Brasil) | [`pt_BR.txt`](store/pt_BR.txt) |
| 中文（中國） | [`zh_CN.txt`](store/zh_CN.txt) | | Русский | [`ru.txt`](store/ru.txt) |
| 日本語 | [`ja.txt`](store/ja.txt) | | Español | [`es.txt`](store/es.txt) |
| 한국어 | [`ko.txt`](store/ko.txt) | | Français | [`fr.txt`](store/fr.txt) |
| Deutsch | [`de.txt`](store/de.txt) | | Türkçe | [`tr.txt`](store/tr.txt) |

Like the UI, the non-English texts are machine-assisted; native speakers are welcome to improve them.

**Graphics** – generate them all with `npm run build && npm run store-assets` (needs Playwright);
they land in `.output/store/`, rendered from the real popup with fictional games.

| Asset | Size | Required | File |
|---|---|---|---|
| Store icon | 128×128 PNG, 96 px artwork + 16 px transparent padding | yes | `icon-128.png` |
| Screenshots | 1280×800, 24-bit PNG, 1–5 per language | yes | `screenshot-<lang>-*.png` |
| Small promo tile | 440×280, 24-bit PNG | yes | `small-tile-440x280.png` |
| Marquee promo tile | 1400×560, 24-bit PNG | no (used if featured) | `marquee-1400x560.png` |
| Promo video | YouTube URL | no | – |

Promo tiles can't be localized; screenshots can (upload `screenshot-zh_TW-*` under 中文（台灣）).
`screenshot-<lang>-3-epic.png` shows the optional Epic tab; upload it from version 0.2.0 on.

## Privacy practices tab

Answer in English; the form goes to the review team.

**Single purpose**

```
FreeKeep helps the user keep free games: it automatically claims limited-time free-to-keep promotions on the Steam store, using the Steam store login that already exists in their browser. As an optional, off-by-default extra, it can also remind the user when the Epic Games Store gives a game away (reminder only; the user claims it on Epic's site). It does nothing else.
```

**Permission justifications**

`storage`
```
Saves the user's settings and the state of each free promotion (found, claimed, already owned, failed) on the device, so the same game is never claimed twice and the popup can show the results. Nothing is synced or sent anywhere.
```

`alarms`
```
Runs the check for new free promotions in the background at the interval the user chooses (1, 3, 6, 12 or 24 hours; default 6), plus one check shortly after the browser starts.
```

`notifications`
```
Shows a system notification only when a game was claimed, a claim failed, the user needs to log in to the Steam store, or (only if the user turned on Epic reminders) a new free game starts on the Epic Games Store. Users can turn notifications off on the options page.
```

Host permissions (one field in the dashboard, max 1,000 characters; it covers the required Steam host and the optional Epic one)
```
store.steampowered.com (required): FreeKeep searches the Steam store for 100%-off promotions (/search/results, /api/appdetails), reads which games the user owns (/dynamicstore/userdata), reads the store region and anti-forgery token (sessionid) from a store page, and claims a promotion with the same request as the store's own "Add to Account" button (POST /freelicense/addfreelicense). No content scripts, tabs, scripting or cookies permissions; the HttpOnly login cookie is never read.

store-site-backend-static-ipv4.ak.epicgames.com (optional): requested only when the user turns on Epic reminders in the options page, and removed when they turn it off. Used for one anonymous GET of Epic's public free-games feed (no credentials; the only parameter is the language code). The feed sends no CORS headers, so it can't be read without this permission. No Epic account, login or user data is involved.
```

**Remote code** – *No, I am not using remote code.* All JavaScript is in the package; the popup only
loads game images from Steam's CDN (and Epic's, when Epic reminders are on).

**Data usage** – the store asks for anything the extension *handles*, even if it never leaves the
device:

| Category | Tick? | Why |
|---|---|---|
| Website content | ✅ | Reads Steam store pages/JSON, including which games the account owns, and (optional) Epic's public giveaway feed |
| Location | ✅ | Reads the Steam store region (country code) to query regional promotions |
| Authentication information | – | Never reads or stores the password or login cookie; the anti-forgery token is sent back to Steam only, as explained in the host permission justification and privacy policy |
| Everything else | – | Not handled |

Tick all three certifications (not sold, not used for unrelated purposes, not used for credit).

**Privacy policy URL** – `https://github.com/SmailDot/FreeKeep-for-Steam/blob/main/PRIVACY.md`

**Support** – email `smaildot@aidot.me`, site `https://github.com/SmailDot/FreeKeep-for-Steam/issues`

## Updating the listing for 0.2.x (Epic reminders, new store titles)

If an older version is still in review, cancel that review first, then in one submission:

1. **Privacy practices** – replace *Single purpose*, the `notifications` justification and the
   host permission justification with the texts above. Data usage answers stay the same.
2. **Store listing** – paste the descriptions from `docs/store/` (add the other languages too), and
   add `screenshot-en-3-epic.png` (English) and
   `screenshot-zh_TW-3-epic.png` (中文（台灣）).
3. **Privacy policy** – merge to `main` first, so the URL above already describes Epic reminders.

The optional permission doesn't trigger a permission warning on update, since it is only requested
when the user turns the feature on.

## Before each release

1. Bump `version` in `package.json`.
2. `npm test && npm run compile && npm run zip`.
3. Tag `vX.Y.Z` and push: the release workflow attaches the zip to a GitHub release.
4. Upload the same zip to the dashboard.
