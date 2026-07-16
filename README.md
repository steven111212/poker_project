# Poker 手牌檢討工具

針對 Natural8 / GG 匯出的手牌紀錄(txt),做統計、翻前範圍比對、漏牌篩選。

## 使用方式

**主要:打開 `index.html`**(雙擊即可,離線可用)— 把 Natural8 匯出的
.zip 或 .txt 拖進上傳區。手牌以 Hand ID 去重、存在瀏覽器 localStorage,
可持續累積;範圍表可自訂(含混合頻率),目標進度、盈虧曲線、偏差分析都在裡面。
另有**成長日誌**:手牌筆記(文字+標籤)、Session 日記(與當日數據並排)、
一鍵匯出/匯入完整備份(換裝置或清瀏覽器前記得備份)。

改了 `src/ranges.py` 的預設範圍後,跑 `python src/build_app.py` 重新產生 index.html。

**輔助(給 AI 檢討用的文字報告)**:手牌放進 `hands/`,跑:

```
python src/analyze.py hands -o report.md
```

`report.md` 內容包含:

1. **整體數據** — VPIP / PFR / 3-bet% / WTSD / bb/100
2. **各位置、各級別盈虧**
3. **翻前範圍偏差** — 與基準範圍表不一致的每一手(RFI 與面對單一 open 的 3-bet/call/fold)
4. **值得檢討的手牌** — 輸 30bb 以上大底池、攤牌輸、3-bet 底池虧損

## 範圍基準表

`src/ranges.py` 內建 100BB 6-max 簡化純策略範圍(以 GTO Wizard 為基準,
不含混合頻率):

- `RFI`:UTG / HJ / CO / BTN / SB 首入 open 範圍
- `VS_OPEN`:各「自己位置 × open 位置」組合的 3-bet / call 範圍

用 GTO Wizard 抽查後若要修正,直接改表內的牌型字串即可,
支援 `66+`、`A2s+`、`KJo+`、`T9s` 等寫法。

## 檔案結構

- `src/hand_parser.py` — GG 手牌紀錄解析器(Python 報告管線用)
- `src/ranges.py` — 翻前範圍資料庫
- `src/analyze.py` — 統計 + 比對 + 報告輸出
- `src/build_app.py` — 網頁 app 組裝器(產生 index.html)
- `src/app/` — 網頁 app 原始碼,按功能拆分:
  - `template.html` / `body.html` / `styles.css` — 骨架、版面、樣式
  - `js/` — 14 個功能模組(parser、stats、render、notes、diary、backup…),
    依 `build_app.py` 的 `JS_ORDER` 串接;改任何模組後跑
    `python src/build_app.py` 重建

## 已知限制

- 翻前比對只涵蓋「首入 RFI」和「面對單一 open」兩種情境;
  limped pot、squeeze、4-bet 情境會跳過不判定。
- 混合頻率牌一律簡化為主要動作,邊界牌(如 UTG 的 K6s、55)判定僅供參考。
