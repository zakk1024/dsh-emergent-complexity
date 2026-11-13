---
name: emergent-complexity
description: >
  Use when the task is to generate many novel ideas that must be traceable
  to their combinational ingredients (element x variable x function), with
  no seed ideas fed in. Runs a two-stage novelty-search loop (combinatorial
  supply / selective retention) over a permanent descriptor-grid archive,
  with honest duplicate counting. Triggers: idea generation, novelty search,
  emergent novelty, traceable ideation, 發想, 新穎性搜尋, 可溯源點子.
---

# emergent-complexity — 可溯源組合發明機

> **DSH bundle build — read these five lines before §1.**
> 1. This skill ships as one file inside the `dsh-emergent-complexity` bundle and is discovered by the `dsh-skill-filesystem` provider (providerName `emergent-complexity`). Nothing new lives inside the skill directory — the diagram SVGs and the three tools are bundle-level resources, not files under this path (§13.2's single-file exception is not used under DSH).
> 2. The verification tools are **DSH Tools, called by their exact names** — never as Service methods, and do not search the Service/Tool inventory for a "service": `ei_audit` (missing = field/bloat audit; corrupt = glued-line & ghost-id detection, with `write:true` quarantine+strip), `ei_census` (occupancy = per-cell occupancy stats; duplication = cross-cell ρ̂ scan), `ei_archive_reset` (one-shot §8 rebuild statement + F5 bad-tail quarantine). If the tools are unavailable, or `write:false`, run the same checks by hand (§13.1 degraded mode).
> 3. Path rule: `ei-archive/`, `ei-runs/`, `scratch/` are always resolved **against the session workspace root** — locate the workspace root with `pwd` first, then build `<workspace root>/ei-archive/...`; the three tools take an equivalent `root` argument (when omitted they search `ei-archive/` under the workspace root, then `$DSH_HOME`, then `~/.dsh`).
> 4. Historical dead paths (kept verbatim for cross-tool comparison — **do not look for these files when running under DSH**): `05-tools/track-c.md` §1.2–1.4 and `05-tools/tools-mcp.md` T4 (= the ρ̂/token cross-check reference for §4.2 points 9/10, not packaged under DSH — replace manual math with `ei_census` occupancy/duplication), `02-council/`, `13-deploy-verify/yield-cores/yield_cores.py` (= S/B-side counts of §12.8, run by `ei_audit` + `ei_census` under DSH), `~/.hermes/profiles/mentor/skills/emergent-complexity/SKILL.md` (for §12.5 structure checks use `test -f <base>/skills/emergent-complexity/SKILL.md` where `<base>` is this skill's absolute base directory).
> 5. `scratch/` is a workspace-root staging dir (§4 step-4 assert scripts land there), sibling to `ei-archive/` and `ei-runs/`.

> 節對應表（防呆）：本檔 §4.1–4.5 ＝ council-2 §2.5 內之 5.3–5.7；§5＝其 §2.6；§6–§13 對應其 §2.7–2.14。單檔無 references；唯一新檔例外見 §13.2。

## §1 適用判斷

- 何時用：需要「新想法」，且每個想法必須能說出由哪些「元件 × 變數賦值 × 組合函式」構成。
- 何時不用：使用者已有明確答案；只彙整既有清單；純文字潤飾。
- 心智模型：品質不來自更強的產生器，來自搜尋壓力與選別順序（P#1）；「先發散後收斂」僅是心智模型，實際相位由重複率動態觸發（§4.3）。
- 總則：**狀態在盤上，不在 context**——任何跨輪狀態以檔案為準（§8），context 只是工作副本。
- 再啟動（run≥2）：workspace 已有 `ei-archive/` 即續跑，冷啟動僅 run 1 前置——「再來一輪／更多想法」不得重冷啟動或清盤重來。使用者「不滿意」先分診再動作：量不足→照 §4 跑下一輪；質未篩→提前叫停進 φ2/φ3 由 critic 補 usefulness 評分；方向不對→§4.5 停滯診斷／§9 F2 改軸；連 element 都不滿→§7 更新（舊 archive 封存唯讀）。

## §2 憑據表（13 條；逐字照抄，不得新增任何文獻）

程序步驟旁僅標 `（P#n）`，不展開論證。降級路徑與 H 值只能寫「設計假說／待試跑值」，不得寫「文獻支持」。

- P1 目標函數會欺騙搜尋；novelty search 不看目標仍迷宮 39/40 vs 3/40；ρ(x)=k 近鄰平均距離、量 phenotype、永久 archive ＜https://www.cs.swarthmore.edu/~meeden/DevelopmentalRobotics/lehmanNoveltySearch11.pdf＞
- P2 Quality-Diversity：行為空間網格化、每 cell 保最佳 elite（MAP-Elites）；實作庫 pyribs ＜https://arxiv.org/abs/1504.04909＞｜＜https://github.com/icaros-usc/pyribs＞
- P3 組合爆炸＝湧現引擎；「build the blocks, not the set」；新穎性由組合學保證 ＜https://www.youtube.com/watch?v=0HqUYpGQIfs＞
- P4 弱湧現＝可導出但出乎意料→組合輸出可溯源即可驗收 ＜https://consc.net/papers/emergence.pdf＞
- P5 層級自主性：每層級有自己的定律語彙（More is Different）＜https://www.science.org/doi/10.1126/science.177.4047.393＞
- P6 創造力雙準則：originality 必要不充分；隨機過程常只產「僅僅原創」＜https://richardcolby.net/writ2000/wp-content/uploads/2017/09/Runco-and-Jaeger-2012-standard-definition-of-creativity.pdf＞（備援 DOI 10.1080/10400419.2012.676727）
- P7 生成式 AI 提高個體創意、降低群體多樣性（同質化實證）＜https://www.science.org/doi/10.1126/sciadv.adn5290＞
- P8 先碰撞後生成：先取結構遙遠原理、強迫通過它生成（bisociation 操作化）＜https://github.com/CL-ML/open-collider＞
- P9 並行異質 critic 勝過序列回饋（7,000 點子消融）＜https://arxiv.org/abs/2507.08350＞
- P10 novelty gate 須獨立於生成者（自己查新＝自己抄自己）＜https://github.com/SakanaAI/AI-Scientist＞｜＜https://github.com/lamm-mit/SciAgentsDiscovery＞
- P11 GP bloat：尺寸成長而適應度停滯；parsimony 為對應藥方 ＜https://link.springer.com/article/10.1007/s11063-021-10497-8＞
- P12 自組織與選擇聯姻、edge of chaos；耗散結構需持續漲落 ＜https://academic.oup.com/book/53153＞｜＜https://www.nobelprize.org/prizes/chemistry/1977/prigogine/lecture/＞
- P13 表達樹（leaf=variable/inner=function）＋突變＋人擇＝可執行骨架 ＜https://www.youtube.com/watch?v=DB-TD3s3MZ0＞

（P7 URL 已按 02-council/council-1.md §3 原表核為 `sciadv.adn5290`——council-2 §2.3 cell 內 `adn5dn5290` 為謄記，chair 校對註指明以原表為準。）

## §3 核心資料結構

- **ELEMENTS**（5–15 個，開工前凍結）：領域基本元件，每個＝`id + 名詞 + 一句機制 + 一個可賦值 variable 槽`。冷啟動規則見 §7。
- **OPERATORS**（固定 6 個，P13 表達樹操作化）：
  - `substitute`：換掉樹上一個 element。例：水 → 水合鹽。
  - `add`：新增一個 element 到樹上。例：通風樹加上蒸發層。
  - `drop`：移除一個 element。例：拿掉輻射層只留風道。
  - `rewire`：改變樹的連接（哪個函式接哪個 leaf）。例：熱質改接到夜間風路上。
  - `reparam`：改某 leaf 的 variable 賦值。例：相變溫度 24°C → 28°C。
  - `promote`：把某 leaf 的機制升格為獨立新 element。例：「蒸發降溫」升格為獨立元件再參與組合。
- **DESCRIPTOR**（3 軸，開工前凍結，P1 看行為不看字串）：每軸 3–5 個具名粗格。預設 `scale`（機制層級）/ `mechanism`（作用原理）/ `context`（適用情境）。改軸＝新 archive，舊 grid 只讀（§7）。
- **想法＝表達樹**：leaf 是 variable 賦值、inner 是 function 組合（P13）——保證每想法可分解回 element × variable × function。
- **座標定義**：任一想法的 descriptor 座標＝三元組 `(scale 格, mechanism 格, context 格)`，各格取該軸具名粗格之一；座標寬入 trace `descriptor` 欄，以 `grid.md` 為唯一天然索引（同 cell＝同簇之機器可驗定義，見 §4.2）。

## §4 生成核心程序（每輪九步，逐步照做，不得跳步——見 §13.1）

1. **讀狀態**：讀 `grid.md`（僅此一檔）＋ELEMENTS＋上輪 run-log 尾部。**禁止讀 `ideas.jsonl` 全文**。
2. **取樣配對**：抽 2–3 元件、各賦 1 個 variable 值，選 1–2 個 operator 組表達樹。組合前先碰撞（P8）——**距離判準（可執行版）**：優先選「三軸中 ≥2 軸不同格」的配對；不足時次選 ≥1 軸不同格；同 trio 全同格配對僅計入輕突變配額。**parent 選擇（沿樹突變時；條文空白處之補則）**：突變對象由「1-op 空鄰 cell 數」降序取用——每候選固定 6 鄰（三軸各換另兩格），對 `grid.md` 數空缺；並列時 operator 結構異質性優先（rewire/promote＞add/reparam/substitute）；重置個體不適用（來源另依步 5）。此為 [代理] 啟發式非驗收項；選用與 tie 裁決記 run-log 參數版本列。
3. **通過組合生成**：只准輸出「由該樹導出的想法」，不得跳過樹直接寫靈感（P3，供給段）。
4. **突變強度分層**（四閘之三）：輕（1 operator）:中（2）:重（3+）≈ 5:3:2【H】；自查須程式化 assert（統計 ops 數計 5:3:2，偏差即印出重分派），不得僅 print；小 N 時 ±1 候選容差。assert 腳本須落盤為單一檔案執行（工作區 scratch/），勿內嵌長碼——內嵌易截斷，且斷言失敗後的修法是改腳本重跑，不是重打整段。
5. **重置個體**（四閘之四）：每輪恰 1 個候選僅由「archive 中從未同現的兩 element」重造，不接 parent。防呆註：重置身分以 `novelty_src` 欄標「重置個體」為準；首輪無歷史可接，`parents` 空不視為重置。重置個體 `operators` 欄記 `reset(E<x>,E<y>)`（保留字，F4「operators∈六算子」檢查對此放行）。**配對耗盡降級**：無「從未同現對」時，依序取同軸不同 element 對→最久未同現對，`novelty_src` 標 `reset-degraded`；element 總數 <3 對皆無則本輪豁免重置閘，記 run-log。
6. **定位 descriptor cell**：每候選標 3 軸座標（§3 定義）。
7. **誠實計數**：執行 §4.1/§4.2 計數表；重複率＝1−真不同數/候選數。
8. **選擇（相位相依，§4.3 表）**：每個保留/淘汰決定強制 1–2 句理由【設計假說，出處待一手來源】；novelty 判定由 §4.4 獨立通道執行（P10）。
9. **寫出**：想法全文＋trace（§5）append `ideas.jsonl`（不改歷史列）；更新 `grid.md`；run-log 記錄本輪統計＋參數版本。

### 4.1 誠實計數——接口（規則唯一載體＝4.2 鉤子，兩處勿並存兩套）

- 相位轉移與重複率計算**只可讀 §4.2 第 7 行表之輸出**，不得回讀候選全文重判。
- **明標：本判定為 LLM 啟發式代理（[代理]），embedding 餘弦／pyribs 實算 ρ 留待 05-tools（P1/P2），非本 skill 實作（[實算鉤子]）。實算對拍與誤差模式：05-tools/tools-mcp.md T4。**

### 4.2 novelty 鉤子（pure-prompt，零依賴）【track-c §3.1；本判定為 LLM 啟發式代理 [代理]】

1. 判定 pass（§4.4 第二段）只准讀 grid.md；禁讀 ideas.jsonl 全文與本輪生成過程。
2. 主判定：候選 descriptor 三軸座標與某已占 cell 全同 →「同cell」；否則「異cell」。
3. 次判定（同簇檢查，僅限同 cell）：與占位者共享任一 parent 且 operator 差 ≤1 → 判同簇。名詞定義：「共享 parent」＝雙方 tree.parents 譜系閉包交集非空（直系父亦屬之）；「operator 差」＝兩列 operators 集合之對稱差基數 ≤1；占位者無 parent 時，改比 descriptor 同軸名差（≤1 視為同簇；離散軸名差判別力弱，此 fallback 判定須於 selection 欄留理由）。
4. 校正單向：次判定只可把「真不同」下修成重複，不可上修——寧可多算重複（抗 <50% 偽造）。
5. ρ̂（選用細判）：候選對全部已占 cell 的 Hamming 距離（相異軸數）最小 k=2 值之均值【H】。
6. M-A 補丁：最小 Ham 距上並列占 cell ≥2 且該距 >1 時，「同簇判定（規則 3）」之比較次序改比同軸 index 差（track-c §1.3）；index 序＝descriptor 座標三元組固定序（scale→mechanism→context，§3 座標定義；ELEMENTS.md 無軸宣告欄，不另設檔）。
7. 誠實計數表（相位轉移唯一依據；只可讀本表輸出，不得回讀候選全文重判），欄位固定：

   | 候選 id | descriptor cell | 主判定（同 cell?） | 次判定（同簇檢查後真不同?） | 一句理由 |
   |------|------|------|------|------|

8. 重複率＝1−真不同數/候選數；候選數 0＝退化輪：記 `重複率:N/A` 不入相位統計並重跑一次；寫入 run-log，餵 §4.3 相位觸發。**行格式固定：`重複率:NN%`（冒號後無空白），並列分數（如 `重複率:30%（3/10）`）**——F1 grep 依此格式。
9. 自評品質時：對 05-tools/track-c.md §1.2 十題表手算 Ham/Euc 對照（校準鉤子，≤15 分鐘，零依賴）。
10. 欲上驗才用 python3 實算 ρ（同卷 §1.4，`math.dist` 即可）——非本 skill 執行所需 [實算鉤子]。

防呆註（占位定義）：「已占 cell」＝grid.md 已記錄者**加本輪較早已判候選**——否則首輪重複率恆為 0，抗偽性失效；此詮釋屬執行細節，記入 run-log。實作順序：先建「已占 cell→(par,ops)」索引，再逐一判定候選（勿邊查邊判）。grid.md 每行須含 `par`（駐留者 parents 逗點列）與 `ops` 欄——跨輪同簇判定之 parent 資料唯此來源，不得另讀 jsonl（守規則 1）。cell 占用比對（規則 2）以腳本集合運算機械判定，勿目測——誤判同 cell 為異 cell 會低估重複率、破壞相位觸發（真跑已驗：dict 計數即足）；LLM 判讀僅留規則 3 fallback 與語意邊界案例。

### 4.3 三相位動態觸發（閾值皆【H】）

| 相位 | 選擇準則 | 進入條件 |
|------|------|------|
| φ1 純 novelty | 只保留開拓空 cell／遠 cell 候選（k＝近鄰 cell 數【H】） | 預設起點；前 2 輪強制 φ1（四閘之二） |
| φ2 novelty+usefulness | novelty 為主；usefulness 當否決票不當分數 | 重複率 ≥50%【H】連續 1 輪，或第 3 輪起 |
| φ3 雙軸並重 | novelty×usefulness 獨立評，**禁單一總分**（P6 雙準則） | φ2 連續 2 輪無新 cell【H】 |

usefulness 軸由 critic 軌道獨立給（§6），生成者自評僅參考。相位真值表（唯一判讀）：`輪次<3 且無「重複率≥50%連續1輪」觸發 → φ1；有觸發或輪次≥3 → φ2；φ2 連續 2 輪無新 cell → φ3。`本表為唯一相位來源——四閘之二僅約束 novelty「行為」，與本表牴觸時以本表為準（輪 1 已觸發者輪 2 即 φ2）。φ3 僅入列停滯診斷，不阻斷次輪突破：突破時先記突破再回 φ1，φ3 歷史保留。**滿盤 tie-break**：空 cell=0 且 k 並列時，每輪保留數固定 `min(5,新候選數)`，序＝最少占同軸 cell 者先→index 序（＝三元組固定序 scale→mechanism→context）；決策記 selection 欄 `tie:<規則>`；bloat cap（同 parent 變體 ≤3，§4.5）為硬約束優先於本保留序——先裁 bloat 再套序；全滿無從置新→走 F2 改軸。

### 4.4 novelty 獨立通道——兩段分離重入（P10；單體收斂寫法）

同一 agent 兩 pass：**(i) 生成 pass** 寫完候選即存盤並收起；**(ii) 判定 pass** 以「僅讀 grid.md、不見本輪生成過程」的角色重入，對每候選按 §4.2 規則給空 cell/占用判定。兩段結論各自記入 run-log。**明標：此為單體式妥協，真獨立 agent 版留待擴充。**

### 4.5 四閘、停滯診斷、停止規則

- 四閘（防過早收斂）：(1) archive 永不淘汰；(2) 前 2 輪純 novelty；(3) 突變分層 5:3:2【H】；(4) 每輪 1 重置個體。
- bloat cap（P11 parsimony）：單一想法 body ≤120 字（計數單位＝unicode 字元，python `len()`）＋單一 parent 留存變體 ≤3【H】。
- 停滯診斷：停止規則觸發前，跑一輪「關閉所有評分、純 novelty 計數」對照輪；對照輪突破（新 cell ≥2【H】）→ 判原準則 deceptive，回 φ1 並記錄。
- 停止規則：連續 2 輪無新 cell 且對照輪無突破【H】；或使用者叫停；或達輪數上限 8【H】。

## §5 Trace 格式（`ideas.jsonl` 每列一個 JSON 物件；欄位固定，驗收逐欄檢查）

```json
{"id":"I3-04","run":3,"seq":4,
 "tree":{"elements":["E02","E07"],"vars":{"E02":"水","E07":"水合鹽"},
         "funcs":["substitute(E07->E02)"],"parents":["I2-11"]},
 "operators":["substitute"],
 "descriptor":{"scale":"device","mechanism":"phase-change","context":"建築"},
 "claim":"<一句話>","body":"<≤120字>",
 "novelty_src":"判定pass結論＋空cell理由","usefulness_src":"critic評語或null",
 "selection":"保留：開拓空cell；變體v2同cell較弱已併","phase":"phi1"}
```

可溯源定義（驗收用）：任一想法沿 `tree.parents` 遞迴可達 ELEMENTS，沿途每步有 operator 與 variable 賦值——**element × variable × function × lineage 四元組完整**（P13）。逐欄：`id`（I<run>-<seq>）、`run/seq`、`tree.elements`（∈ELEMENTS）、`tree.vars`（每 element 一賦值）、`tree.funcs`、`tree.parents`（父 id 或空）、`operators`（∈六算子）、`descriptor`（三車齊）、`claim/body`、`novelty_src/usefulness_src`、`selection`、`phase`。

## §6 社會結構：critic 軌道與選擇者（CLI 無 UI）

- 並行異質 critic ×3（P9）：可行性／使用者價值／反例三視角，**並行**給評不序列迭代。三評價獨立欄位，不合成分數。
- novelty gate：§4.4 兩段分離重入。
- **選擇者**：自動選擇為主幹——novelty 判定 pass＋三 critic 表決，理由留痕 `selection` 欄；使用者互動擇優僅為 opt-in（使用者明示「逐輪我挑」才啟用）。**任何環節禁單一總分**：判準恆為「cell 占位 × 軸向評語」並列。`selection` 欄全數列出——含淘汰者及其理由；φ2 下同 cell 落選候選：淘汰，理由留 selection。

## §7 ELEMENTS 冷啟動與更新

- 冷啟動（run 1 前置）：從**任務領域本身**萃取 5–15 基本元件——問「不可再拆的作用體/機制/約束」；**不從任何既有想法清單逆向萃取**（不讀入種子想法）。每 element 附 variable 槽。**n 逾 15：先併同類（同 descriptor 軸名者合併 variable 槽，id 取首位標 `merged`）；n 不足 5：拆次機制（子節各帶 `id-1/-2`）——兩向重計後須落 5≤n≤15，並於 run-log 記 `elements:N` 行；§12.3 驗收含此範圍檢查**【H】。**冷啟動首步（先於一切）：`mkdir -p ei-archive ei-runs` 並初始化空 `ei-archive/grid.md`、`ei-archive/ideas.jsonl`、`ei-runs/run-log`（僅標頭列）；ELEMENTS 存 `ei-archive/ELEMENTS.md`（id/名詞/一句機制/variable 槽四欄）。**
- 凍結：run 1 開工前凍結 ELEMENTS＋DESCRIPTOR。
- 更新：run 中不得增刪；跨 run 僅兩路——(a) 重置個體證明新組合有價值時補入，標 `added:run N`；(b) 使用者明示。刪除只標 `deprecated`，不改歷史。
- descriptor 改軸＝新 grid；觸發：連續 2 run 多數候選擠少數 cell【H】。

## §8 跨 run 持久化與狀態紀律

- 位置：workspace `ei-archive/`（隨任務工作區走，不隨 skill）。三檔：`ideas.jsonl`（append-only 真相源，**重跑不得改歷史列**，驗收以兩次 dump diff 驗證）、`grid.md`（每輪整檔改寫）、`ei-runs/run-N.md`（供驗收除錯，平時不讀回）。
- grid 損毀重建句（一字不改）：**重建＝python3 逐列讀 ideas.jsonl，對每 cell 取 body 最長列為最佳 id，重寫 grid.md，列數與 cell 數記入 run-log。**
- 免讀入機制：context 永遠只接觸 `grid.md`；歷代全文留盤上，需要時按 id 單點查讀。
- 總則：狀態在盤上，不在 context（§1）。

## §9 失敗處置表（8 列；「如何測」皆為確切可執行動作）

| # | 現象 | 如何測（確切動作） | 處置 |
|---|------|------|------|
| F1 | 重複率連續 ≥50% | `grep -oE '重複率[=:：] ?[0-9.]+ ?%' ei-runs/*.md \| tail -4`（容許冒號後空白；0 匹配≠0%，先驗檔案非空）——最近 2 輪值皆 ≥50% 即成立 | 突變比例 5:3:2→3:4:3【H，記參數版本列】；連續 2 輪→§4.5 停滯診斷 |
| F2 | 候選擠同 cell | 對 grid.md 統計 cell 占用：`grep -o '([a-z-]*,[a-z-]*,[^)]*)' grid.md \| sort \| uniq -c \| sort -rn \| head -3`——單 cell ≥本輪候選半數 | 步 2 軸距判準加嚴（強制 ≥2 軸異格）；2 run 擠塞→§7 改軸重開（舊 grid 轉唯讀） |
| F3 | run-log 缺欄 | 對六必填欄（輪次/相位/重複率/兩段結論/選擇理由/參數版本）逐項 `grep -c '<欄名>' ei-runs/run-N.md`（`run-log` 慣名同檔，兩名均試），任一 0＝缺欄；另跑 §12.4 T4 演練（故意刪欄重走補救） | 補齊（`選擇理由`自 jsonl `selection` 欄抄回；`參數版本`按 §10 預設重述標`[重建]`）後該輪重結算；連續缺欄→重讀本節 |
| F4 | trace 欄位不全 | 逐列跑 §12.3 欄位檢查（12 欄＋tree/descriptor 子欄＋elements∈ELEMENTS＋operators∈六算子），報缺欄 id 清單 | 該想法補齊**方可入計數**；當輪未結算列可原位補；已結算歷史列不改——以新增更正列＋run-log 註記處理 |
| F5 | ideas.jsonl 損毀 | `python3 -c "import json;[json.loads(l) for l in open('ei-archive/ideas.jsonl') if l.strip()]"` 逐列 parse，報第一個壞列行號，成功尾端 `print('rows:',N)`；空檔/僅標頭時印「rows:0」勿靜默 exit 0 | 走下方損毀復原 SOP |
| F6 | grid 與 jsonl 不一致 | 對 grid.md 每 cell「最佳 id」執行 `grep -c "\"id\":\"<id>\"" ei-archive/ideas.jsonl`，0＝幽靈 id；反向隨機抽 3 列核對 descriptor 欄與 cell | 以 jsonl 為準，用 §8 重建句重寫 grid |
| F7 | bloat 超標 | `python3` 統計：各列 `len(body)>120` 計數；同 parent 變體數 >3 清單 | parsimony：併變體、截 body 至 ≤120 字；淘汰者 `selection` 留理由 |
| F8 | H 值無記錄變更 | diff run-log 尾「參數版本」列與 §10 表值，列出未留痕差異 | 補記參數版本列；此後一次只動一參數（§10 調校總則） |

### 損毀復原 SOP（F5 專用；歷史列不變是硬規）

1. 逐列 `json.loads`，記「最後完好列行號 L」與「第一壞列行號 B」。
2. 壞尾隔離：`python3` 把第 B 行起各列寫到 `ideas.jsonl.broken-<時間戳>`——原文不刪不動。**中段壞列／黏著列**：先以 `{"id": "` 錨點拆開黏著列再逐列 parse；B 之後的完好列**原封逐列抄回**，僅壞列重生成。
3. 由第 L 列之後續寫：僅 append；L 以前歷史列一字不改（M5）。
4. 用 §8 重建句全量重建 `grid.md`。
5. run-log 記錄：B、L、隔離檔名、重建後列數與 cell 數。

## §10 參數表（全表 H＝待試跑值；調校見總則）

| 參數 | 值 | 狀態 | 調校法 |
|------|------|------|------|
| k（novelty 近鄰） | 計數版（grid 距離≤1 已占 cell 數；φ1 開拓判定、兩版分歧時權威）＋Ham-mean ρ̂（proxy，重複率細判用；誤差模式 M-A/M-B/M-C 與再校準觸發見 05-tools/track-c.md §1.3–1.4） | **H** | 對照 05-tools pyribs 實算 ρ（P1），校準代理誤差 |
| ELEMENTS 數 | 5–15 | **H** | 冷啟動產出後併/拆 |
| 突變比例 | 5:3:2 | **H** | 兩輪重複率 >50% → 提比重突變 |
| 重複率觸發門檻 | 50% | **H** | run-log 曲線取肘點 |
| φ2→φ3 無新細胞輪數 | 2 | **H** | 停滯診斷觸發率反推 |
| 輪數上限 | 8 | **H** | 同上 |
| bloat cap | 120 字／變體 ≤3 | **H** | 淘汰率過高則放寬 |
| 停滯對照輪突破門檻 | 新 cell ≥2 | **H** | 试跑後定 |
| 對照升格連勝 K | 5 | **H** | §12.8 觀察期→硬門：連續真 run S≥B（含平手）；N/A 不入序列不重置；S<B 歸零 |

調校總則：**H 參數不得在無 run-log 記錄下改動**；一次只動一個；變更記參數版本列。

## §11 Token 成本帳

context 上限 65536。本表單位＝字元（char，python `len()`；1 token≈3–4 字元）。每輪工作集（估算，**非實測——標 H**）：任務 0.3k＋ELEMENTS 0.4k＋grid.md 1.2k（超限僅載鄰近 cell，**硬數：載入 cell 行數上限 60 行**）＋候選生成 2k＋三 critic 1.5k＋判定 pass 0.5k ≈ **5.9k/輪**。SKILL.md 本體 ≈4.5k。滑動窗硬規：**任何時刻 context 內完整想法 ≤ 最近 3 輪**，更早只剩 grid 摘要——峰值 ≈ 4.5＋3×5.9＋單輪增量 ≈ 27k，餘裕充足。**聲明：行數×粗係數估算，05-tools 實跑後回填。**（token 對帳屬事後稽核，出處唯一：05-tools/tools-mcp.md T4——執行中不得查 DB。）

## §12 驗收自測（映射 PIPELINE 驗證器 1–3；每輪結束逐項勾選）

| # | 程序 | 通過條件 | 映射 | 勾選☐＋證據 |
|---|------|------|------|------|
| 12.1 | **裸執行 ×2**：僅憑本 SKILL.md（無 spec、無其他檔）各跑完整核心程序 | 各產 ≥10 想法；不讀入任何種子想法 | 驗證器 2 前兩半 | ☐ 證據：`<run 檔＋列數>` |
| 12.2 | **重複率**：兩輪各跑誠實計數（[代理]，已標），跨 run 亦比對；單輪值僅為內部品質證據，不構成本項通過 | 兩輪重複率 <50%（任何 N 均附 cell 覆蓋率佐證——稀疏區重複率由細胞稀疏性主導）；run 2 不退化為 run 1 變體大會 | 驗證器 2「<50%」 | ☐ 證據：`<兩輪重複率值>` |
| 12.3 | **可溯源**：每想法驗 trace——parents 存在（＝非重置個體須非空且沿 tree.parents 可達 ELEMENTS；重置個體（`novelty_src` 標記）parents 空為合法，§4.5）、elements∈ELEMENTS、operator∈六算子（實作：比對前先剝 '(' 後綴參數——`reset(E<x>,E<y>)` 帶參記法裸字串集合比對必誤殺）、descriptor 三軸齊 | 100% 欄位完整，可回溯至 element×variable×function；另核 run-log `elements:N`∈[5,15]（§7 冷啟動範圍；無該行時以 ELEMENTS.md 實體計數 fallback） | 驗證器 2「可回溯」 | ☐ 證據：`<檢查輸出>` |
| 12.4 | **T4 缺欄演練**：對 run-log 檢查六必填欄（輪次/相位/重複率/兩段結論/選擇理由/參數版本） | 零缺欄；演練時故意刪一欄重走補救路徑 | 內部品質閘 | ☐ 證據：`<演練記錄>` |
| 12.5 | **V3 結構自查**：`test -f` SKILL.md；frontmatter name/description 齊；無 references 斷鏈（單檔——改驗 ei-archive 三檔存在＋jsonl 可 parse＋歷史列 diff 不變） | 全過；即驗證器 1＋3 | 驗證器 1、3 | ☐ 證據：`<指令輸出>` |
| 12.6 | **代理宣告抽查**：run-log 內任何數值宣稱須帶 [代理]/[實算] 標記或「設計假說」字樣 | 無裸數值宣稱；H 值變更皆具參數版本列 | 內部誠實閘 | ☐ 證據：`<抽查列>` |
| 12.7 | **對照組**：同任務直接叫「給我 N 個新點子」一次，比 (a) cell 覆蓋率 (b)誠實重複率 (c)可溯源比例 (d)對照輪突破 | 覆蓋率與可溯源勝出，重複率不多於對照；敗任一項記錄敗因不掩飾 | 內部對照閘 | ☐ 證據：`<10-tests/ 記錄表>` |
| 12.8 | **優質互異核心數【觀察期→K=5 硬門】**：對照輪與 skill 輪各算品質過濾後最大互異團。過濾：φ1＝novelty pass（§4.2 判定；退化義＝僅驗新穎未驗益，須標註）；φ2/φ3＝另加無 critic 否決。互異邊＝誠實計數「真不同」（同 cell 同簇不連；簇重構 R1：共享 parent 或一直鏈，近似已標註）；核心＝確定性貪心極大團（id 升冪）。兩側同尺同序。工具：`13-deploy-verify/yield-cores/yield_cores.py`（skill 外，§13.2 合規） | 觀察期：run-log 僅記 `cores S:x/B:y`，不構成 12.7 通過條件。N/A 判準（操作化）：B 清單缺檔／列數<2／S kept=0 任一；N/A 輪 run-log 留 `cores N/A` 痕跡，不入序列亦不重置。升格：連續 5 次真 run S≥B **含平手**（乾跑校準同 N/A；S<B 重置計數）→ 屆時本行通過條件改為硬門 S≥B（含平手，明文）並記參數版本 | 內部對照閘（觀察） | ☐ 證據：`<cores S/B 列>` |

勾選模板（每輪複製到 run-log 尾，逐項填證據後才算驗收完成）：

```text
- [ ] 12.1 裸執行×2 各≥10、無種子｜證據：
- [ ] 12.2 重複率<50%（跨run亦比）｜證據：
- [ ] 12.3 trace 100% 可溯源｜證據：
- [ ] 12.4 T4 演練零缺欄｜證據：
- [ ] 12.5 結構自查全過（test -f=0／frontmatter齊／無斷鏈／jsonl可parse／歷史列diff不變）｜證據：
- [ ] 12.6 無裸數值；H變更具版本列｜證據：
- [ ] 12.7 對照組四指標；敗則記敗因｜證據：
- [ ] 12.8 優質互異核心數（觀察期；連續 5 真run S≥B 始升格）｜證據：`cores S:x/B:y`
```

12.5 執行指令（部署後；draft 驗證同構，路徑換為 draft 目錄）：

```bash
test -f <本skill基底目錄>/emergent-complexity/SKILL.md; echo exit=$?   # DSH: 基底目錄=注入 content 中 <skill_resources> 的 base-directory;其他環境: ~/.hermes/profiles/mentor/skills/
python3 - <<'EOF'
import json,re,hashlib,subprocess
p='ei-archive/ideas.jsonl'
rows=[json.loads(l) for l in open(p) if l.strip()]          # jsonl 可 parse
pre=hashlib.md5(open(p,'rb').read()).hexdigest()            # 歷史列 diff：重跑前後
print('rows',len(rows),'md5',pre)                            # 重跑後取共同前綴 diff，須不變
EOF
```

結果 append run-log＋參數版本。
歷史列判準（明文化，補自 draft-A §12.5）：重跑前 `md5 ideas.jsonl`；跑後僅允許新增列，既有列一字不改（append-only 驗證）。


## §13 無 runtime 降級條款＋逃生艙

1. **無 runtime 降級**：九步程序不得因環境/模型限制跳步、併步或簡化；失敗一律走 §9 處置表。唯一允許的自適應＝§10 H 值調校（須留痕）。
   - 環境性例外（非調校；補自 draft-A §13.1）：確無檔案寫入能力時，九步得於單輪 context 內執行，並須宣告「降級模式：無持久化，重複率不跨輪」；此模式不得宣稱通過 §12.5（無檔可驗；md5/parse 等無需寫入之檢查仍應照算，僅重跑 diff 與跨輪項豁免）。
2. **唯一結構性逃生艙**：本檔超 500 行時，僅允許把 §2 憑據表外移 `references/claims.md`（13 條逐字照抄 council-1 §3），本檔留指針「憑據見 references/claims.md，P#n」；此為唯一允許的新檔，且須在 run-log 記錄切換。除此之外不得增檔。

## progress log

- 2026-10-18 builder C（防呆）：唯一依據 council-2 PART 2 §2.2–2.15；tools-mcp 裁決 1（§10 k 雙值＋§4.1 實算對拍指針）與裁決 2（§11 一字不改）已併；part-d 鉤子定稿 10 行整塊嵌為 §4.2（唯一規則載體，無兩套並存）。防呆強化：§9 測法欄全可執行＋F5 SOP、§12 勾選欄模板、§4.2 占位/重置二防呆註。
- selftest（生成核心 run 1 實跑）產物：`selftest/{ideas.jsonl,grid.md,run-1.md,verify_run1.py}`；結構自查輸出附加於 run-1.md 尾。
- 2026-10-18 step8 chair（合併）：base＝skill-C 全文逐字保留；graft 僅二處（draft-A §12.5 append-only 明文→本節尾；draft-A §13.1 誠實降級→§13.1 子列）。skill-b/skill-D 節段經比對同構或屬變體，未併入；取捨全文見 08-merged/merge-log.md。
- 補 §4 步 2 parent 選擇規則：1-op 空鄰 cell 數降序、tie 依 operator 結構異質性（rewire/promote 先）；重置個體豁免。標 [代理] 啟發式，非驗收項。
- 2026-10-25 C 合併（經 ambition-harness，使用者令 k=5）：增 §12.8 觀察期——Yield 骨架移植（品質過濾＋貪心互異團、兩側同尺；不借 60/20 刻度、不加修繕階、不新增評審）；§2/§10/§12.1–12.7 未動；§13.2 合規（skill 內零新檔，工具置 13-deploy-verify/yield-cores/）。乾跑（φ1 退化義）S 側：run-1 cores=10/10、run-2 cores=6/10、selftest kept=12 cores=10（2 對同簇保留者現形）；B 側無歷史資料＝UNVERIFIED，K 計數待真 run。
- 2026-10-25 盲審回環（harness judge，ctx-agent 盲審）：Q2 FAIL×2＋Q3 FAIL×3→五修全落地——φ2/3 過濾套入 auto 模式（phi_eff）、B 無 selection 全數入圖（kept 0→3/3）、N/A 操作化判準＋run-log 留痕、硬門含平手明文＋K=5 入 §10 H 列、B 側無 parents 不對稱 docstring 註。重驅：selftest PASS、10/6/kept12 逐位不變。claims 7 條 rc=0（6 PASS＋C7 UNVERIFIED）；checkpoint② 待使用者簽。
- 2026-11-01 首次真跑（跨 repo 整合發想，2 輪 φ1）：12 候選全異 cell、重複率 0%；規則 2 改腳本機械判定（dict 計數）。§12 驗收清單真跑未逐項執行（僅結構面自檢）；§12.8 cores 未計算。
- 2026-11-01 防呆補釘（medaesthetics run1 踩雷）：§4 步4 assert 腳本落盤執行、§12.3 operators 剝參比對。
