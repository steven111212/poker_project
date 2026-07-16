# Poker 檢討專案 — 目標與規劃

## 目的

追蹤並改善使用者在 Natural8 (GG) 100BB 現金桌的決策品質。
短期聚焦翻前,長期擴充到翻後與成長追蹤。

## 資料流

主要使用方式(index.html,唯一的視覺化入口):

```
Natural8 匯出 .zip → 打開 index.html → 拖進上傳區
  → 瀏覽器內解壓/解析,存入 localStorage(以 Hand ID 去重,可持續累積)
```

輔助:`python src/analyze.py hands` 可產生文字版 report.md(給 AI 檢討用)。
dashboard.html 已移除,功能全部併入 index.html。

## 基準範圍(已完成)

以使用者提供的 GTO Wizard 6max NL25 100bb 截圖校正,存於 `src/ranges.py`:

| 類別 | 張數 | 狀態 |
|---|---|---|
| RFI(UTG/HJ/CO/BTN/SB) | 5 | ✅ 已校正 |
| vs open(各位置組合) | 15 | ✅ 已校正 |
| SB open 被 BB 3-bet | 1 | ✅ 已校正 |
| 其他 vs 3-bet / 4-bet / squeeze | - | ⬜ 未來擴充 |

原則:**純策略、不帶混合頻率**(≥50% 的動作為準)。
混頻邊界牌(如 88 call UTG open)被標記時自行斟酌。

## 網頁 Dashboard(v1 範圍)

單一 HTML 檔、資料內嵌、離線可開、不依賴外部服務。

1. **翻前正確率趨勢**:以「日期(session)」分組,折線圖顯示
   每期的翻前偏差率(偏差手數 / 有判定的決策數)。
2. **分期明細表**:每期手數、盈虧 bb、bb/100、偏差數、偏差率。
3. **偏差類型分解**:RFI 太緊 / RFI 太鬆 / 該 3-bet 沒 3-bet /
   不該 call 的 call…各類型的次數與趨勢。
4. **13×13 熱力圖**:哪些起手牌最常打錯。
5. **偏差清單**:可依期別瀏覽,附 Hand ID 方便回查原始紀錄。

## 成長追蹤的定義

- 「一期」= 同一天的所有手牌(依手牌時間戳分組)。
- 核心指標:**翻前偏差率**。目標是逐期下降。
- 輔助指標:大額虧損手數(≤-30bb)、3-bet 使用率是否接近基準。

## 成長日誌(已完成 v1)

朝「撲克版 Notion」方向擴充,全部存 localStorage、備份可攜:

- **手牌筆記**(`poker_notes_v1`):任一手牌可寫檢討文字 + 標籤(如 #情緒手)。
  入口:熱力圖詳情、偏差清單的「＋筆記」按鈕;Notes 區集中瀏覽/編輯。
- **Session 日記**(`poker_diary_v1`):以日期為單位寫賽後心得,
  編輯與回顧時都與當期數據(手數/盈虧/偏差率)並排顯示。
- **完整備份**:一鍵匯出/匯入 JSON(手牌+筆記+日記+目標+自訂範圍),
  匯入時手牌去重合併、筆記/日記以備份內容為準。

## 未來擴充(等技術/需求到位再做)

- ⬜ vs 3-bet / 4-bet / squeeze 範圍補完
- ⬜ 翻後檢討自動化(大底池自動送 AI 逐手評語)
- ⬜ 偏差嚴重度分級(邊界混頻 vs 明顯錯誤)
- ⬜ 位置別 / 情境別的成長曲線
- ⬜ 每週自動彙整「本週三大漏洞」

## 網頁 App(index.html,可分享版)

`python src/build_app.py` 產生 `index.html` — 純前端單頁 app,可放 GitHub Pages
給任何人使用:

- 直接上傳 Natural8 匯出的 **.zip / .txt**(拖放或點選,瀏覽器內解壓與解析)
- 手牌以 Hand ID 去重,儲存在**使用者自己的 localStorage**(資料不離開瀏覽器)
- 升級目標可自訂級別與金額
- 其餘功能與本地 dashboard 相同(趨勢、範圍表、熱力圖、偏差清單)
- 範圍表在 build 時從 `ranges.py` 注入 — 改了範圍要重跑 build_app.py

JS 解析器已用 Node 對 1209 手驗證,與 Python 管線結果完全一致。

## 目錄結構

```
poker_project/
├── PROJECT.md          ← 本文件(共識)
├── README.md           ← 使用說明
├── report.md           ← 最新文字報告(產出)
├── dashboard.html      ← 視覺化網頁(產出)
├── src/
│   ├── hand_parser.py  ← GG 手牌解析
│   ├── ranges.py       ← 翻前範圍資料庫
│   ├── analyze.py      ← 統計/比對/文字報告(CLI 輔助)
│   ├── dashboard.py    ← 範圍表匯出(build_app 依賴;html 產生功能已停用)
│   └── build_app.py    ← app(index.html)產生器
└── hands/              ← txt 手牌紀錄(匯出資料夾整包丟入)
```
