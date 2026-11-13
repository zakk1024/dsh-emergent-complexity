// dsh-emergent-complexity — host tools: ei_audit / ei_census / ei_archive_reset
// Read-only by default; only explicit write:true touches files.
//
// Shape support (both):
// - seed/legacy ideas.jsonl lines: {id, zone, type, descriptor:"a, b, c", body:"…", ops:[…], status:"active|deleted"}
// - §5 trace lines: {id:"I3-04", run, seq, tree:{elements:[…], parents:[…]}, operators:[…], descriptor:{scale,mechanism,context}, claim, body, novelty_src, usefulness_src, selection, phase}
// - grids: 3-col `| id或(cell) | (cell)或descriptor | ops |` and legacy 4-col `| id | claim | paradigm | ops |`;
//   cell keys may be parenthesised (承重,反重力,pillar) or bare comma lists (反重力, 柱, 承重).
// Run logs live in <archive>/ei-runs/ (bundle layout), sibling ei-runs/, or legacy ../run-log/.

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';

// §5 trace-line required keys (checked on new-shape lines only).
const IDEA_COLUMNS = ['id', 'run', 'seq', 'tree', 'operators', 'descriptor', 'claim', 'body', 'novelty_src', 'selection', 'phase'];
// legacy seed-shape required keys.
const IDEA_COLUMNS_LEGACY = ['id', 'zone', 'type', 'descriptor', 'body', 'ops', 'status'];
// Run-log six-column header (§12.4: | 轮次 | 相位 | 重复率 | 结论① | 结论② | 选择理由 | 参数版本 |);
// six-column check runs per table; legacy spellings (去重/理由/hash8) are accepted synonyms.
const RUNLOG_COLUMNS = ['轮次', '相位', '重复率', '结论①', '结论②', '选择理由', '参数版本'];
const RUNLOG_SYNONYMS = { '重复率': ['去重', 'duplicates_removed'], '选择理由': ['理由', 'rationale'], '参数版本': ['hash8', 'params_hash'] };

function looksLikeGlued(line) {
  return line.includes('}{"id"') || line.includes('} {');
}

// A glued line (}{"id" / } {) is a broken line by F5 definition — never parsed
// for live/dead accounting, only reported / quarantined.
function parseJsonAt(s) {
  try {
    const obj = JSON.parse(s);
    return typeof obj === 'object' && obj !== null ? obj : null;
  } catch { /* glued line or trailing garbage — fall through */ }
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { if (inStr) esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1));
    return typeof obj === 'object' && obj !== null ? obj : null;
  } catch { return null; }
}

// ── id-like token scanning (idea ids, element ids F27/E02/T41…, vars Z1-X…) ──
const GRID_ID_RE = /(?<![\w.\-])(?:I\d+-\d+|E-\d+(?:-\d+)?(?:\.\d+)?|E-[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9.]+)*|E\d+(?![.\d])|[A-Z]\d+\.\d+-[A-Za-z][\w.:-]*|[A-Z]\d+-[A-Za-z]\d+|[A-Z]\d+(?![.\d]))(?![\w.\-])/g;
function collectIdRefs(text) {
  const freq = new Map();
  if (!text) return freq;
  GRID_ID_RE.lastIndex = 0;
  let m;
  while ((m = GRID_ID_RE.exec(text)) !== null) freq.set(m[0], (freq.get(m[0]) ?? 0) + 1);
  return freq;
}

