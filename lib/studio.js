// dsh-emergent-complexity — Emergent Complexity Studio server
//
// A project-scoped web workbench for the emergent-complexity idea loop:
//   ei-archive/ elements + descriptor grid + trace archive   (the skill's ground truth)
//   ei-sources.json                                          (curated + user source pool)
//   ei-runs/run-N.md                                         (run log rows)
//
// Routes (all auth-gated except the static studio page):
//   GET  /api/emergent/studio      studio.html
//   GET  /api/emergent/state       project state (elements, axes, grid, ideas, sources, stats)
//   POST /api/emergent/sources     add / remove a source
//   POST /api/emergent/generate    deterministic trace-line generation into the archive
//   POST /api/emergent/search      escape hatch: live web search (DuckDuckGo Lite)
//
// Nothing here calls a model: generation is combinatorial and deterministic from the
// frozen element set + descriptor grid, exactly the supply half of the skill. Model work
// (critique, claim quality, selection arguments) stays in the agent session.

import { readFile, writeFile, mkdir, stat, readdir, rename, unlink, open } from 'node:fs/promises';
import { dirname, join, isAbsolute, resolve as pathResolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const STUDIO_HTML = join(PKG_DIR, 'assets', 'studio.html');
const SOURCE_PACK = join(PKG_DIR, 'assets', 'source-pack.json');
const CONFIG_FILE = join(homedir(), '.dsh', 'emergent-studio.json');

const ARCHIVE_DIR = 'ei-archive';
const RUNS_DIR = 'ei-runs';
const SOURCES_FILE = 'ei-sources.json';
const MAX_COUNT = 60;

const DEFAULT_AXES = {
  scale: ['nano', 'micro', 'meso', 'macro', 'system'],
  mechanism: ['phase-change', 'flow', 'field', 'chemical', 'mechanical', 'optical'],
  context: ['建築', '都市', '產品', '醫療', '能源', '製造'],
};

const STARTER_ELEMENTS = [
  ['E01', '水', '蒸發—凝結驅動相態改變', '相態'],
  ['E02', '熱', '溫差驅動熱流與蓄放', '溫差'],
  ['E03', '光', '光化學與光熱轉換', '波長'],
  ['E04', '風', '對流與壓力驅動的氣流', '流速'],
  ['E05', '鹽', '滲透壓與離子濃度', '濃度'],
  ['E06', '膜', '選擇性滲透與界面控制', '孔徑'],
  ['E07', '菌', '發酵與群落代謝', '菌密度'],
  ['E08', '電', '電解與電場驅動', '電壓'],
  ['E09', '聲', '共振與聲壓耦合', '頻率'],
  ['E10', '磁', '磁力耦合與場調控', '場強'],
];

const OPERATORS = ['substitute', 'add', 'drop', 'rewire', 'reparam', 'promote'];

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    const data = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    bytes += data.length;
    if (bytes > 4 * 1024 * 1024) throw Object.assign(new Error('request too large'), { status: 413 });
    chunks.push(data);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('invalid JSON body'), { status: 400 });
  }
}

async function requestRejection(ctx, req) {
  try {
    const connection = typeof ctx.get === 'function' ? ctx.get('connection') : undefined;
    if (!connection) return 503;
    if (typeof connection.admit === 'function') {
      const admission = await connection.admit(req);
      if (!admission || typeof admission !== 'object') return 503;
      if ('rejection' in admission) return admission.rejection === 401 ? 401 : 403;
      const peer = admission.peer;
      if (peer?.principal?.kind === 'owner') return undefined;
      if (peer && peer.principal) return undefined;
      return 403;
    }
  } catch {
    /* fall through */
  }
  return 503;
}

function rejectionText(status) {
  return status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'Host authentication unavailable';
}

function expandHome(p) {
  if (typeof p !== 'string' || !p) return p;
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}

