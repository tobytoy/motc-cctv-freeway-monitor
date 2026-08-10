# 台灣國道 CCTV 即時監控與地圖狀態儀表板 (GitHub Pages 版)

> 📹 全台國道與快速道路即時 CCTV 監視器畫面與網路狀態監控儀表板。基於 React 19 + TypeScript + Vite + Leaflet + HLS.js 打造，支援全前端靜態託管於 GitHub Pages。

[Live Demo](https://tobytoy.github.io/motc-cctv-freeway-monitor/)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6.0-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-cyan)
![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub_Pages-green)

---

## 🌟 特色功能

1. **全台國道 CCTV 地圖視角**：
   - 整合 CartoDB 暗色地圖圖資，標註國1、國3、國5、國2、國4、國6、國8、國10與快速道路即時 CCTV 鏡頭。
   - 提供全台、北區、中區、南區、東區快速定位跳轉按鈕。
   - Marker 動態運作狀態指示燈 (綠色正常 / 黃色延遲 / 紅色離線)。

2. **HLS.js 即時影像與快照播放器**：
   - 支援 `.m3u8` 高畫質 HLS 串流即時播放。
   - 支援影像快照自動定時刷新 (2s / 3s / 5s / 10s)。
   - 提供一鍵全螢幕、座標與串流 URL 複製、即時 Ping 延遲檢測。

3. **強大清單篩選與關鍵字搜尋**：
   - 支援依「國道路線」、「台灣分區」、「運作狀態」多重過濾。
   - 支援依里程數、地點名稱與鏡頭編號進行即時搜尋。
   - 支援依 Ping 延遲、路線、狀態進行升降序排序。

4. **國道健康度與數據統計分析**：
   - 提供各國道 CCTV 在線率排行榜。
   - 北中南東四大分區設備覆蓋與可用率分析。
   - 異常與高延遲監視器重點關注列表。

5. ** GitHub Pages 零後端託管**：
   - 採用純前端 (Client-side Pure SPA) 架構，可無縫部署至 GitHub Pages (`gh-pages`)。
   - 提供自動化 GitHub Actions Workflow (`.github/workflows/deploy.yml`)。

---

## 🚀 本地開發指南

### 1. 安裝套件
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```
瀏覽器開啟 `http://localhost:3000` 即可預覽。

### 3. 型態檢查與建置靜態產物
```bash
npm run lint
npm run build
```
建置產物將輸出至 `dist/` 資料夾。

---

## 📦 GitHub Pages 部署步驟

本專案已設定 `.github/workflows/deploy.yml` 自動部署流程：

1. 將程式碼推送至 GitHub 儲存庫主分支 `main`：
   ```bash
   git add .
   git commit -m "feat: setup Taiwan CCTV freeway monitor for GitHub Pages"
   git push origin main
   ```
2. GitHub Actions 將自動觸發建置，並將 `dist` 資料夾打包發佈至 `gh-pages` 分支。
3. 進入 GitHub Repository 的 **Settings -> Pages**，將 Source 設定為 `gh-pages` 分支即可完成上線。

---

## 📄 授權條款

MIT License