// ── grid.md table parser (both shapes, header/separator rows skipped) ──
// Returns [{id, cell, body, ops}] — id = occupant/idea id, cell = descriptor key when present.
function parseGridRows(text) {
  const rows = [];
  if (!text) return rows;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const parts = t.split('|').map((s) => s.trim());
    const cells = parts.slice(1, -1);
    if (cells.length < 3 || cells.length > 5) continue;
    const first = cells[0];
    if (first === 'id' || first === 'cell' || first === 'cell 座標' || /^:?-{2,}:?$/.test(first)) continue;
    const clean = (x) => x.replace(/\s*⚠\s*$/, '').trim();
    let id = null, cell = null, body = '', opsStr = '';
    const cellLike = first.startsWith('(') || first.includes(',');
    if (cellLike) { // cell-first row: | (a,b,c) ⚠ | best_id ⚠ | ops… ⚠ | (optional parents col before ops)
      if (cells.length < 4) { id = cells[1]; body = first; opsStr = cells[2] ?? ''; }
      else { id = clean(cells[1]); body = first; opsStr = cells[cells.length - 1]; }
      cell = first.replace(/^\(|\)$/g, '');
    } else { // id-first row: legacy 3-col | id | descriptor ≤120⚠ | ops ⚠ | or 4-col id|body|paradigm|ops
      id = clean(first);
      if (cells.length === 3) { body = cells[1]; opsStr = cells[2]; }
      else { body = cells[1]; opsStr = cells[cells.length - 1]; }
    }
    if (!id) continue;
    const ops = opsStr.replace(/\s*⚠\s*$/, '').split(',').map((s) => s.trim()).filter((o) => o.length > 0 && o !== '—' && o !== '-');
    rows.push({ id, cell, body: body.trim(), ops });
  }
  return rows;
}

let _wd = null; // `workingDirectory` service, captured in apply()

async function sessionCwd(exec) {
  if (typeof exec?.cwd === 'string' && exec.cwd.length > 0) return exec.cwd;
  if (_wd && exec?.agent) {
    try {
      const c = typeof _wd.ensure === 'function' ? await _wd.ensure(exec.agent) : (typeof _wd.get === 'function' ? _wd.get(exec.agent) : null);
      if (typeof c === 'string' && c.length > 0) return c;
    } catch { /* no bound directory */ }
  }
  return null;
}

// ── path resolution ──────────────────────────────────────────────────────

async function statOrNull(p) {
  try { return await stat(p); } catch { return null; }
}

// Locate the archive root. Explicit absolute root wins outright; relative /
// default roots are tried against session cwd, then $DSH_HOME (~/.dsh when
// DSH_HOME is unset), then ~/.dsh.
async function archiveRoots(exec, root) {
  const home = process.env.DSH_HOME || join(process.env.HOME || '', '.dsh');
  const cwd = (await sessionCwd(exec)) ?? home;
  const cands = [];
  const push = (p) => { if (p && !cands.includes(p)) cands.push(p); };
  const r = root ?? '';
  if (r.startsWith('~')) { push(r === '~' ? home : join(home, r.slice(1))); }
  else if (isAbsolute(r)) { push(r); }
  else if (r.length > 0) { push(join(cwd, r)); if (cwd !== home) push(join(home, r)); }
  else { push(join(cwd, 'ei-archive')); if (cwd !== home) push(join(home, 'ei-archive')); }
  for (const c of cands) {
    const s = await statOrNull(c);
    if (s?.isDirectory()) return { dir: c, exists: true };
  }
  return { dir: cands[0] ?? join(cwd, 'ei-archive'), exists: false };
}

// Run-log discovery: DSH bundle layout <archive>/ei-runs/, repo layout sibling
// ../ei-runs/, or legacy ../run-log/. First dir that EXISTS wins (empty →
// runLogDirEmpty so column checks report it instead of silently passing).
async function findRunLogs(archiveDir) {
  const dirs = [join(archiveDir, 'ei-runs'), join(dirname(archiveDir), 'ei-runs'), join(dirname(archiveDir), 'run-log')];
  for (const runDir of dirs) {
    let names = [];
    try { names = (await readdir(runDir)).sort(); } catch { continue; }
    const files = names.filter((n) => (n.startsWith('run-') || n.startsWith('run_')) && n.endsWith('.md')).map((n) => join(runDir, n));
    if (files.length > 0) return { files, emptyDir: false };
    return { files: [], emptyDir: true, dir: runDir }; // dir exists but holds no run-*.md
  }
  return { files: [], emptyDir: false };
}