async function resolveRoot(input) {
  let root = expandHome(typeof input === 'string' ? input.trim() : '');
  if (!root) {
    try {
      const cfg = JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
      root = expandHome(cfg.lastRoot || '');
    } catch {
      /* no config */
    }
  }
  if (!root) root = process.cwd();
  if (!isAbsolute(root)) root = pathResolve(root);
  const info = await stat(root).catch(() => null);
  if (!info || !info.isDirectory()) throw Object.assign(new Error(`project folder not found: ${root}`), { status: 404 });
  return root;
}

async function rememberRoot(root) {
  try {
    await mkdir(dirname(CONFIG_FILE), { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify({ lastRoot: root }, null, 2));
  } catch {
    /* best effort */
  }
}

function cellKey(cell) {
  return `${cell.scale}|${cell.mechanism}|${cell.context}`;
}

function cellText(cell) {
  return `(${cell.scale}, ${cell.mechanism}, ${cell.context})`;
}

// ---- archive parsing -------------------------------------------------------

function stripMarkdown(s) {
  return String(s).replace(/\*\*/g, '').replace(/`/g, '').replace(/\|/g, ' ').trim();
}

function parseAxes(text) {
  const axes = { scale: [], mechanism: [], context: [] };
  const keyOf = (raw) => {
    const k = String(raw).toLowerCase();
    return k === 'scale' || k === '尺度' ? 'scale' : k === 'mechanism' || k === '機制' ? 'mechanism' : 'context';
  };
  const take = (key, raw) => {
    const values = String(raw).split(/[|,，、;；]/).map((v) => stripMarkdown(v)).filter(Boolean);
    if (values.length && !axes[key].length) axes[key] = values.slice(0, 12);
  };
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s*(?:[-*]\s*)?(scale|尺度|mechanism|機制|context|情境|脈絡)\s*[:：]\s*(.+)$/i.exec(line);
    if (m) take(keyOf(m[1]), m[2]);
    // canonical: descriptor: scale(a,b) x mechanism(c,d) x context(e,f)
    if (/^\s*(?:[-*]\s*)?(?:descriptor|descriptors|座標|描述符)\s*[:：]/i.test(line)) {
      const body = line.replace(/^[^:：]*[:：]/, '');
      for (const part of body.split(/\s+x\s+|×/i)) {
        const mm = /(scale|尺度|mechanism|機制|context|情境|脈絡)\s*[（(=:：]\s*([^)）]+)/i.exec(part);
        if (mm) take(keyOf(mm[1]), mm[2]);
      }
    }
  }
  // fallback: any key=... declaration (ELEMENTS.md DESCRIPTOR lines)
  if (!axes.scale.length || !axes.mechanism.length || !axes.context.length) {
    for (const key of ['scale', 'mechanism', 'context']) {
      const mm = new RegExp(key + '\\s*[=:：]\\s*([^|\\n]+)', 'i').exec(text);
      if (mm) take(key, mm[1].replace(/[（(].*$/, ''));
    }
  }
  for (const key of ['scale', 'mechanism', 'context']) {
    if (!axes[key].length) axes[key] = DEFAULT_AXES[key];
  }
  return axes;
}

function parseElements(text) {
  const out = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const idMatch = /E\d{1,3}/.exec(line);
    if (!idMatch) continue;
    const id = idMatch[0];
    if (seen.has(id)) continue;
    seen.add(id);
    const table = line.split('|').map((c) => stripMarkdown(c)).filter(Boolean);
    const isTable = table.length >= 3 && table[0] === id;
    const rest = stripMarkdown(line.slice(idMatch.index + id.length)).replace(/^[-–—:：|]+/, '');
    const parts = isTable ? table.slice(1) : rest.split(/[|｜]/).map((p) => p.trim()).filter(Boolean);
    let noun = parts[0] || '';
    noun = noun.replace(/^[-–—:：]+/, '').trim();
    if (!noun) noun = id;
    if (noun.length > 24) noun = noun.slice(0, 24);
    let mechanism = parts[1] || '';
    let variable = parts[2] || '';
    if (!mechanism) {
      const idx = rest.indexOf('機制');
      if (idx >= 0) mechanism = rest.slice(idx).replace(/^機制[:：\s]*/, '').trim();
    }
    if (!variable) {
      const idx = rest.indexOf('變量');
      if (idx < 0) {
        const idx2 = rest.indexOf('变量');
        if (idx2 >= 0) variable = rest.slice(idx2).replace(/^[變变]量[:：\s]*/, '').trim();
      } else {
        variable = rest.slice(idx).replace(/^[變变]量[:：\s]*/, '').trim();
      }
    }
    if (variable.length > 24) variable = variable.slice(0, 24);
    out.push({ id, noun, mechanism, variable });
  }
  return out;
}

function parseGrid(text) {
  const cells = new Map();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|$/.test(line)) continue;
    const cols = line.split('|').slice(1, -1).map((c) => stripMarkdown(c));
    if (cols.length < 3) continue;
    if (/cell|格子|描述符|descriptor/i.test(cols[0]) && /id|想法/i.test(cols[1])) continue;
    let cellStr = '';
    let id = '';
    let ops = '';
    if (/^\(.*\)$/.test(cols[0])) {
      cellStr = cols[0].slice(1, -1);
      id = cols[1];
      ops = cols.length >= 4 ? cols[cols.length - 1] : cols[2];
    } else if (/^I\d+-\d+/.test(cols[0])) {
      id = cols[0];
      cellStr = cols[1];
      ops = cols[2];
    } else if (cols[0].includes(',')) {
      cellStr = cols[0];
      id = cols[1];
      ops = cols[2];
    } else {
      continue;
    }
    const parts = cellStr.split(',').map((p) => p.trim());
    if (parts.length !== 3) continue;
    const cell = { scale: parts[0], mechanism: parts[1], context: parts[2] };
    if (id && !/^(—|-|→|空|none)$/i.test(id)) {
      cells.set(cellKey(cell), { cell, id, ops });
    } else {
      cells.set(cellKey(cell), { cell, id: '', ops });
    }
  }
  return cells;
}

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function readArchive(root) {
  const dir = join(root, ARCHIVE_DIR);
  const elementsText = (await readText(join(dir, 'ELEMENTS.md'))) ?? (await readText(join(dir, 'elements.md')));
  const gridText = (await readText(join(dir, 'grid.md'))) ?? '';
  const ideasText = (await readText(join(dir, 'ideas.jsonl'))) ?? '';
  const elements = elementsText ? parseElements(elementsText) : [];
  const axes = parseAxes((elementsText || '') + '\n' + (gridText || ''));
  const cells = parseGrid(gridText);
  const ideas = [];
  for (const line of ideasText.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === 'object') ideas.push(obj);
    } catch {
      /* tolerate broken lines */
    }
  }
  return { dir, elementsText, elements, axes, gridText, cells, ideas };
}

async function writeElements(root, elements) {
  const dir = join(root, ARCHIVE_DIR);
  await mkdir(dir, { recursive: true });
  const lines = ['# ELEMENTS（5–15 個，開工前凍結）', '', '| id | 名詞 | 機制 | 可賦值 variable 槽 |', '| --- | --- | --- | --- |'];
  for (const e of elements) lines.push(`| ${e.id} | ${e.noun} | ${e.mechanism} | ${e.variable} |`);
  lines.push('', '## 描述符軸（studio 生成用；可自行改）', '');
  lines.push(`scale: ${DEFAULT_AXES.scale.join(' | ')}`);
  lines.push(`mechanism: ${DEFAULT_AXES.mechanism.join(' | ')}`);
  lines.push(`context: ${DEFAULT_AXES.context.join(' | ')}`);
  await writeAtomic(join(dir, 'ELEMENTS.md'), lines.join('\n') + '\n');
}

function gridTextFrom(cells, ideas = [], axes = null) {
  const rows = [...cells.values()].filter((c) => c.id).sort((a, b) => cellKey(a.cell).localeCompare(cellKey(b.cell)));
  const byId = new Map(ideas.map((i) => [String(i.id), i]));
  const lines = [];
  if (axes) {
    lines.push(`descriptor: scale(${axes.scale.join(',')}) x mechanism(${axes.mechanism.join(',')}) x context(${axes.context.join(',')})`, '');
  }
  lines.push('| cell | best id | par | ops |', '| --- | --- | --- | --- |');
  for (const row of rows) {
    const idea = byId.get(String(row.id));
    const parents = idea && idea.tree && Array.isArray(idea.tree.parents) ? idea.tree.parents.join(',') : '—';
    lines.push(`| ${cellText(row.cell)} | ${row.id} | ${parents || '—'} | ${String(row.ops || '—').split('+').join(',')} |`);
  }
  return lines.join('\n') + '\n';
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function maxRun(ideas) {
  let run = 0;
  for (const idea of ideas) {
    const n = Number(idea.run);
    if (Number.isFinite(n) && n > run) run = n;
  }
  return run;
}

function ideaIds(ideas) {
  return new Set(ideas.map((i) => String(i.id)));
}

function makeFuncs(ops, elements) {
  const funcs = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const e = elements[i % elements.length];
    if (op === 'substitute') funcs.push(`substitute(${elements[0].id}->${e.id})`);
    else if (op === 'add') funcs.push(`add(${e.id})`);
    else if (op === 'drop') funcs.push(`drop(${e.id})`);
    else if (op === 'rewire') funcs.push(`rewire(${elements[0].id}->${e.id})`);
    else if (op === 'reparam') funcs.push(`reparam(${e.id})`);
    else funcs.push(`promote(${e.id})`);
  }
  return funcs;
}

const GENERATION_QUEUE = new Map();

function serialized(key, fn) {
  const prev = GENERATION_QUEUE.get(key) ?? Promise.resolve();
  const next = prev.then(() => fn());
  GENERATION_QUEUE.set(key, next.then(() => {}, () => {}));
  return next;
}

async function generate(root, body) {
  const count = Math.max(1, Math.min(MAX_COUNT, Number(body.count) || 10));
  const seed = Number(body.seed) || Date.now() % 100000;
  const rng = mulberry32(seed);
  const archive = await readArchive(root);
  let elements = archive.elements;
  let createdElements = false;
  if (!elements.length) {
    elements = STARTER_ELEMENTS.map(([id, noun, mechanism, variable]) => ({ id, noun, mechanism, variable }));
    await writeElements(root, elements);
    createdElements = true;
  }
  const axes = archive.elements.length ? archive.axes : parseAxes('');
  const allCells = [];
  for (const scale of axes.scale) for (const mechanism of axes.mechanism) for (const context of axes.context) allCells.push({ scale, mechanism, context });
  const occupied = new Set(archive.cells.keys());
  const empty = allCells.filter((c) => !occupied.has(cellKey(c)));
  if (!empty.length) {
    return { ok: true, added: [], skipped: count, run: maxRun(archive.ideas) + 1, message: 'descriptor grid 已全滿，先擴軸或開新一輪', createdElements };
  }
  const run = maxRun(archive.ideas) + 1;
  const existingIds = ideaIds(archive.ideas);
  const bodies = new Set(archive.ideas.map((i) => String(i.body || '').slice(0, 40)));
  const added = [];
  let seq = 0;
  let dupSkipped = 0;
  const pool = shuffle(rng, empty);
  const wanted = Math.min(count, pool.length);
  const newCells = new Map(archive.cells);
  const pairKey = (a, b) => [String(a), String(b)].sort().join('|');
  const cooccur = new Set();
  for (const idea of archive.ideas) {
    const ids = Array.isArray(idea?.tree?.elements) ? idea.tree.elements : [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) cooccur.add(pairKey(ids[i], ids[j]));
  }
  let resetPair = null;
  if (archive.ideas.length && elements.length >= 2) {
    const pairs = [];
    for (let i = 0; i < elements.length; i++) for (let j = i + 1; j < elements.length; j++) pairs.push([elements[i], elements[j]]);
    resetPair = shuffle(rng, pairs).find(([a, b]) => !cooccur.has(pairKey(a.id, b.id))) || null;
  }
  const phaseFor = (r) => (r <= 2 ? 'phi1' : r <= 5 ? 'phi2' : 'phi3');
  const phase = phaseFor(run);
  for (let n = 0; n < wanted; n++) {
    const cell = pool[n];
    const reset = n === 0 && !!resetPair;
    const picked = reset
      ? [resetPair[0], resetPair[1]]
      : shuffle(rng, elements).slice(0, Math.min(elements.length, 2 + Math.floor(rng() * 2)));
    const ops = shuffle(rng, OPERATORS).slice(0, 1 + Math.floor(rng() * 3));
    const parents = [];
    if (!reset && archive.ideas.length) {
      const sharing = archive.ideas.filter((idea) => {
        const ids = idea?.tree?.elements || [];
        return Array.isArray(ids) && ids.some((id) => picked.some((p) => p.id === id));
      });
      if (sharing.length && rng() < 0.75) {
        parents.push(String(pick(rng, sharing).id));
      }
    }
    const vars = {};
    for (const e of picked) vars[e.id] = e.variable || e.noun;
    const opsText = ops.join('+');
    const claim = `${picked[0].noun}×${picked[1] ? picked[1].noun : picked[0].noun}：${cell.mechanism} 在${cell.context}中的${cell.scale}尺度組合`;
    const bodyText = `${picked.map((p) => p.noun).join('、')} 以 ${opsText} 互接，於 ${cell.scale} 尺度形成 ${cell.mechanism} 作用；可調 ${picked.map((p) => vars[p.id]).join('/')}。`;
    if (bodies.has(bodyText.slice(0, 40))) {
      dupSkipped += 1;
      continue;
    }
    seq += 1;
    const id = `I${run}-${String(seq).padStart(2, '0')}`;
    const idea = {
      id,
      run,
      seq,
      tree: { elements: picked.map((p) => p.id), vars, funcs: makeFuncs(ops, picked), parents },
      operators: ops,
      descriptor: { scale: cell.scale, mechanism: cell.mechanism, context: cell.context },
      claim,
      body: bodyText,
      novelty_src: reset ? `重置個體：${picked[0].id}×${picked[1].id} 從未在 archive 同現；空 cell ${cellText(cell)}` : `空 cell ${cellText(cell)}；parent ${parents[0] || '無（共享 element 無合適 parent）'}`,
      usefulness_src: null,
      selection: `保留：開拓空 cell ${cellText(cell)}；operators ${opsText}`,
      phase,
    };
    bodies.add(bodyText.slice(0, 40));
    added.push(idea);
    newCells.set(cellKey(cell), { cell, id, ops: opsText });
    existingIds.add(id);
  }
  if (!added.length) {
    return { ok: true, added: [], skipped: wanted, run, message: '全部候選與既有想法重複', createdElements };
  }
  const dir = join(root, ARCHIVE_DIR);
  await mkdir(dir, { recursive: true });
  const ideasPath = join(dir, 'ideas.jsonl');
  const existingText = (await readText(ideasPath)) ?? '';
  const prefix = existingText && !existingText.endsWith('\n') ? existingText + '\n' : existingText;
  await writeAtomic(ideasPath, prefix + added.map((i) => JSON.stringify(i)).join('\n') + '\n');
  await writeAtomic(join(dir, 'grid.md'), gridTextFrom(newCells, archive.ideas.concat(added), axes));
  await appendRunLog(root, run, { seed, count: added.length, cells: added.map((i) => i.descriptor), ops: added.map((i) => i.operators), resetCount: added.filter((i) => String(i.novelty_src).startsWith('重置個體')).length, elements: elements.length, dupSkipped, phase, axes });
  await rememberRoot(root);
  return { ok: true, added, run, seed, createdElements, skipped: wanted - added.length, dupSkipped, phase, resetCount: added.filter((i) => String(i.novelty_src).startsWith('重置個體')).length };
}

async function appendRunLog(root, run, meta) {
  const dir = join(root, RUNS_DIR);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `run-${run}.md`);
  const existing = await readText(file);
  const header = [
    `# run ${run} — ${meta.phase || 'phi1'}`,
    '',
    `elements:${meta.elements}`,
    '',
    '| 轮次 | 相位 | 重复率 | 结论① | 结论② | 选择理由 | 参数版本 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ].join('\n');
  const candidates = meta.count + (meta.dupSkipped || 0);
  const dupRate = candidates ? `${Math.round(((meta.dupSkipped || 0) / candidates) * 100)}%` : '0%';
  const row = `| ${run} | ${meta.phase || 'phi1'} | ${dupRate} | 生成 ${meta.count} 個想法，佔 ${meta.cells.length} 空 cell | reset ${meta.resetCount}；operators ${meta.ops.map((o) => o.join('+')).slice(0, 3).join(' / ')} | 空 cell 優先 + 1–3 ops 分層 | seed=${meta.seed} |`;
  const text = existing ? `${existing.replace(/\s*$/, '')}\n${row}\n` : `${header}\n${row}\n`;
  await writeAtomic(file, text);
}

// ---- sources ---------------------------------------------------------------

async function readSources(root) {
  const path = join(root, SOURCES_FILE);
  const text = await readText(path);
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.sources)) return { path, sources: parsed.sources, created: false };
    } catch {
      /* rewrite below */
    }
  }
  let pack = { sources: [] };
  try {
    pack = JSON.parse(await readFile(SOURCE_PACK, 'utf8'));
  } catch {
    /* empty pack */
  }
  const sources = (pack.sources || []).map((s) => ({ ...s, origin: 'curated', addedAt: new Date().toISOString() }));
  await writeAtomic(path, JSON.stringify({ version: 1, sources }, null, 2));
  return { path, sources, created: true };
}

