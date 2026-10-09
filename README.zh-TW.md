<div align="center">

<img src="docs/assets/icon-512.png" width="96" alt="FreeKeep 圖示" />

# FreeKeep for Steam

**自動領取 Steam 限免遊戲，不用把密碼交給任何人。**
一個很小的瀏覽器擴充功能，在背景自動幫你領取 Steam 限時免費遊戲，也能選擇開啟 Epic 限免提醒。

🔒 **不要密碼、碰不到 Cookie、沒有伺服器。你的登入永遠留在你的瀏覽器裡。**

[English](README.md) · [為什麼安全](#-為什麼安全白話版) · [安裝](#安裝) · [運作原理](#運作原理) · [隱私權](PRIVACY.md)

![FreeKeep 示範](docs/assets/demo-zh_TW.gif)

</div>

## 🔒 為什麼安全（白話版）

會跟你要密碼或 Cookie 的自動領取工具本身就是風險，所以 FreeKeep 從設計上就不需要它們：

1. **你的瀏覽器本來就記得你登入了 Steam。** 只要有東西向 `store.steampowered.com` 要資料，
   瀏覽器就會自己帶上登入狀態，跟你平常逛商店一樣。FreeKeep 只是請瀏覽器送出一個
   和 Steam「加入帳戶」按鈕一模一樣的請求。
2. **FreeKeep 看不到你的登入。** Steam 把登入狀態放在一個上鎖的 Cookie（`HttpOnly`）裡，
   任何腳本或擴充功能都讀不到；FreeKeep 甚至連讀 Cookie 的權限都沒有。
3. **沒有 FreeKeep 伺服器。** 什麼都不會上傳，自然也沒有東西可以外洩。
4. **30 秒自己驗證。** 打開 `chrome://extensions` → FreeKeep 的「詳細資料」，上面只列出通知權限和
   `store.steampowered.com`（開啟 Epic 提醒時再加上 Epic 的公開清單）。[程式碼](src/)完全開源，短到一次就能讀完。

### 跟一般自動領取工具比較

| | 一般的機器人、腳本與擴充功能 | FreeKeep |
|---|---|---|
| 要你的密碼、Token 或 Cookie | 常常要 | **從不** |
| 怎麼領取 | 開商店分頁幫你點，或在伺服器上登入 | **背景送出一個請求，不開分頁** |
| 在哪裡執行 | 常是機器人、伺服器或常駐主機 | **你自己的瀏覽器** |
| 你的 Steam 登入 | 常被複製到它們的設定裡 | **留在你的瀏覽器，完全不碰** |
| 連線對象 | 常是它們的伺服器、Discord 或第三方 API | **只有 `store.steampowered.com`**¹ |
| 蒐集資料 | 不一定 | **完全不蒐集，沒有伺服器、沒有分析** |
| 可否審查 | 不一定 | **程式碼約 40 KB，完全開源** |

¹ 只有在你開啟選用的 [Epic 限免提醒](#epic-games-store-限免提醒)時，才會另外讀取 Epic 公開的限免清單，
而且那個請求不帶任何登入狀態或 Cookie。

詳見[隱私權政策](PRIVACY.md)與[架構說明](docs/ARCHITECTURE.md)。

## 功能

- **自動領取限免遊戲**：只領真正的限時免費（Steam 官方的「Limited Free Promotional Package」），
  不會亂領試玩版、Playtest 或免費遊玩遊戲
- **零憑證、100% 本機執行**：不要密碼、不要 Token、沒有伺服器；除了 `store.steampowered.com`，
  不會開任何分頁、點任何按鈕，也不會把資料送到其他地方
- **認得你的收藏庫**：已擁有的會跳過；DLC 只有在你擁有本體時才領（否則 Steam 也會拒絕）
- **預設很安靜**：只有領到東西、或需要你處理時才通知一次
- **自訂頻率**：每 1 / 3 / 6 / 12 / 24 小時檢查一次，瀏覽器啟動時也會檢查；電腦睡眠錯過的檢查會在醒來後補跑
- **自動或詢問**：可以立即自動領，或先通知你再自己決定
- **選用的 Epic Games Store 限免提醒**：Epic 送遊戲時提醒你，附上連結讓你自己去領；預設關閉，
  [詳見下方](#epic-games-store-限免提醒)
- **輕巧、可審查**：程式碼約 40 KB、零執行期依賴、TypeScript、有完整單元測試
- **12 種語言**：English、繁體中文、简体中文、Русский、Español、Português、Deutsch、日本語、Français、
  Polski、한국어、Türkçe，[歡迎協助翻譯](CONTRIBUTING.md#translations)

## 安裝

| 瀏覽器 | 方式 |
|---|---|
| Chrome、Edge、Brave、Opera | Chrome 線上應用程式商店（即將上架） |
| 任何 Chromium 瀏覽器（手動） | 到 [Releases](../../releases) 下載 `freekeep-for-steam-*-chrome.zip` → 解壓縮 → 開啟 `chrome://extensions` → 開啟「開發人員模式」→「載入未封裝項目」→ 選擇資料夾 |

接著在同一個瀏覽器登入 [Steam 商店](https://store.steampowered.com/)，就完成了。

> 手動安裝不會自動更新。Steam 偶爾會改網站，請留意 Releases，或等商店版上架後改用商店版。

## 運作原理

```
每 N 小時（以及瀏覽器啟動時）
  └─ 搜尋商店裡 100% 折扣的項目                    GET /search/results?maxprice=free&specials=1
      └─ 新的 app？讀取它的 package                 GET /api/appdetails
          └─ 只留下「Limited Free Promotional Package」
              └─ 跟你的收藏庫比對                    GET /dynamicstore/userdata
                  └─ 一個一個領取                     POST /freelicense/addfreelicense/<subid>
```

最後那個請求，就是 Steam 商店頁「加入帳戶」按鈕送出的同一個請求。Steam 會回傳 FreeKeep 看得懂的結果碼
（`9` 已擁有、`24` 需要本體）。失敗會重試最多三次。細節請看 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

### Epic Games Store 限免提醒

在設定裡開啟「**提醒我 Epic Games Store 的免費遊戲**」，FreeKeep 也會幫你盯 Epic 每週送的遊戲。它**只負責提醒**：
新的限免開始時通知你一次、popup 裡列出清單並附上「**到 Epic 領取**」按鈕，也會預告下週的遊戲。
領取要在 Epic 網站上自己完成。

<p align="center"><img src="docs/assets/epic-zh_TW.png" width="320" alt="popup 的 Epic Games 分頁：本週限免遊戲與「到 Epic 領取」按鈕，下方預告下週遊戲" /></p>

- Epic 的清單是公開的，FreeKeep 以匿名方式讀取：不需要 Epic 帳號、不帶登入、不帶 Cookie，
  只帶上瀏覽器語言（讓遊戲名稱跟 Epic 官網一致），不會送出你的國家或 Steam 資料
- 開啟時，瀏覽器會詢問一項額外權限：讀取 `store-site-backend-static-ipv4.ak.epicgames.com`；
  關閉時會把權限交還。Chrome 的擴充功能頁面可能仍會列出這個網址，那是 Chrome 記得你允許過、
  下次再開啟時不會再問，但 FreeKeep 實際上已經連不到它
- 只要你沒開，FreeKeep 就完全不會連到 Epic

### 權限

| 權限 | 用途 |
|---|---|
| `store.steampowered.com` | 找限免、讀取收藏庫、領取遊戲 |
| `storage` | 只在你的裝置上記住設定和處理過的限免 |
| `alarms` | 定時檢查 |
| `notifications` | 領到遊戲或需要你處理時通知你 |
| `store-site-backend-static-ipv4.ak.epicgames.com`（選用） | 開啟 Epic 提醒後，讀取 Epic 公開的限免清單 |

沒有 `tabs`、`scripting`、`cookies`，也不能存取任何其他網站。

## 常見問題

**帳號安全嗎？** FreeKeep 看不到你的密碼，也讀不到你的登入 Cookie：Steam 把它設為 `HttpOnly`，
而 FreeKeep 沒有 `cookies` 權限。瀏覽器會像你平常逛商店一樣，自動替
`store.steampowered.com` 的請求帶上登入狀態。程式碼很短，一次就能讀完。

**Steam 允許嗎？** FreeKeep 送出的請求跟按「加入帳戶」一樣，而且頻率很低。但它仍然是非官方的自動化，
請自行評估風險。本專案與 Valve 無關。

**新帳號或受限帳號能用嗎？** 可以，已在全新帳號上實測成功。

**為什麼 Epic 的遊戲不能自動領？** Steam 的免費授權只要一個請求，跟「加入帳戶」按鈕送出的一樣；
Epic 則要走它的結帳頁面。要自動化就得操控 Epic 網站或處理你的 Epic 登入，這違反 FreeKeep
「絕不碰你的憑證」的原則，所以 Epic 這邊改成提醒你。

**為什麼 DLC 沒有被領？** Steam 只允許擁有本體的人領取 DLC。FreeKeep 會標示「缺少本體」，
如果限免期間你買了本體，它會自動補領。

**壞掉了怎麼辦？** 打開 popup → 按「複製診斷報告」→ 貼到 [Issues](../../issues)。報告裡不含任何帳號資料。

## 開發

```bash
npm install
npm run dev        # 開啟 Chrome 並熱重載
npm test           # 單元測試
npm run compile    # 型別檢查
npm run build      # 輸出到 .output/chrome-mv3
npm run zip        # 打包成可上架的 zip
```

上面的示範動畫是用真實的 popup 錄製的：`npm run build && node scripts/demo/record.mjs zh_TW`
（需要 Playwright 和 ffmpeg）。Epic 分頁的截圖則由 `npm run epic-shot` 產生。

### 翻譯

FreeKeep 目前支援 12 種語言，加入新語言只要幾分鐘：複製
[`public/_locales/en/messages.json`](public/_locales/en/messages.json)、翻譯後發 Pull Request 即可。
也非常歡迎母語者校正機器輔助翻譯的語言。語言狀態表與步驟請見 [CONTRIBUTING.md](CONTRIBUTING.md#translations)。

## 聯絡

由 [@SmailDot](https://github.com/SmailDot) 維護。問題、回報或建議：
[開 Issue](../../issues) 或寄信到 [smaildot@aidot.me](mailto:smaildot@aidot.me)。

## 授權

程式碼採 [MIT](LICENSE) 授權。「FreeKeep」名稱與 logo 不在授權範圍內，請勿以此名稱或 logo 發布分支或複製版本。

Steam 是 Valve Corporation 的商標，FreeKeep 與 Valve 無關，也未獲其背書。