// §12.4 six-column header check, PER TABLE (every pipe-table block's header row
// checked on its own; 7-cell split guard rejects short headers). Returns a
// problems array: {kind:'format_error'} / {kind:'missing_columns', missing[]}.
function runLogColumns(content) {
  const lines = content.split('\n');
  const problems = [];
  let seenTable = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) continue;
    let j = i;
    while (j < lines.length && lines[j].trim().startsWith('|')) j++;
    const block = lines.slice(i, j).map((l) => l.trim());
    i = j - 1;
    seenTable = true;
    const header = block[0];
    const cells = header.split('|').map((s) => s.trim());
    const missing = RUNLOG_COLUMNS.filter(
      (c) => !header.includes(c) && !(RUNLOG_SYNONYMS[c] ?? []).some((s) => header.includes(s)),
    );
    if (!header.includes('轮次')) problems.push({ kind: 'format_error', header: header.slice(0, 60) });
    else if (missing.length > 0 || cells.length < 9) problems.push({ kind: 'missing_columns', missing, header: header.slice(0, 60) });
  }
  if (!seenTable) return { present: false, formatOk: false, problems: [{ kind: 'format_error', header: null }] };
  return { present: true, formatOk: problems.length === 0, problems };
}

// ── one-shot archive state read (shared by audit + census + reset) ──────

async function readArchive(dir) {
  const jsonlPath = join(dir, 'ideas.jsonl');
  const gridPath = join(dir, 'grid.md');
  const elementsPath = join(dir, 'elements.md');
  let jsonlExists = false;
  const liveIds = new Set();   // present in jsonl and not removed (no op/missing = legacy live)
  const deadIds = new Set();   // explicitly removed (op:"delete" / status:"deleted")
  const badLines = [];         // parse failures + glued lines → {file, line, preview, glued}
  const emptyRows = [];        // rows without a usable id
  let rawIdeas = '';
  if (await statOrNull(jsonlPath)) {
    jsonlExists = true;
    rawIdeas = await readFile(jsonlPath, 'utf8');
    rawIdeas.split('\n').forEach((line, i) => {
      if (line.trim() === '') return;
      const trimmed = line.trim();
      if (looksLikeGlued(trimmed)) { badLines.push({ file: 'ideas.jsonl', line: i + 1, preview: line.slice(0, 80), glued: true }); return; }
      const obj = parseJsonAt(trimmed);
      if (!obj || typeof obj.id !== 'string' || obj.id.length === 0) { badLines.push({ file: 'ideas.jsonl', line: i + 1, preview: line.slice(0, 80), glued: false }); return; }
      if (obj.op === 'delete' || obj.status === 'deleted') deadIds.add(obj.id);
      else liveIds.add(obj.id);
      if (!Array.isArray(obj.ops) && !Array.isArray(obj.operators)) emptyRows.push({ file: 'ideas.jsonl', line: i + 1, detail: 'no ops/operators column' });
    });
  }
  const grid = (await statOrNull(gridPath)) ? await readFile(gridPath, 'utf8') : '';
  const elements = (await statOrNull(elementsPath)) ? await readFile(elementsPath, 'utf8') : '';
  return { jsonlExists, rawIdeas, liveIds, deadIds, badLines, emptyRows, grid, elements };
}

// F6/F5 ghost check: ids written into grid.md / ELEMENTS.md that have no LIVE
// ideas.jsonl entry (absent entirely, or net-deleted). Per §12.3/F6 the grid
// row's best-id column and ELEMENTS cell headings are scanned; element-style
// refs (F27/E02/T41…) are counted by duplication() instead.
function ghostIds(arch) {
  const ghosts = [];
  const seen = new Set();
  const isGhost = (id) => !arch.liveIds.has(id) || (arch.deadIds.has(id) && !arch.liveIds.has(id));
  const reason = (id) => (arch.deadIds.has(id) && !arch.liveIds.has(id)
    ? 'net-deleted in ideas.jsonl (op:"delete"/status:"deleted") but still referenced'
    : 'written in grid.md / ELEMENTS.md but absent from ideas.jsonl (F6 ghost)');
  for (const r of parseGridRows(arch.grid)) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    if (isGhost(r.id)) ghosts.push({ id: r.id, kind: 'never_written', cell: r.cell, reason: reason(r.id) });
  }
  for (const m of arch.elements.matchAll(/^##\s+(E\d+)\s*\|/gm)) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    if (isGhost(id)) ghosts.push({ id, kind: 'never_written', cell: null, reason: 'ELEMENTS.md cell heading with no live ideas.jsonl entry' });
  }
  return ghosts;
}

