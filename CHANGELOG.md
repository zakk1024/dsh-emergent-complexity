# Changelog

## 1.2.0 — 2026-11-22
- 資源池改由 LLM＋AnySearch 依使用者問題即時策展（≤30 條），新專案不再自動載入內建 pack。
- 新增元素欄：LLM 第一性原理拆解資源池，數量可指定或留白；每次 run 追加到 ELEMENTS.md 拆解紀錄（R id），最終去重清單（E id）才是生成器輸入。
- 搜尋逃生門：10 個預設英文關鍵詞下拉＋自由欄；空白時以資源池問題搜尋。
- 生成器在 ELEMENTS 空時回 409；新增 /api/emergent/llm 與 /llm-test 診斷端點。
- 修正 LLM 輸出被推理預算吃光（reasoningEffort low、提高 maxTokens）、route 物件循環序列化。

## 1.1.1 — 2026-11-22
- Canonical archive 相容：descriptor 軸宣告多格式、grid ops 逗號、ELEMENTS.md 大寫 fallback、4 欄 run-log 接受。
- 誠實計數：reset 僅在同現檢查後、dupRate 以實際跳過數計算、phase 依 run 數。
- 並行與原子性：per-root 鎖＋原子寫入；auth 檢查修正。
- UX：iframe Esc 關閉、生成結果不被 stats 覆寫、窄螢幕資源池可見、中文錯誤、README 安裝順序。

## 1.1.0 — 2026-11-22
- 新增 Emergent Studio 整頁工作室（資源池／生成器／想法板／描述符格／執行紀錄）與 DSH overlay 啟動器。
