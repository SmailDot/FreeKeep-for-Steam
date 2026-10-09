<div align="center">

<img src="docs/assets/icon-512.png" width="96" alt="FreeKeep 圖示" />

# FreeKeep for Steam

**再也不會錯過 Steam 限免遊戲。**
一個很小的瀏覽器擴充功能，在背景用你瀏覽器裡現有的 Steam 登入，自動幫你領取限時免費遊戲。

🔒 **你的帳號憑證永遠不會離開你的電腦。**

[English](README.md) · [安裝](#安裝) · [運作原理](#運作原理) · [隱私權](PRIVACY.md)

![FreeKeep 示範](docs/assets/demo-zh_TW.gif)

</div>

## 🔒 隱私優先

大多數自動領取工具都需要你的 Steam 密碼、Session Token 或 Cookie，並把它們存在機器人、伺服器或設定檔裡。
**FreeKeep 從來不要求這些。** 它完全在你自己的瀏覽器裡執行，由瀏覽器替請求帶上它本來就有的登入狀態，
就跟你自己打開 Steam 商店一模一樣。

| | 一般的機器人與腳本 | FreeKeep |
|---|---|---|
| 要你的密碼、Token 或 Cookie | 通常要 | **從不** |
| 在哪裡執行 | 機器人、伺服器或常駐主機 | **你自己的瀏覽器** |
| 你的 Steam 登入 | 被複製到它們的設定裡 | **留在你的瀏覽器，完全不碰** |
| 連線對象 | 它們的伺服器、Discord、第三方 API | **只有 `store.steampowered.com`** |
| 蒐集資料 | 不一定 | **完全不蒐集，沒有伺服器、沒有分析** |
| 可否審查 | 不一定 | **約 35 KB 的 TypeScript，完全開源** |

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
- **輕巧、可審查**：程式碼約 35 KB、零執行期依賴、TypeScript、38 個單元測試
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

### 權限

| 權限 | 用途 |
|---|---|
| `store.steampowered.com` | 找限免、讀取收藏庫、領取遊戲 |
| `storage` | 只在你的裝置上記住設定和處理過的限免 |
| `alarms` | 定時檢查 |
| `notifications` | 領到遊戲或需要你處理時通知你 |

沒有 `tabs`、`scripting`、`cookies`，也不能存取任何其他網站。

## 常見問題

**帳號安全嗎？** FreeKeep 看不到你的密碼，也讀不到你的登入 Cookie：Steam 把它設為 `HttpOnly`，
而 FreeKeep 沒有 `cookies` 權限。瀏覽器會像你平常逛商店一樣，自動替
`store.steampowered.com` 的請求帶上登入狀態。程式碼很短，一次就能讀完。

**Steam 允許嗎？** FreeKeep 送出的請求跟按「加入帳戶」一樣，而且頻率很低。但它仍然是非官方的自動化，
請自行評估風險。本專案與 Valve 無關。

**新帳號或受限帳號能用嗎？** 可以，已在全新帳號上實測成功。

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
（需要 Playwright 和 ffmpeg）。

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