// §12.5/F2 cell occupancy + degraded cells: each grid row = one cell whose
// descriptor key is the parenthesised/bare triple; empty cells carry '—'.
// A cell is congested when it holds ≥2 ops-sets or any row lists >3 ops
// (also treats cross-row duplicate ops strings as one degraded signal).
function occupancy(arch) {
  const rows = parseGridRows(arch.grid);
  const cells = {};       // cell key → {occupied: number, occupants: [id…], ops_sets: […]}
  let occupied = 0, empty = 0;
  for (const r of rows) {
    const key = (r.cell ?? r.id).replace(/^\(|\)$/g, '');
    if (!cells[key]) cells[key] = { occupied: 0, occupants: [], ops_sets: [] };
    const c = cells[key];
    if (r.id === '—' || r.id === '-' || r.id === '') { empty += 1; continue; }
    c.occupied += 1; occupied += 1;
    if (!c.occupants.includes(r.id)) c.occupants.push(r.id);
    c.ops_sets.push({ id: r.id, ops: [...r.ops] });
  }
  const ghosts = ghostIds(arch);
  let dominant = 0;
  const congestedCells = [];
  for (const [k, c] of Object.entries(cells)) {
    if (c.occupied >= 2) dominant += 1; // one cell >= half → F2 congestion signal
    const opsFlat = c.ops_sets.flatMap((o) => o.ops);
    const emptyOps = c.ops_sets.some((o) => o.ops.length === 0);
    const overOps = opsFlat.length / Math.max(1, c.ops_sets.length) > 3;
    const unique = new Set(opsFlat);
    const dupOps = opsFlat.length - unique.size;
    if (emptyOps || overOps || dupOps > 0) congestedCells.push({ cell: k, occupied: c.occupied, reason: emptyOps ? 'empty operators column → ⚠ degraded (F7)' : overOps ? `>3 ops in cell (avg ${Math.round((opsFlat.length / c.ops_sets.length) * 10) / 10}/row)` : dupOps > 0 ? `duplicate ops string (×${dupOps + 1}) → ⚠ degraded, keep per §12.5` : 'empty operators column → ⚠ degraded (F7)' });
  }
  return { cells, occupied, empty, ghost_occupied: ghosts, congestedCells, dominant };
}

// §12.2/§12.5 honest duplication: ρ̂ = (refs − distinct ids)/refs across
// grid.md + ELEMENTS.md; clusters = ids referenced ≥2× (cross-cell reuse).
function duplication(arch) {
  const freq = collectIdRefs(arch.grid + '\n' + arch.elements);
  let total = 0;
  for (const c of freq.values()) total += c;
  const distinct = freq.size;
  const dups = [...freq.entries()].filter(([, c]) => c >= 2);
  const rate = total === 0 ? 0 : Number(((total - distinct) / total).toFixed(4));
  return {
    total,
    cross_cell_dups: dups.length,
    rate,
    dup_clusters: dups.slice(0, 50).map(([id, c]) => ({ id, count: c })),
    verdict: total === 0 ? 'no refs (empty grid/ELEMENTS)' : rate > 0.5 ? 'red — 重複率 >50%，觸發 F2 去重或改軸' : 'clean',
  };
}

// ── ei_audit ─────────────────────────────────────────────────────────────

