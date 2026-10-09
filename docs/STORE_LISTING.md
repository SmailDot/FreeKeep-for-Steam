# Chrome Web Store submission kit

Copy-paste material for the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
Upload `.output/freekeep-for-steam-<version>-chrome.zip` (from `npm run zip` or a GitHub release).

## Store listing

**Name / short name** – from the manifest: `FreeKeep for Steam` / `FreeKeep`.

**Summary** – from `extDescription` in `public/_locales/*/messages.json` (localized automatically).

**Category** – Productivity (or Fun).

**Description (en)**

```
FreeKeep claims Steam's limited-time free-to-keep games for you, in the background, using the Steam login your browser already has.

🔒 Your credentials never leave your computer: FreeKeep never asks for or stores your password, tokens or cookies, and it can't even read your login cookie. It runs 100% locally, with no server and no data collection.

• Only real free-to-keep promotions: never demos, playtests or free-to-play games
• Skips games you own; claims DLC only when you own the base game
• No password, no tabs, no server: it only talks to store.steampowered.com
• Check every 1–24 hours, plus once when the browser starts
• Claim automatically, or get notified and decide yourself
• One quiet notification when something is claimed or needs you
• Optional Epic Games Store reminders: get told when Epic gives a game away, then claim it on Epic's site. Off by default; it reads Epic's public list anonymously, with no Epic login
• Tiny: about 40 KB of code, zero dependencies, open source

Log in to the Steam store in this browser and FreeKeep does the rest.

Not affiliated with Valve. Steam is a trademark of Valve Corporation.
Source code: https://github.com/SmailDot/FreeKeep-for-Steam
```

**Description (zh_TW)**

```
FreeKeep 會在背景用你瀏覽器裡現有的 Steam 登入，自動幫你領取 Steam 限時免費遊戲。

🔒 你的帳號憑證永遠不會離開你的電腦：FreeKeep 從不要求或儲存你的密碼、Token 或 Cookie，而且根本讀不到你的登入 Cookie。全程在本機執行，沒有伺服器，也不蒐集任何資料。

• 只領真正的限時免費，不會亂領試玩版、Playtest 或免費遊玩遊戲
• 已擁有的會跳過；DLC 只在你擁有本體時才領
• 不用密碼、不開分頁、不需伺服器：只連線到 store.steampowered.com
• 每 1–24 小時檢查一次，瀏覽器啟動時也會檢查
• 可自動領取，或先通知你再決定
• 只在領到遊戲或需要你處理時安靜地通知一次
• 選用的 Epic Games Store 限免提醒：Epic 送遊戲時提醒你，再到 Epic 網站自己領。預設關閉，以匿名方式讀取 Epic 公開清單，不需登入 Epic
• 輕巧：程式碼約 40 KB、零依賴、開放原始碼

在這個瀏覽器登入 Steam 商店，剩下的交給 FreeKeep。

與 Valve 無關。Steam 是 Valve Corporation 的商標。
原始碼：https://github.com/SmailDot/FreeKeep-for-Steam
```

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

Host permissions (one field in the dashboard; it covers the required Steam host and the optional Epic one)
```
https://store.steampowered.com/* (required): the single purpose requires talking to the Steam store. FreeKeep searches the store for 100%-off promotions (/search/results, /api/appdetails), reads which games the user already owns (/dynamicstore/userdata), reads the store region and the store's anti-forgery token (sessionid) from a store page, and claims a promotion with the same request the store's own "Add to Account" button sends (POST /freelicense/addfreelicense). It uses no content scripts, tabs, scripting or cookies permissions; the login cookie is HttpOnly and never read.

https://store-site-backend-static-ipv4.ak.epicgames.com/* (optional, declared in optional_host_permissions): requested with permissions.request() only when the user turns on Epic Games Store reminders in the options page, and removed when they turn it off. FreeKeep uses it for one anonymous GET of Epic's public free-games feed (/freeGamesPromotions), with credentials omitted. The feed sends no CORS headers, so the extension cannot read it without this permission. No Epic account, login or cookies are involved, and nothing is ever sent to Epic.
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

## Updating the listing for 0.2.0 (Epic reminders)

Upload 0.2.0 only after 0.1.0 has been approved. Then, in the same submission:

1. **Privacy practices** – replace *Single purpose*, the `notifications` justification and the
   host permission justification with the texts above. Data usage answers stay the same.
2. **Store listing** – replace both descriptions, and add `screenshot-en-3-epic.png` (English) and
   `screenshot-zh_TW-3-epic.png` (中文（台灣）).
3. **Privacy policy** – merge to `main` first, so the URL above already describes Epic reminders.

The optional permission doesn't trigger a permission warning on update, since it is only requested
when the user turns the feature on.

## Before each release

1. Bump `version` in `package.json`.
2. `npm test && npm run compile && npm run zip`.
3. Tag `vX.Y.Z` and push: the release workflow attaches the zip to a GitHub release.
4. Upload the same zip to the dashboard.
