# Firefox Add-ons (AMO) submission kit

Copy-paste material for [addons.mozilla.org](https://addons.mozilla.org/developers/). Live listing:
<https://addons.mozilla.org/firefox/addon/freekeep-for-steam-epic/> (URL slug
`freekeep-for-steam-epic`; slugs are limited to 30 characters). Build both files with
`npm run zip:firefox` (or take them from a GitHub release):

- `freekeep-for-steam-<version>-firefox.zip` – the add-on
- `freekeep-for-steam-<version>-sources.zip` – the source code AMO asks for, since the add-on is
  bundled by WXT/Vite

The add-on id `freekeep-for-steam@smaildot.github.io` (in `wxt.config.ts`) is permanent once the
first version is accepted. Never change it, or Firefox treats the add-on as a different one.

## First submission

1. **Submit a New Add-on** → *On this site* (listed on AMO, auto-updates for users).
2. Upload the `-firefox.zip`. Under compatibility tick **Firefox** only. Leave **Firefox for Android**
   unticked: it is not tested there (the manifest only states the minimum version Android would need).
3. *Do you need to submit source code?* → **Yes**, upload the `-sources.zip`.
4. Paste the reviewer notes below into *Notes to Reviewer*.
5. Fill in the listing (next section) and submit. Review time varies; the add-on can't be installed
   from AMO until it is approved.

## Listing

The listing's default language is English (`default_locale`), whatever language the AMO site is
shown in. Add 中文（台灣） afterwards from the language selector of the listing editor.

**Summary** (max 250) – AMO pre-fills `extDescription`; this longer one fits better:

```
Auto-claims Steam's limited-time free-to-keep games and DLC in the background, using the Steam login already in your browser. No password, no cookie access, no server, no data collected. Optional Epic and GOG reminders.
```

```
在背景自動領取 Steam 限時免費遊戲與 DLC，沿用瀏覽器中既有的 Steam 登入狀態。不需密碼、不讀取登入憑證、沒有伺服器、不蒐集任何資料。另可選擇開啟 Epic 與 GOG 限免提醒。
```

**Description** – AMO supports some Markdown (bold, italic, code, links, lists; no headings), so
this is the store text from `docs/store/` rewritten for Firefox. The first 250 characters say what it
does and why it's safe.

```markdown
Automatically claims limited-time free-to-keep Steam games and DLC in the background, using the Steam login already in this browser. No password, no access to your login cookie, no server, no data collected. Open source (MIT).

**Why it's safe**

- **Reuses your browser session.** Once you're signed in to the Steam store, Firefox attaches your session to requests to the store. FreeKeep only sends the same request as Steam's *Add to Account* button.
- **Can't read your credentials.** Steam's login cookie is `HttpOnly`, so no add-on can read it, and FreeKeep doesn't ask for the `cookies` permission.
- **No server.** No backend, no analytics, no tracking. Nothing is uploaded or collected.
- **Verifiable.** In `about:addons`, FreeKeep asks only for notifications and access to store.steampowered.com; optional features stay off until you turn them on. The source code is public.

**Features**

- Claims only genuine limited-time free-to-keep promotions; demos, playtests and free-to-play games are excluded
- Skips games you already own, and claims DLC only if you own the base game
- Uses your Steam store region, so it claims only what's free where you are
- Checks every 1, 3, 6, 12 or 24 hours, and when the browser starts
- Claims automatically, or asks you first
- Notifies you only when a game is claimed or needs your attention
- Handles Steam's 24-hour web login: renew it with one click, automatically (optional permission), or just get a reminder
- Pixel-art look in Steam colours, with a chest icon in colours you pick
- Optional Epic Games Store reminders: tells you about Epic's free games so you can claim them on Epic's site. Off by default; the public list is read without signing in
- Optional GOG reminders: tells you about giveaways on GOG's home page and games discounted to 0, which you claim on GOG's site. Off by default; GOG's public pages are read without signing in
- 12 languages, about 55 KB of code, no dependencies

Sign in to the Steam store in Firefox and FreeKeep runs on its own.

Not affiliated with Valve Corporation, Epic Games or GOG. Steam is a trademark of Valve Corporation.
Source code: [github.com/SmailDot/FreeKeep-for-Steam](https://github.com/SmailDot/FreeKeep-for-Steam)
```

```markdown
在背景自動領取 Steam 限時免費遊戲與 DLC，沿用瀏覽器中既有的 Steam 登入狀態。不需密碼、不讀取登入憑證、沒有伺服器、不蒐集任何資料。開放原始碼（MIT）。

**為什麼安全**

- **沿用瀏覽器登入。** 登入 Steam 商店後，Firefox 連線到商店時會自動附上登入狀態。FreeKeep 只發出與「加入帳戶」按鈕相同的請求。
- **讀不到登入憑證。** Steam 的登入 Cookie 設有 `HttpOnly`，任何附加元件都讀不到；FreeKeep 也沒有申請 `cookies` 權限。
- **沒有伺服器。** 沒有後端、沒有分析、沒有追蹤，不上傳也不蒐集任何資料。
- **可自行查證。** 在 `about:addons` 裡，FreeKeep 只要求通知與 store.steampowered.com 的存取權；選用功能在你自己開啟前都是關閉的。原始碼完整公開。

**功能**

- 只領取真正的限時免費（free to keep），不包含試玩版、Playtest 與免費遊玩遊戲
- 自動略過已擁有的遊戲；DLC 僅在擁有本體時領取
- 依你的 Steam 商店地區判斷，只領取該地區的限免
- 每 1、3、6、12 或 24 小時檢查一次，瀏覽器啟動時也會檢查
- 可自動領取，或先通知再由你決定
- 僅在領取成功或需要你處理時通知
- 處理 Steam 的 24 小時網頁登入：可選一鍵續期、自動續期（選用權限）或只提醒
- Steam 配色的像素風介面，寶箱圖示可自訂顏色
- 選用的 Epic Games Store 限免提醒：通知 Epic 的免費遊戲，由你到 Epic 網站領取。預設關閉，讀取公開清單時不需登入
- 選用的 GOG 限免提醒：通知 GOG 首頁的限時贈送與折扣到 0 元的遊戲，由你到 GOG 網站領取。預設關閉，讀取公開頁面時不需登入
- 支援 12 種語言、程式碼約 55 KB、無第三方依賴

在 Firefox 登入 Steam 商店後，FreeKeep 就會自動運作。

與 Valve Corporation、Epic Games 及 GOG 無關。Steam 是 Valve Corporation 的商標。
原始碼：[github.com/SmailDot/FreeKeep-for-Steam](https://github.com/SmailDot/FreeKeep-for-Steam)
```