const ei_audit = {
  name: 'ei_audit',
  description:
    'Emergent Complexity 档案完整性稽核。modes: "corrupt" 检测 ideas.jsonl 坏行（parse 失败或黏连行 }{"id" / } {）' +
    '与 ghost id（grid.md/ELEMENTS.md 写了但 ideas.jsonl 没有/已删除的 id，§12.3/F6）; "missing" 检查 jsonl 缺必填栏位' +
    '（新 §12.3 五元组键与旧 seed 格式两套）与 run log 每表的 §12.4 六栏表头/表格格式（缺栏或假表头= format_error）; ' +
    '"bloat" 统计 grid.md cell 占用与退化 op 列（每行 >3 ops 或重复 ops → degraded）。' +
    '默认只读;corrupt 配 write:true 才备份坏行到 <archive>/../ei-runs/ideas.jsonl.broken-<ts> 并从 ideas.jsonl 移除（F5）。' +
    '档案位置: 相对 root 以 session cwd → $DSH_HOME 解析;也接受绝对路径。缺档回报 missing 而非 error。',
  parameters: {
    root: { type: 'string', description: 'Archive location: repo-root-relative (e.g. "ei-archive"), absolute, or "~"-prefixed; default "ei-archive"' },
    modes: { type: 'array', items: { type: 'string', enum: ['missing', 'corrupt', 'bloat'] }, required: true, description: 'Audit modes to run, default ["corrupt"]. Run "bloat" on its own or append it to modes as an alert.' },
    write: { type: 'boolean', description: 'Corrupt mode only: true = backup quarantined file to ../ei-runs/ideas.jsonl.broken-<ts> and strip glued lines (default false = audit-only)' },
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  },
  async execute(args, exec) {
    const modes = Array.isArray(args.modes) ? args.modes : ['corrupt'];
    const root = typeof args.root === 'string' && args.root.trim() !== '' ? args.root.trim() : '';
    const write = args.write === true || String(args.write).toLowerCase() === 'true';
    const { dir, exists } = await archiveRoots(exec, root);
    if (!exists) {
      return {
        root: dir, exists: false,
        missing: { jsonl_exists: false, grid: false, cells: {} },
        bloat: { grid_row_count: 0, bloat_rows: 0, note: 'archive root not found (nothing to audit); tried cwd, $DSH_HOME, ~/.dsh' },
        corrupt: { bad_lines: [], ghost_occupied: [] },
        missing_columns: { ideas: [], run_logs: [] },
      };
    }
    const arch = await readArchive(dir);
    const gridRows = parseGridRows(arch.grid);

    const out = {
      root: dir,
      missing: { jsonl_exists: arch.jsonlExists, grid: (await statOrNull(join(dir, 'grid.md'))) !== null, cells: {} },
      bloat: { grid_row_count: gridRows.length, bloat_rows: 0, note: null },
      corrupt: { bad_lines: [], ghost_occupied: [] },
      missing_columns: { ideas: [], run_logs: [] },
    };

    // ── bloat (F2/F7 alert): per-cell occupancy + degraded ops columns ──
    const occ = occupancy(arch);
    out.bloat.cells = occ.cells;
    out.bloat.cells_over_50pct = occ.dominant;
    out.bloat.degraded_cells = occ.congestedCells.map((c) => `[${c.cell}] ${c.reason}`);
    out.bloat.degraded = occ.congestedCells.length > 0;
    if (gridRows.length === 0 && arch.rawIdeas.trim() !== '') {
      out.bloat.note = 'grid.md has no parsable rows while ideas.jsonl is non-empty — refusing to treat grid as clean (rebuild with ei_archive_reset)';
    }

    // ── corrupt (F5/F6): glued/broken lines + ghost ids; write:true quarantines ──
    if (modes.includes('corrupt')) {
      out.corrupt.bad_lines = arch.badLines;
      out.corrupt.ghost_occupied = ghostIds(arch);
      if (write) {
        const glued = arch.rawIdeas.split('\n').filter((l) => looksLikeGlued(l));
        if (glued.length > 0) {
          const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '');
          const backupName = `ideas.jsonl.broken-${ts}`;
          try {
            const runDir = join(dirname(dir), 'ei-runs');
            await mkdir(runDir, { recursive: true });
            await writeFile(join(runDir, backupName), arch.rawIdeas, 'utf8');
            const fixed = arch.rawIdeas.split('\n').filter((l) => !looksLikeGlued(l)).join('\n');
            await writeFile(join(dir, 'ideas.jsonl'), fixed, 'utf8');
            out.corrupt.quarantined = join(dirname(dir), 'ei-runs', backupName);
            out.corrupt.glued_lines_stripped = true;
          } catch (e) {
            out.corrupt.quarantine_failed = true;
            out.corrupt.quarantine_error = e instanceof Error ? e.message : String(e);
          }
        }
      }
    }

    // ── missing columns (audit-only, never rewrite): jsonl rows + run-log tables ──
    if (modes.includes('missing')) {
      for (const line of arch.rawIdeas.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || looksLikeGlued(trimmed)) continue;
        const o = parseJsonAt(trimmed);
        if (!o || typeof o.id !== 'string') continue;
        const isNew = (o.descriptor !== undefined && typeof o.descriptor === 'object') || o.operators !== undefined || o.tree !== undefined;
        const missing = isNew ? IDEA_COLUMNS.filter((k) => !Object.hasOwn(o, k)) : IDEA_COLUMNS_LEGACY.filter((k) => !Object.hasOwn(o, k));
        if (missing.length > 0) out.missing_columns.ideas.push({ file: 'ideas.jsonl', id: o.id, missing_columns: missing, ...(isNew ? {} : { legacy: true }) });
      }
      const rl = await findRunLogs(dir);
      if (rl.emptyDir) {
        out.missing_columns.run_logs.push({ file: join(dir, '..', 'ei-runs'), error: 'format_error', detail: 'run-log dir empty or without run-*.md (missing table structure, §12.4)' });
      }
      for (const f of rl.files) {
        const content = await readFile(f, 'utf8').catch(() => '');
        if (content.length === 0) { out.missing_columns.run_logs.push({ file: f, error: 'format_error', header: null }); continue; }
        const res = runLogColumns(content);
        for (const p of res.problems) {
          if (p.kind === 'format_error') out.missing_columns.run_logs.push({ file: f, error: 'format_error', header: p.header });
          else out.missing_columns.run_logs.push({ file: f, missing_columns: p.missing ?? [], header: p.header });
        }
      }
    }

    return out;
  },
};

