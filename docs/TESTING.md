# 測試人員指南 / Tester guide

感謝幫忙測試 FreeKeep！整個流程大約 5 分鐘。
Thanks for testing FreeKeep! It takes about five minutes. (English below.)

## 安裝

1. 到 [Releases](../../../releases) 下載最新的 `freekeep-for-steam-*-chrome.zip`，解壓縮
2. Chrome / Edge 開啟 `chrome://extensions`（Edge 是 `edge://extensions`），開啟「開發人員模式」
3. 按「載入未封裝項目」，選解壓縮出來、裡面有 `manifest.json` 的資料夾
4. 在同一個瀏覽器登入 [Steam 商店](https://store.steampowered.com/)
5. 點工具列的 FreeKeep 圖示（在拼圖選單裡，可以釘選）

Firefox 140 以上：下載 `freekeep-for-steam-*-firefox.zip` 並解壓縮，開啟 `about:debugging#/runtime/this-firefox`，
按 **Load Temporary Add-on…**，選資料夾裡的 `manifest.json`。這種暫時安裝在重新啟動 Firefox 後會移除。

## 請幫忙確認

| # | 動作 | 預期結果 |
|---|---|---|
| 1 | 打開 popup，按「立即檢查」 | 狀態變成「檢查 Steam 中…」，幾秒後列出目前的限免 |
| 2 | 有你沒擁有的限免遊戲時 | 自動領取，跳出系統通知，popup 顯示「已領取」並播放動畫；Steam 收藏庫出現該遊戲 |
| 3 | 已擁有的 / 缺本體的 DLC | 顯示「已擁有」/「缺少本體」，不會重複領 |
| 4 | 登出 Steam 後按「立即檢查」 | popup 顯示請登入的提示，圖示出現橘色「!」，只通知一次 |
| 5 | 設定頁改成「先問我」 | 新的限免只會通知，popup 出現「領取」「略過」按鈕 |
| 6 | 關掉瀏覽器再打開，等約 1 分鐘 | 自動跑一次檢查（popup 的「上次檢查」時間會更新） |
| 7 | 設定頁勾選「提醒我 Epic Games Store 的免費遊戲」 | Chrome 跳出權限詢問；允許後 popup 出現「Steam ／ Epic Games」分頁，Epic 分頁列出本週限免並通知一次 |
| 8 | Epic 分頁按「到 Epic 領取」/「隱藏」 | 開啟該遊戲的 Epic 商店頁並標示「已開啟」/ 該遊戲從清單消失 |
| 9 | 取消勾選 Epic 提醒，再按 popup 的「複製診斷報告」 | 分頁消失；報告裡 `"epicAccess": false`。`chrome://extensions` 的詳細資料可能仍列出 Epic 網址，這是 Chrome 記得你曾經允許過（再次勾選時不會再問），FreeKeep 實際上已經連不到 Epic |
| 10 | 超過 24 小時沒開 Steam 網頁後打開 popup（設定維持「一鍵續期」） | 顯示「Steam 登入已過期」與「一鍵續期」；按下後背景短暫出現 Steam 分頁並自動關閉，接著顯示已登入 |
| 11 | 設定改成「自動續期」 | Chrome 詢問 login.steampowered.com 權限；允許後，下次登入過期時不需任何操作就會恢復（診斷報告的 `renewal` 顯示 `"method": "auto", "result": "ok"`） |
| 12 | 設定改成「只提醒」 | 過期時只跳通知；點通知會開啟 Steam 商店分頁（不會自動關閉），之後 FreeKeep 自動重新檢查 |
| 13 | 設定頁「外觀與關於」換一個寶箱顏色，或用「主體／鎖扣」自訂 | 工具列圖示、popup、設定頁的寶箱立刻變色；閃光是對比色；重開瀏覽器後顏色仍在 |
| 14 | 設定頁左側目錄點各項目、上下捲動 | 會捲到該段落，目前所在段落在目錄上亮起；「連線清單」的燈號跟權限一致 |

## 回報問題

popup 底部按「複製診斷報告」，連同你看到的狀況貼到 [Issues](../../../issues)。報告不含帳號資料。

手動安裝的版本不會自動更新，有新 Release 時請重新下載，到 `chrome://extensions` 按該擴充功能的「重新載入」。

---

## Install

1. Download the latest `freekeep-for-steam-*-chrome.zip` from [Releases](../../../releases) and unzip it.
2. Open `chrome://extensions` (`edge://extensions` in Edge) and enable **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder that contains `manifest.json`.
4. Log in to the [Steam store](https://store.steampowered.com/) in the same browser.
5. Click the FreeKeep icon in the toolbar (inside the puzzle menu; you can pin it).

Firefox 140 or later: unzip `freekeep-for-steam-*-firefox.zip`, open
`about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `manifest.json` in
the folder. Firefox removes temporary add-ons when it restarts.

## Please check

| # | Do | Expect |
|---|---|---|
| 1 | Open the popup, click **Check now** | "Checking Steam…", then current promotions are listed |
| 2 | A free game you don't own is listed | It gets claimed, a notification appears, the popup shows **Claimed** with an animation, and the game is in your Steam library |
| 3 | Owned games / DLC without base game | Shown as **In library** / **Needs base game**, never claimed twice |
| 4 | Log out of Steam, click **Check now** | Login banner in the popup, orange `!` on the icon, notified once |
| 5 | Settings → **Ask me first** | New promotions only notify; the popup shows **Claim** / **Skip** |
| 6 | Restart the browser, wait about a minute | A check runs on its own ("Last check" updates) |
| 7 | Settings → tick **Remind me of free games on the Epic Games Store** | Chrome asks for permission; once allowed, the popup gets **Steam / Epic Games** tabs, the Epic tab lists this week's giveaways, and one notification appears |
| 8 | On the Epic tab, click **Get on Epic** / **Hide** | The game's Epic store page opens and it is marked **Opened** / the game disappears from the list |
| 9 | Untick Epic reminders, then click **Copy diagnostics** in the popup | The tabs disappear and the report says `"epicAccess": false`. `chrome://extensions` → Details may still list the Epic site: Chrome remembers you allowed it once (ticking again won't ask), but FreeKeep can no longer reach it |
| 10 | Open the popup after not visiting Steam for over 24 hours (renewal left at **Renew with one click**) | "Steam login expired" with **Renew now**; clicking it shows a Steam tab briefly in the background, which closes itself, then you're logged in |
| 11 | Settings → **Renew automatically** | Chrome asks for login.steampowered.com; once allowed, the next lapsed login recovers without any action (diagnostics `renewal` shows `"method": "auto", "result": "ok"`) |
| 12 | Settings → **Only remind me** | Only a notification when the login lapses; clicking it opens the Steam store in a tab that stays open, then FreeKeep checks again by itself |
| 13 | Settings → **Look & about**: pick a chest preset, or set your own body / lock colours | The chest changes right away in the toolbar, popup and settings; the sparkle uses a contrasting colour; the colours survive a browser restart |
| 14 | Click the entries in the settings sidebar and scroll | It jumps to each section and highlights the one in view; the **Connections** lights match the permissions |

## Report a problem

Click **Copy diagnostics** at the bottom of the popup and paste it into an [issue](../../../issues)
with what you saw. The report contains no account data.

Manual installs don't auto-update: download new releases and click **Reload** on the extension in
`chrome://extensions`.