**Experimental** – no. **Requires payment** – no.

**Categories** – Games & Entertainment (遊戲與娛樂); Alerts & Updates (警示與更新).

**Support email** – `smaildot@aidot.me`
**Support website** – `https://github.com/SmailDot/FreeKeep-for-Steam/issues`
**Homepage** – `https://github.com/SmailDot/FreeKeep-for-Steam`

**License** – MIT License (same as [`LICENSE`](../LICENSE)).

**Privacy policy** – tick *This add-on has a privacy policy* and paste this short version of
[`PRIVACY.md`](../PRIVACY.md):

```
FreeKeep for Steam does not collect, sell or share any personal data. It has no server, no analytics, no tracking and no ads.

- It never asks for, reads or stores your Steam password. It cannot read Steam's login cookie (Steam marks it HttpOnly and FreeKeep has no "cookies" permission), and it never stores session tokens, your account id or your account name.
- It only connects to https://store.steampowered.com, to find free promotions, check which of them your account already owns, and claim them. Firefox attaches your existing Steam login to these requests, as it does when you visit the store yourself. To claim, FreeKeep sends back the store's anti-forgery code (sessionid) exactly like the store's own "Add to Account" button; it is kept in memory for that request only. Game images load from Steam's image servers (*.steamstatic.com).
- It opens a Steam store tab only when you ask it to renew your Steam login or open a store page.
- Your settings, public data about current promotions, recent check results, your login state and your Steam store region (country code) are stored only in Firefox's extension storage on your device, and are deleted when you remove the add-on.
- Optional and off by default: "Renew automatically" asks for access to https://login.steampowered.com to renew Steam's 24-hour web login (Firefox handles the cookies; FreeKeep cannot see them). "Epic reminders" asks for access to Epic's public free-games list at store-site-backend-static-ipv4.ak.epicgames.com, and "GOG reminders" for access to GOG's public home page and catalog at sections.gog.com and catalog.gog.com; those requests are anonymous and contain only your browser language. Turning any of them off removes the permission again.
- "Copy diagnostics" copies a report with your settings and recent check results, without account data, to your clipboard. It is only shared if you paste it somewhere yourself.

Full policy: https://github.com/SmailDot/FreeKeep-for-Steam/blob/main/PRIVACY.md
Contact: smaildot@aidot.me
```

**Screenshots** – the 1280×800 PNGs from `npm run build && npm run store-assets`
(`.output/store/screenshot-<lang>-*.png`) fit AMO as they are.

## Notes to Reviewer

```
FreeKeep claims Steam's "free to keep" promotions (the same request as the store's
"Add to Account" button) using the user's existing store.steampowered.com login in this browser.
Open source, MIT: https://github.com/SmailDot/FreeKeep-for-Steam

Build from the uploaded sources (any OS; tested with Node.js 22.22 and npm 10.9 on Linux):
  npm ci
  npm run zip:firefox
The add-on is written to .output/firefox-mv3/ and zipped to
.output/freekeep-for-steam-<version>-firefox.zip; its files are identical to the uploaded package.

Network: only https://store.steampowered.com (required). Optional host permissions are requested
only when the user turns on the matching setting: login.steampowered.com (renew Steam's 24-hour
store login in the background), store-site-backend-static-ipv4.ak.epicgames.com (Epic's public
giveaway list, reminders only), and sections.gog.com + catalog.gog.com (GOG's public home page
sections and catalog, reminders only; GOG giveaways need the user's GOG token to claim, so FreeKeep
never claims on GOG). Optional requests are anonymous (credentials: 'omit'). The manifest CSP
limits connect-src to these hosts (plus data: for the locally drawn notification icon). No remote code, no eval, no analytics, no data
leaves the browser; data_collection_permissions is "none".

No cookies permission: the browser attaches the user's own Steam cookies to store requests.
FreeKeep never reads, stores or sends credentials.

public/fonts/ holds subsets of two OFL pixel fonts (licences next to them), generated by
scripts/fonts/subset.py from the full fonts in scripts/fonts/src/.

To try it: log in to store.steampowered.com in the same browser, then open the toolbar popup. Without
a Steam login the popup still lists current free promotions as "Waiting for Steam login".
```

## Updates

Upload the new `-firefox.zip` and `-sources.zip` under *Upload New Version*, with the same reviewer
notes. The version in `package.json` must be higher than the one on AMO.
