# Privacy Policy

_Last updated: 2026-10-09 (added the optional Epic Games Store reminders, version 0.2.0)_

FreeKeep for Steam ("FreeKeep") is a browser extension that claims free-to-keep promotions on the
Steam store for the person using it.

## What FreeKeep does not do

- It does not collect, sell or share any personal data, and sends nothing to anyone but Steam itself.
  (If you turn on Epic reminders, it also downloads Epic's public list of free games; see below.)
- It has no server, analytics, tracking or advertising.
- It never asks for, reads or stores your Steam password.
- It cannot read your Steam login cookie: Steam marks it `HttpOnly` and FreeKeep does not have the
  `cookies` permission. It never stores session tokens, your account id or your account name.

## Data stored on your device

FreeKeep keeps the following in your browser's extension storage (`chrome.storage.local`). It never
leaves your device and is deleted when you remove the extension:

- your FreeKeep settings;
- public store information about current promotions (app and package ids, names, images, deadline)
  and what FreeKeep did with each one;
- the time and result of the last checks, whether you were logged in, and your Steam store
  region (country code, used to look up the right regional promotions);
- only if Epic reminders are on: public information about Epic's current and upcoming free games
  (title, image link, store link, dates) and whether you opened or hid each one.

To decide what to claim, FreeKeep also reads which of the current promotions your account already
owns. This list is used in memory and is not stored.

## Network requests

FreeKeep only sends requests to `https://store.steampowered.com` (plus Epic, only if you turn on the
optional reminders below), to find promotions, read which games your account owns, and claim
promotions. Your browser attaches your existing Steam login to these requests the same way it does
when you visit the Steam store yourself. The popup shows game images, which your browser loads from
Steam's image servers (`*.steamstatic.com`) like any web page would.

To claim a promotion, FreeKeep reads the store's anti-forgery code (`sessionid`, present in every
store page) and sends it back to Steam with the claim request, exactly like the store's own
**Add to Account** button. It is kept in memory only for that request and never stored.

These requests are governed by [Valve's privacy policy](https://store.steampowered.com/privacy_agreement/).

### Optional: Epic Games Store reminders

This feature is off by default. When you turn it on, your browser asks you to allow access to
`https://store-site-backend-static-ipv4.ak.epicgames.com`, and FreeKeep then downloads Epic's public
list of free games from there at each check. The request is anonymous: it carries no cookies and no
login, uses no Epic account, and includes no data about you, your Steam account or your country. The
popup shows the games' cover images, which your browser loads from Epic's image server
(`cdn1.epicgames.com`) like any web page would. FreeKeep never claims anything on Epic and never
opens Epic pages by itself; it only opens the store page when you click **Get on Epic** or the
notification. Turning the feature off removes the permission again.

These requests are governed by [Epic's privacy policy](https://www.epicgames.com/site/privacypolicy).

## Diagnostics

The popup's **Copy diagnostics** button copies a report to your clipboard. It contains your FreeKeep
settings, recent check results and the public promotion data above (including the Epic list, if that
feature is on), and nothing about your account.
It is only shared if you paste it somewhere yourself.

## Contact

Questions: open an issue at https://github.com/SmailDot/FreeKeep-for-Steam/issues or email
[smaildot@aidot.me](mailto:smaildot@aidot.me). Maintainer: [@SmailDot](https://github.com/SmailDot).

---

## 隱私權政策（繁體中文）

FreeKeep 不會蒐集、出售或分享任何個人資料，除了 Steam 本身以外不會傳送任何資料給任何人；沒有伺服器、分析、
追蹤或廣告；從不要求、讀取或儲存你的 Steam 密碼。Steam 的登入 Cookie 設有 `HttpOnly`，而 FreeKeep 沒有
`cookies` 權限，因此根本讀不到；它也從不儲存 Session Token、帳號 ID 或帳號名稱。

設定、目前限免的公開商店資料（app / package id、名稱、圖片、截止時間）與處理結果、最近的檢查結果、
登入狀態與 Steam 商店地區（國家代碼，用來查詢正確地區的限免），只儲存在你瀏覽器的擴充功能儲存空間，
不會離開你的裝置，移除擴充功能即刪除。為了判斷要領哪些遊戲，FreeKeep 會讀取你的帳號擁有哪些目前的限免，
這份清單只在記憶體中使用，不會被儲存。

FreeKeep 只會連線到 `https://store.steampowered.com`（開啟選用的 Epic 提醒時另見下段），用來尋找限免、
讀取你擁有的遊戲並領取限免。瀏覽器會像你平常逛 Steam 商店一樣自動帶上登入狀態。popup 顯示的遊戲圖片，
由瀏覽器從 Steam 圖片伺服器（`*.steamstatic.com`）載入，就像一般網頁一樣。領取時，FreeKeep 會從商店頁讀取防偽造代碼
（`sessionid`，每個商店頁都有）並隨領取請求送回 Steam，做法與商店自己的「加入帳戶」按鈕相同，
只在該次請求的記憶體中使用，從不儲存。

選用的 Epic Games Store 限免提醒預設關閉。開啟時，瀏覽器會請你允許存取
`https://store-site-backend-static-ipv4.ak.epicgames.com`，之後 FreeKeep 每次檢查會從那裡下載 Epic 公開的限免清單。
這個請求是匿名的：不帶 Cookie、不帶登入、不使用 Epic 帳號，也不含任何關於你、你的 Steam 帳號或國家的資料。
popup 顯示的封面圖由瀏覽器從 Epic 圖片伺服器（`cdn1.epicgames.com`）載入，就像一般網頁一樣。
FreeKeep 不會在 Epic 上領取任何東西，也不會自己開啟 Epic 頁面，只有在你按下「到 Epic 領取」或通知時才會開啟商店頁。
清單中的公開資料（名稱、圖片連結、商店連結、日期）以及你是否已開啟或隱藏，只存在你的裝置上；關閉功能時會一併移除權限。

「複製診斷報告」只會複製到你的剪貼簿，
內容不含帳號資料，只有你自己貼出去才會被分享。

聯絡方式：[GitHub Issues](https://github.com/SmailDot/FreeKeep-for-Steam/issues) 或 [smaildot@aidot.me](mailto:smaildot@aidot.me)（維護者 [@SmailDot](https://github.com/SmailDot)）。
