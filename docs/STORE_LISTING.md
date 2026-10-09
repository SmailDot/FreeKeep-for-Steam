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

🔒 Your credentials never leave your computer: FreeKeep never asks for, reads or stores your password, tokens or cookies. It runs 100% locally, with no server and no data collection.

• Only real free-to-keep promotions: never demos, playtests or free-to-play games
• Skips games you own; claims DLC only when you own the base game
• No password, no tabs, no server: it only talks to store.steampowered.com
• Check every 1–24 hours, plus once when the browser starts
• Claim automatically, or get notified and decide yourself
• One quiet notification when something is claimed or needs you
• Tiny: about 35 KB of code, zero dependencies, open source

Log in to the Steam store in this browser and FreeKeep does the rest.

Not affiliated with Valve. Steam is a trademark of Valve Corporation.
Source code: https://github.com/SmailDot/FreeKeep-for-Steam
```

**Description (zh_TW)**

```
FreeKeep 會在背景用你瀏覽器裡現有的 Steam 登入，自動幫你領取 Steam 限時免費遊戲。

🔒 你的帳號憑證永遠不會離開你的電腦：FreeKeep 從不要求、讀取或儲存你的密碼、Token 或 Cookie。全程在本機執行，沒有伺服器，也不蒐集任何資料。

• 只領真正的限時免費，不會亂領試玩版、Playtest 或免費遊玩遊戲
• 已擁有的會跳過；DLC 只在你擁有本體時才領
• 不用密碼、不開分頁、不需伺服器：只連線到 store.steampowered.com
• 每 1–24 小時檢查一次，瀏覽器啟動時也會檢查
• 可自動領取，或先通知你再決定
• 只在領到遊戲或需要你處理時安靜地通知一次
• 輕巧：程式碼約 35 KB、零依賴、開放原始碼

在這個瀏覽器登入 Steam 商店，剩下的交給 FreeKeep。

與 Valve 無關。Steam 是 Valve Corporation 的商標。
原始碼：https://github.com/SmailDot/FreeKeep-for-Steam
```

**Graphics**

| Asset | Size | Source |
|---|---|---|
| Icon | 128×128 | `public/icon/128.png` |
| Screenshots (1–5) | 1280×800 | frames from `docs/assets/demo-*.mp4`, or real popup screenshots |
| Small promo tile | 440×280 | optional |

## Privacy practices tab

**Single purpose**

```
Automatically claims limited-time free-to-keep games on the Steam store for the signed-in user.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings and which free promotions were already handled, locally, so the same game is never claimed twice. |
| `alarms` | Runs the periodic check for new free promotions at the interval the user chose (1–24 hours). |
| `notifications` | Tells the user when a game was claimed, when a claim failed, or when they need to log in to Steam. |
| Host `https://store.steampowered.com/*` | The only site FreeKeep talks to: it searches the Steam store for free-to-keep promotions, reads which games the user already owns, and claims promotions with the same request as the store's "Add to Account" button. |

**Remote code** – No, all code is packaged in the extension.

**Data usage** – check none of the data types. Certify that data is not sold, not used for
unrelated purposes, and not used for creditworthiness.

**Privacy policy URL** – `https://github.com/SmailDot/FreeKeep-for-Steam/blob/main/PRIVACY.md`

**Support** – email `smaildot@aidot.me`, site `https://github.com/SmailDot/FreeKeep-for-Steam/issues`

## Before each release

1. Bump `version` in `package.json`.
2. `npm test && npm run compile && npm run zip`.
3. Tag `vX.Y.Z` and push: the release workflow attaches the zip to a GitHub release.
4. Upload the same zip to the dashboard.