// ── ei_census ────────────────────────────────────────────────────────────

const ei_census = {
  name: 'ei_census',
  description:
    'Emergent Complexity 档案库统计，不改任何东西。occupancy: grid.md 每 cell(descriptor 三元组，附括号或裸逗号) 的占用数、' +
    '空 cell(—)、ghost cell(id 被 grid/ELEMENTS 引用但 jsonl 没有/净删) 与 congested cell(>3 ops 或重复 ops，§12.5)。' +
    'duplication: ρ̂=(引用总数−不同 id 数)/引用总数（grid+ELEMENTS 的 id 类 token 密度，>50% 标 red 建议 F2/改轴）。' +
    'columns: run log 每表六栏表头格式检查（§12.4）。档案/日志路径与 ei_audit 相同（相对 root: cwd → $DSH_HOME → ~/.dsh）。',
  parameters: {
    root: { type: 'string', description: 'Archive location, default "ei-archive"; relative roots tried against session cwd then $DSH_HOME (~/.dsh). Run logs resolved as <archive>/ei-runs → sibling ../ei-runs → legacy ../run-log.' },
    modes: { type: 'array', items: { type: 'string', enum: ['occupancy', 'duplication', 'columns'] }, required: true, description: 'Census modes to run, default ["occupancy"].' },
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  },
  async execute(args, exec) {
    const modes = Array.isArray(args.modes) ? args.modes : ['occupancy'];
    const root = typeof args.root === 'string' && args.root.trim() !== '' ? args.root.trim() : '';
    const { dir, exists } = await archiveRoots(exec, root);
    if (!exists) {
      return {
        root: dir, exists: false,
        occupancy: { total_occupied: 0, total_empty: 0, total_ghosts: 0, total_congested: 0, cells: {}, ghosts: [], congested_cells: [] },
        duplication: { total: 0, cross_cell_dups: 0, rate: 0, dup_clusters: [], verdict: 'no archive root (tried cwd, $DSH_HOME, ~/.dsh)' },
        columns: { present: 0, total: 0, rate: 0, missing_files: [] },
      };
    }
    const arch = await readArchive(dir);
    const occ = occupancy(arch);

    const out = {
      root: dir,
      occupancy: {
        occupancy: Number((occ.occupied / 252).toFixed(2)),
        total_occupied: occ.occupied,
        total_empty: occ.empty,
        total_ghosts: occ.ghost_occupied.length,
        total_congested: occ.congestedCells.length,
        cells: occ.cells,
        ghosts: occ.ghost_occupied,
        congested_cells: occ.congestedCells.map((c) => c.cell),
      },
      duplication: duplication(arch),
      columns: { present: 0, total: 0, rate: 0, missing_files: [] },
    };

    if (modes.includes('columns')) {
      let present = 0, total = 0;
      const missing = [];
      const rl = await findRunLogs(dir);
      for (const f of rl.files) {
        total += 1;
        const content = await readFile(f, 'utf8').catch(() => '');
        const res = runLogColumns(content);
        for (const p of res.problems) {
          if (p.kind === 'format_error') missing.push({ file: f, error: 'format_error', header: p.header });
          else missing.push({ file: f, missing_columns: p.missing ?? [], header: p.header });
        }
        if (res.formatOk === true) present += 1;
      }
      const rate = total === 0 ? 0 : Number((present / total).toFixed(4));
      out.columns = { present, total, rate, missing_files: missing };
    }

    return out;
  },
};

