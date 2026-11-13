/**
 * `dsh-emergent-complexity` — bundle main row (package root).
 *
 * Registers the single-file `emergent-complexity` skill into the `skills` registry
 * with `provider: 'bundled'`, so the `skill` tool and Settings inventory read it
 * through the same provider chain as the bundled `agent-preset` skills, and the
 * resource hint carries the absolute base directory (the five diagram SVGs + the
 * two helper tools live in this package). The skill's own §13.2 single-file
 * discipline survives: nothing new is mounted inside the skill directory —
 * `ei_audit` / `ei_census` / `ei_archive_reset` are Tool-registry tools, and the
 * runtime helper is called by the `python3` that ships with the host, not a
 * per-profile script checkout.
 *
 * The two patch rows of this bundle are independent: this row can run with the
 * tool row disabled (agents then count manually per §13.1's degraded mode, the
 * way the skill was used as a single file before this bundle existed).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-emergent-complexity';

/** Hard dependency: the Loader activates this row only when the `skills` service is ready. */
export const inject = ['skills'];

const PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL_DIR = join(PKG_DIR, 'skills', 'emergent-complexity');
const SKILL_FILE = join(SKILL_DIR, 'SKILL.md');

const DESCRIPTION = "Use when the task is to generate many novel ideas that must be traceable to their combinational ingredients (element x variable x function), with no seed ideas fed in. Runs a two-stage novelty-search loop (combinatorial supply / selective retention) over a permanent descriptor-grid archive, with honest duplicate counting. Triggers: idea generation, novelty search, emergent novelty, traceable ideation, 發想, 新穎性搜尋, 可溯源點子. The three on-disk tools (ei_audit, ei_census, ei_archive_reset) exist as DSH Tools registered globally by this bundle's tools row — call them by name, never as Service methods.";

const PREAMBLE = [
  '> **DSH 分发版（本插件 `dsh-emergent-complexity`）——先读这五行，再读 §1。**',
  '> 1. 本档随 DSH bundle 单档分发：skill 注册 + 三个验证工具都在插件包内，**skill 目录内没有新增档**（§13.2 结构例外在 DSH 下不启用——工具与配图是插件资源，不是 skill 档）。',
  '> 2. 验证工具（直接以名字当 Tool 调用，**不是 Service 方法**，不要在 Service/Tool 清单里找 Service）：`ei_audit`（missing＝栏位/bloat 稽核；corrupt＝档案毁损检测与复原）、`ei_census`（occupancy＝格子占用统计；duplication＝重复率扫描）、`ei_archive_reset`（§8 重建句一键重跑 + F5 坏尾隔离）。缺工具或 `write:false` 时，照本档手动方式执行（§13.1 降级）。',
  '> 3. 路径规则：`ei-archive/`、`ei-runs/`、`scratch/` 一律**对 session workspace 根**解析；shell `pwd` 先定位 workspace 根，再组 `<workspace 根>/ei-archive/...`；三个工具带等价的 `root` 参数（未给时自动在 workspace root／`$DSH_HOME`／`~/.dsh` 三个根下找 `ei-archive/`）。',
  '> 4. 历史残留的死路径（保持原位便于跨工具比对，**DSH 执行时不要去找这些档案**）：`05-tools/track-c.md` §1.2–1.4 与 `05-tools/tools-mcp.md` T4（＝§4.2 第 9/10 点的 ρ̂ 与 token 对拍参考，DSH 未打包，直接以 `ei_census` 的 occupancy/duplication 机械判定替代手算）、`02-council/`、`13-deploy-verify/yield-cores/yield_cores.py`（DSH 由 `ei_audit` + `ei_census` 代跑 12.8 的 S/B 两侧计数）、`~/.hermes/profiles/mentor/skills/emergent-complexity/SKILL.md`（§12.5 结构自查改为 `test -f <base>/skills/emergent-complexity/SKILL.md`，`<base>`＝本 skill 的绝对基底目录）。',
  '> 5. `scratch/` 是 workspace 根的暂存目录（§4 第 4 步 assert 脚本落盘处），与 `ei-archive/`、`ei-runs/` 同级。',
  '',
].join('\n');

/** Register the single-file skill on `ctx.skills`. */
export function apply(ctx) {
  const skills = ctx.get('skills');
  if (skills === undefined || skills === null) {
    throw new Error('[dsh-emergent-complexity] the `skills` service is missing in this profile; refusing to start without a skill registry');
  }
  let body;
  try {
    body = readFileSync(SKILL_FILE, 'utf8');
  } catch (error) {
    throw new Error(`[dsh-emergent-complexity] cannot read ${SKILL_FILE}: ${error && error.message ? error.message : String(error)}`);
  }
  ctx.effect(
    () => skills.register({
      name: 'emergent-complexity',
      description: DESCRIPTION,
      content: `${PREAMBLE}\n${body}`,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'bundled',
      resourceBase: { kind: 'directory', path: SKILL_DIR },
    }),
    'emerge…kill',
  );
}
