# 恢復本經文擷取（網頁版）

貼上含經文出處的大綱文字，自動解析每一節，到恢復本網站逐節擷取，過程即時顯示在頁面上，最後可下載 `.txt`。

## 檔案
- `index.html`：介面與擷取流程
- `parser.js`：出處解析器（邏輯與 Python 版 `recovery_verses.py` 一致）

## 部署到 GitHub Pages
1. 在 GitHub 建立新的 repository（例如 `rv-verses`），把 `index.html`、`parser.js`、`README.md` 放在根目錄。
2. Settings → Pages → Build and deployment：Source 選 *Deploy from a branch*，Branch 選 `main`、資料夾 `/ (root)`，儲存。
3. 約一分鐘後，網址為 `https://<你的帳號>.github.io/<repository 名稱>/`。

## 第一次使用
1. 先按「解析預覽」，確認解析出的節是對的（這步不連網）。
2. 打開「連線設定」按「測試連線」。
   - 顯示 ✔：可以直接用。
   - 顯示瀏覽器無法讀取：該網站沒有開放跨網站讀取，需要改用其他方式（見下）。

## 連線限制
瀏覽器預設不允許網頁讀取其他網站，除非對方網站開放（CORS）。這個專案無法事先確認恢復本網站是否開放。
若測試連線失敗，可：在「連線設定」填入代理網址（例如自己的 Cloudflare Worker），或改成在恢復本網站頁面內執行的腳本。