// ── ei_archive_reset ─────────────────────────────────────────────────────

const ei_archive_reset = {
  name: 'ei_archive_reset',
  description:
    'Emergent Complexity 档案库重建 — 重建 grid.md（所有格）。两种 mode：' +
    '"all"（默认）重建 grid.md（每格取最长 body 当 best，>120 chars 标 ⚠，重复或 >3 ops 的 ops 列标 ⚠）；' +
    '"degraded"＝F5 应急：先把黏连/坏行备份到 <archive>/../ei-runs/ideas.jsonl.broken-<ts> 并从 ideas.jsonl 移除，再重建 grid.md；' +
    'degraded 默认只报告，必须显式 write:true 才隔离坏行并重建（防误触抹掉 grid.md）。' +
    '重建安全阀: jsonl 无 live 条目时拒绝写出空 grid.md（回报 no live ideas; grid.md untouched）。' +
    '本工具供手动重建（§8 step 6 / F5）与独立环境使用; 支持新 §12.3 五元组与旧 seed 两套 jsonl 格式。',
  parameters: {
    root: { type: 'string', description: 'Archive location, default "ei-archive"; relative roots are tried against session cwd, then $DSH_HOME (~/.dsh)' },
    mode: { type: 'string', enum: ['all', 'degraded'], description: 'Rebuild mode, default all' },
    write: { type: 'boolean', description: 'Report-only unless explicitly true. "all" rebuilds grid.md directly; "degraded" needs write:true to quarantine bad lines + rebuild (prevents accidental wipes).' },
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  },
  async execute(args, exec) {
    const mode = args.mode === 'degraded' ? 'degraded' : 'all';
    const root = typeof args.root === 'string' && args.root.trim() !== '' ? args.root.trim() : '';
    const write = args.write === true || String(args.write).toLowerCase() === 'true'; // default OFF: omit/false → report-only
    const writeOn = write === true || String(write).toLowerCase() === 'true';
    const { dir, exists } = await archiveRoots(exec, root);
    if (!exists) {
      return { root: dir, mode, ok: false, error: `archive root not found: ${dir} (tried cwd, $DSH_HOME, ~/.dsh)` };
    }
    if (mode === 'degraded' && !writeOn) {
      return { root: dir, mode, ok: false, error: 'degraded dry-run (call again with write:true to quarantine bad lines + rebuild grid.md)' };
    }

    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '');
    const notes = [];

    // degraded (F5): quarantine glued/broken lines first, then rebuild from the rest
    let arch = await readArchive(dir);
    if (mode === 'degraded' && arch.badLines.length > 0) {
      const backupName = `ideas.jsonl.broken-${ts}`;
      const runDir = join(dirname(dir), 'ei-runs');
      try {
        await mkdir(runDir, { recursive: true });
        await writeFile(join(runDir, backupName), arch.rawIdeas, 'utf8');
        const fixed = arch.rawIdeas.split('\n').filter((l) => !looksLikeGlued(l)).join('\n');
        await writeFile(join(dir, 'ideas.jsonl'), fixed, 'utf8');
        notes.push(`quarantined → ${join(dirname(dir), 'ei-runs', backupName)}`);
        arch = await readArchive(dir); // re-read after quarantine
      } catch (e) {
        notes.push(`quarantine failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // rebuild grid.md: best body per cell = longest live body (§12.5 重建句)
    const cells = new Map(); // cell key → {best, all}
    for (const line of arch.rawIdeas.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      const o = parseJsonAt(trimmed);
      if (!o || typeof o.id !== 'string') continue;
      if (o.op === 'delete' || o.status === 'deleted') continue; // removed entry does not occupy a cell
      const body = typeof o.body === 'string' ? o.body : (typeof o.claim === 'string' ? o.claim : '');
      const opsArr = Array.isArray(o.ops) ? o.ops : Array.isArray(o.operators) ? o.operators : [];
      const ops = opsArr.filter((x) => typeof x === 'string');
      let cellKey = null;
      if (Array.isArray(o.descriptor)) cellKey = o.descriptor.map((x) => String(x).trim()).join(',');
      else if (o.descriptor && typeof o.descriptor === 'object') cellKey = ['scale', 'mechanism', 'context'].map((k) => String(o.descriptor[k] ?? '').trim()).join(',');
      else if (typeof o.descriptor === 'string') cellKey = o.descriptor.replace(/^\(|\)$/g, '');
      else if (typeof o.zone === 'string' && typeof o.type === 'string') cellKey = `${o.zone},${o.type}`; // legacy seed → descriptor fallback "zone,type"
      if (!cellKey || cellKey.replace(/,/g, '') === '') continue;
      cellKey = `(${cellKey})`;
      if (!cells.has(cellKey)) cells.set(cellKey, { best: null, rows: [] });
      const entry = cells.get(cellKey);
      entry.rows.push({ id: o.id, body, ops });
      if (!entry.best || body.length > (entry.best.body?.length ?? -1)) entry.best = { id: o.id, body, ops };
    }
    const rows = [];
    for (const [cellKey, { rows: group }] of cells) {
      const ids = [...new Set(group.map((r) => r.id))];
      const best = group.reduce((a, b) => (b.body.length > a.body.length ? b : a));
      const bodyMark = best.body.length > 120 ? ' ⚠' : '';
      const opsFlat = group.flatMap((r) => r.ops);
      const opsSet = new Set(opsFlat);
      const degraded = opsFlat.length - opsSet.size > 0 || opsFlat.length / group.length > 3;
      const opsStr = [...opsSet].join(', ') + (degraded ? ' ⚠' : '');
      rows.push(`| ${cellKey} | ${ids.join(', ')}${bodyMark} | ${opsStr || '—'} |`);
    }
    if (rows.length === 0) {
      return { root: dir, mode, ok: false, error: `no live ideas (0 cells) — rebuilt grid.md would be empty; grid.md untouched${notes.length > 0 ? `; ${notes.join('; ')}` : ''}`, grid_rows: 0, notes };
    }
    const content = '# Emergent Complexity — grid (rebuilt by ei_archive_reset)\n' +
      `# rebuilt: ${ts}\n\n| cell | id (best occupant, ⚠ >120c) | operators (dup/>3 → ⚠, keep all) |\n|------|--------------------------|-----------------------------------|\n` + rows.join('\n') + '\n';
    const gridPath = join(dir, 'grid.md');
    await writeFile(gridPath, content, 'utf8');
    notes.push('grid.md rebuilt from ideas.jsonl live entries');
    return { root: dir, mode, ok: true, grid_rows: rows.length, notes };
  },
};

export const name = 'emergent-complexity-tools';

/** Hard dependency: the Loader activates this row only when these services are ready. */
export const inject = ['tools', 'workingDirectory'];

const TOOLS = [ei_audit, ei_census, ei_archive_reset];

export function description() {
  return 'Emergent Complexity archive tools (ei_audit / ei_census / ei_archive_reset): read-only + guarded writes, re-run safe.';
}

/**
 * Register the three tools on the `tools` service and locate archive files via
 * exec.cwd (or the `workingDirectory` service), falling back to $DSH_HOME/~/.dsh.
 */
export function apply(ctx) {
  const tools = ctx.get('tools');
  if (tools === undefined || tools === null) {
    throw new Error('[dsh-emergent-complexity/tools] the `tools` service is missing in this profile; refusing to start without a tool registry');
  }
  try { _wd = ctx.get('workingDirectory') ?? null; } catch { _wd = null; }
  for (const t of TOOLS) {
    ctx.effect(
      () => tools.register(t),
      `emergent-complexity tools: ${t.name}`,
    );
  }
}
