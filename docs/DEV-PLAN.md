# DEV-PLAN · 小铁宝 FerroPal 里程碑与闸口（唯一进度来源）

> 进度只看本文件。状态三态：✅ 实测通过（附证据）/ 🔧 骨架在位（未验证）/ ⏳ 未开始。
> "代码写了" 不等于 ✅；只有命令输出、截图、真机走查能升格。
> 更新规则：每完成一个里程碑，改本表 + 在 `CHANGELOG.md` 加一行。

| 里程碑 | 内容 | 闸口 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| M0 | 领取 + 建仓 + init + 宿主接线前置 + 文档 9 件 + 基线 check | staticPass | ✅ | Issue #34 `claimed`；`npm run check` → `staticPass: true`（2026-10-25） |
| M1 | 三路调研（医学 / 用户研究 / 家族对比）→ DIFF-MATRIX + SPEC + USER-RESEARCH + INTERACTION-DESIGN | **G1 签认** | ⏳ | — |
| M2 | 原型四件套 + demo 唯一源 + 折叠卡 + 窄宽 + HVT X1–X4 + agent-draft + 独立评审 P0=0 + README 截图 ≥4 | **G2 签认** | ⏳ | — |
| M3 | `schema/0001_initial.sql` + `freeze-contract.md`（sha256）+ 判读列断言 | **G3 签认** | ⏳ | — |
| M4 | `scripts/fetch-tdt-trials-2026.mjs` + `research/tdt/` 四件套 + 逐来源终态 | manifest=jsonl=sqlite | ⏳ | — |
| M5 | 七步移植（store/server/workbench/demo/readmodels/public/scripts+test）+ MinerU 六部件 + apiBase 契约 + test 五套 | **V1**（check 全绿 + HVT 一致） | ⏳ | — |
| M6 | 升版 → pack → 06 号四要素对照 tgz → corepack pnpm 装 → bundles 登记 → 重启后**新建会话** → 真机走查 → 截图刷 README | **V2/V3** | ⏳ | — |
| M7 | tag + GitHub Release（附 tgz + sha256）+ CHANGELOG 发版段 | 发布 | ⏳ | — |
| M8 | BACKLOG 状态行回填（31 号：只改状态列） | 回填 | ⏳ | — |
| M9 | 经验收敛：本仓追补 / starter LESSONS / 编号文档 / 检查器待实施清单 / starter CHANGELOG | 回流 | ⏳ | — |

## 闸口定义（不许跳）

- **G1（M1 末）**：DIFF-MATRIX 一级重名率 ≤70%（实测口径见该文件）+ 四份文档全量（SPEC/USER-RESEARCH/INTERACTION-DESIGN/DIFF-MATRIX）+ 0 访谈如实声明 + 医学出处缺口清单。停下等签认。
- **G2（M2 末）**：原型四件套可 `file://` 打开、页签穷举 0 空白、HVT X1–X4 全过、独立评审 P0=0（修复留痕 commit）、README 实渲截图 ≥4 张（含折叠收/展）。停下等签认。
- **G3（M3 末）**：`0001` 冻结、sha256 与实算一致、判读列断言 0 命中、迁移幂等单测绿。停下等签认。
- **V1（M5 末）**：`npm run check` 全绿 + `npm test` 五套全绿 + 原型/开发版 parity 逐字符。
- **V2（M6 半）**：装机后重启 + **新建会话**里能看到工作台、能读能写、无 4xx。
- **V3（M6 末）**：真机走查一条完整业务闭环（记一笔输血 → 回来看见 → 导出复诊材料）。

## 当前阻塞与未验证清单（诚实区）

1. 指南原件（中文 2025 罕见病指南 #78 / 中华医学会地贫指南）**未取得**，NCBI/NMPA/CNKI 均被封或 412 → G1 出处层本轮不启用。
2. 本机无 unified-trial-mcp → M4 只能交付脚本与"未查过"终态。
3. 本机无 MinerU 服务 → M5 六部件接骨架，标未实测。
4. 0 访谈 → 所有患者场景句标 `hypothesis`（未核实）。