async function writeSources(root, sources) {
  await writeAtomic(join(root, SOURCES_FILE), JSON.stringify({ version: 1, sources }, null, 2));
}

async function writeAtomic(path, data) {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

async function withRootLock(root, fn) {
  const lock = join(root, '.emergent-generate.lock');
  const deadline = Date.now() + 15000;
  let handle = null;
  while (Date.now() < deadline) {
    try {
      handle = await open(lock, 'wx');
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const st = await stat(lock);
        if (Date.now() - st.mtimeMs > 15000) await unlink(lock);
      } catch {
        /* lock vanished */
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  if (!handle) throw new Error('generation lock timeout');
  try {
    return await fn();
  } finally {
    await handle.close();
    await unlink(lock).catch(() => {});
  }
}

function sourceId(url) {
  let h = 0;
  const s = String(url);
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return 'src-' + Math.abs(h).toString(36);
}

// ---- web search (escape hatch) --------------------------------------------

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function cleanUrl(href) {
  let url = decodeEntities(href);
  if (url.startsWith('//')) url = 'https:' + url;
  if (/duckduckgo\.com\/l\/\?/.test(url)) {
    const m = /[?&]uddg=([^&]+)/.exec(url);
    if (m) url = decodeURIComponent(m[1]);
  }
  return url;
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function unwrapBing(href) {
  const raw = decodeEntities(href);
  if (/bing\.com\/ck\/a/.test(raw)) {
    const m = /[?&]u=a1([^&]+)/.exec(raw);
    if (m) {
      try {
        return Buffer.from(m[1], 'base64url').toString('utf8');
      } catch {
        /* keep raw */
      }
    }
  }
  return raw;
}

async function bingSearch(q) {
  const res = await fetch('https://www.bing.com/search?q=' + encodeURIComponent(q) + '&setlang=en', {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', accept: 'text/html' },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error('bing ' + res.status);
  const html = await res.text();
  const out = [];
  const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) || [];
  for (const block of blocks) {
    const link = /<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    const url = unwrapBing(link[1]);
    if (!/^https?:/.test(url)) continue;
    const title = stripTags(link[2]);
    const snip = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block);
    out.push({ title: title || url, url, snippet: snip ? stripTags(snip[1]).slice(0, 260) : '' });
    if (out.length >= 10) break;
  }
  return out;
}

async function ddgSearch(q) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
    headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', accept: 'text/html' },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error('ddg ' + res.status);
  const html = await res.text();
  const out = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snips = [];
  const sre = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = sre.exec(html))) snips.push(stripTags(m[1]));
  let i = 0;
  while ((m = re.exec(html))) {
    const url = cleanUrl(m[1]);
    if (!/^https?:/.test(url)) continue;
    out.push({ title: stripTags(m[2]), url, snippet: snips[i] || '' });
    i += 1;
    if (out.length >= 10) break;
  }
  return out;
}

async function wikiSearch(q) {
  const res = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=6&format=json&srsearch=' + encodeURIComponent(q), {
    headers: { 'user-agent': 'dsh-emergent-studio/1.0', accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error('wikipedia ' + res.status);
  const body = await res.json();
  const hits = body?.query?.search || [];
  return hits.map((h) => ({
    title: h.title,
    url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(String(h.title).replace(/ /g, '_')),
    snippet: stripTags(h.snippet || ''),
  }));
}

async function arxivSearch(q) {
  const res = await fetch('https://export.arxiv.org/api/query?search_query=all:' + encodeURIComponent(q) + '&start=0&max_results=10&sortBy=relevance', {
    headers: { 'user-agent': 'dsh-emergent-studio/1.0', accept: 'application/atom+xml' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error('arxiv ' + res.status);
  const xml = await res.text();
  const out = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  for (const entry of entries) {
    const title = /<title>([\s\S]*?)<\/title>/.exec(entry);
    const id = /<id>([\s\S]*?)<\/id>/.exec(entry);
    const summary = /<summary>([\s\S]*?)<\/summary>/.exec(entry);
    if (!id) continue;
    const url = id[1].trim().replace('http://', 'https://');
    out.push({
      title: title ? stripTags(title[1]) : url,
      url,
      snippet: summary ? stripTags(summary[1]).slice(0, 260) : '',
      kind: 'paper',
    });
    if (out.length >= 10) break;
  }
  return out;
}

async function webSearch(query) {
  const q = String(query || '').trim();
  if (!q) return { results: [] };
  const errors = [];
  for (const [name, fn] of [['arxiv', arxivSearch], ['wikipedia', wikiSearch], ['duckduckgo', ddgSearch], ['bing', bingSearch]]) {
    try {
      const results = await fn(q);
      if (results.length) return { results, provider: name };
      errors.push(name + ': 0 results');
    } catch (err) {
      errors.push(name + ': ' + String(err.message || err));
    }
  }
  return { results: [], errors };
}

// ---- routes ----------------------------------------------------------------

export const inject = ['webServer'];

export function apply(ctx) {
  mountStudio(ctx);
}

export function mountStudio(ctx) {
  const webServer = ctx.webServer ?? (typeof ctx.get === 'function' ? ctx.get('webServer') : undefined);
  if (!webServer) {
    ctx.logger?.warn?.('[dsh-emergent-complexity] webServer unavailable; studio routes skipped');
    return;
  }
  const register = (route, publicAsset = false) => ctx.effect(() => webServer.register({
    ...route,
    handler: async (req, res) => {
      if (!publicAsset) {
        const rejected = await requestRejection(ctx, req);
        if (rejected !== undefined) {
          json(res, rejected, { error: rejectionText(rejected) });
          return;
        }
      }
      return route.handler(req, res);
    },
  }), 'dsh-emergent-complexity: ' + route.path);

  register({
    kind: 'exact',
    path: '/api/emergent/studio',
    handler: async (req, res) => {
      try {
        const html = await readFile(STUDIO_HTML);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(html);
      } catch (err) {
        json(res, 500, { error: String(err) });
      }
    },
  }, true);

  register({
    kind: 'exact',
    path: '/api/emergent/state',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'method not allowed' });
        return;
      }
      try {
        const url = new URL(req.url ?? '/', 'http://dsh.internal');
        const root = await resolveRoot(url.searchParams.get('root'));
        const archive = await readArchive(root);
        const sources = await readSources(root);
        const allCells = archive.axes.scale.length * archive.axes.mechanism.length * archive.axes.context.length;
        const occupied = [...archive.cells.values()].filter((c) => c.id).length;
        const runs = await readdir(join(root, RUNS_DIR)).catch(() => []);
        const lastRun = runs.filter((f) => /^run-\d+\.md$/.test(f)).sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]))[0] || null;
        json(res, 200, {
          ok: true,
          root,
          archiveDir: join(root, ARCHIVE_DIR),
          elements: archive.elements,
          elementsCreated: !archive.elementsText,
          axes: archive.axes,
          grid: {
            total: allCells,
            occupied,
            empty: allCells - occupied,
            cells: [...archive.cells.values()].filter((c) => c.id).slice(0, 60),
          },
          ideas: archive.ideas.slice(-30).reverse(),
          ideaCount: archive.ideas.length,
          lastRun,
          runs: runs.filter((f) => /^run-\d+\.md$/.test(f)).length,
          sources: { path: sources.path, created: sources.created, items: sources.sources },
        });
      } catch (err) {
        json(res, err.status ?? 500, { error: String(err.message || err) });
      }
    },
  });

  register({
    kind: 'exact',
    path: '/api/emergent/sources',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        json(res, 405, { error: 'method not allowed' });
        return;
      }
      try {
        const body = await readJsonBody(req);
        const root = await resolveRoot(body.root);
        const current = await readSources(root);
        const sources = current.sources.slice();
        if (body.action === 'add') {
          const src = body.source || {};
          const url = String(src.url || '').trim();
          if (!/^https?:\/\//.test(url)) throw Object.assign(new Error('source url must be http(s)'), { status: 400 });
          const id = String(src.id || sourceId(url));
          if (sources.some((s) => s.id === id || s.url === url)) {
            json(res, 200, { ok: true, duplicate: true, items: sources });
            return;
          }
          sources.push({
            id,
            title: String(src.title || url).slice(0, 200),
            url,
            note: String(src.note || '').slice(0, 500),
            tags: Array.isArray(src.tags) ? src.tags.slice(0, 8) : [],
            origin: String(src.origin || 'user'),
            addedAt: new Date().toISOString(),
          });
          await writeSources(root, sources);
          await rememberRoot(root);
          json(res, 200, { ok: true, items: sources });
          return;
        }
        if (body.action === 'remove') {
          const id = String(body.id || '');
          const next = sources.filter((s) => s.id !== id);
          await writeSources(root, next);
          json(res, 200, { ok: true, removed: sources.length - next.length, items: next });
          return;
        }
        if (body.action === 'reset') {
          const pack = JSON.parse(await readFile(SOURCE_PACK, 'utf8'));
          const next = (pack.sources || []).map((s) => ({ ...s, origin: 'curated', addedAt: new Date().toISOString() }));
          await writeSources(root, next);
          json(res, 200, { ok: true, items: next });
          return;
        }
        json(res, 400, { error: 'unknown action' });
      } catch (err) {
        json(res, err.status ?? 500, { error: String(err.message || err) });
      }
    },
  });

  register({
    kind: 'exact',
    path: '/api/emergent/generate',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        json(res, 405, { error: 'method not allowed' });
        return;
      }
      try {
        const body = await readJsonBody(req);
        const root = await resolveRoot(body.root);
        const result = await serialized(root, () => generate(root, body));
        json(res, 200, { ok: true, root, ...result });
      } catch (err) {
        json(res, err.status ?? 500, { error: String(err.message || err) });
      }
    },
  });

  register({
    kind: 'exact',
    path: '/api/emergent/search',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        json(res, 405, { error: 'method not allowed' });
        return;
      }
      try {
        const body = await readJsonBody(req);
        const out = await webSearch(body.query);
        json(res, 200, { ok: true, query: String(body.query || ''), ...out });
      } catch (err) {
        json(res, 200, { ok: false, error: String(err.message || err), results: [] });
      }
    },
  });
}
