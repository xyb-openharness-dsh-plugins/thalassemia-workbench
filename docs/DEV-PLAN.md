# DEV-PLAN · 小铁宝 FerroPal 里程碑与闸口（唯一进度来源）

> 进度只看本文件。状态三态：✅ 实测通过（附证据）/ 🔧 骨架在位（未验证）/ ⏳ 未开始。
> "代码写了" 不等于 ✅；只有命令输出、截图、真机走查能升格。
> 更新规则：每完成一个里程碑，改本表 + 在 `CHANGELOG.md` 加一行。

| 里程碑 | 内容 | 闸口 | 状态 | 证据 |
| --- | --- | --- | --- | --- |
| M0 | 领取 + 建仓 + init + 宿主接线前置 + 文档 9 件 + 基线 check | staticPass | ✅ | Issue #34 `claimed`；`npm run check` → `staticPass: true`（2026-10-25） |
| M1 | 三路调研（医学 / 用户研究 / 家族对比）→ DIFF-MATRIX + SPEC + USER-RESEARCH + INTERACTION-DESIGN | **G1 签认** | 🔧 文档全量就位，待签认 | 一级重名率 46.2%（`npm run measure:diff` 退出码 0）；医学证据 3 份指南原件；公开原话 15 条 |
| M2 | 原型四件套 + demo 唯一源 + 折叠卡 + 窄宽 + HVT X1–X4 + agent-draft + 独立评审 P0=0 + README 截图 ≥4 | **G2 签认** | 🔧 实现全过，待独立评审 | probe 26/26；HVT X1–X4 全 PASS；README 10 张实渲图（`check-readme-assets` 通过） |
| M3 | `schema/0001_initial.sql` + `freeze-contract.md`（sha256）+ 判读列断言 | **G3 签认** | 🔧 冻结完成，待签认 | sha256 `13155ee5…`；`check-schema` S1–S7 全绿；0002 只增不改 |
| M4 | `scripts/fetch-tdt-trials-2026.mjs` + `research/tdt/` 四件套 + 逐来源终态 | manifest=jsonl=sqlite | 🔧 0 条（未查过） | 三处一致 0=0=0；六通道终态 not_queried/not_configured |
| M5 | 七步移植 + apiBase 契约 + test 五套（MinerU 六部件未做，见下） | **V1** | ✅ V1 通过 | `npm run check` staticPass=true；`npm test` 33/33；58 组合渲染逐字一致（ui-parity） |
| M6 | 升版 → pack → 四要素对照 → pnpm 装 → bundles 登记 → 重启后**新建会话** → 真机走查 | **V2/V3** | 🔧 已装入 profile，待重启验活 | 0.3.0 装进 `~/.dsh/profiles/desktop`，四要素逐条 ✅（docs/INSTALL-RECORD.md）；V2/V3 未验 |
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
3. **MinerU 六部件未做**（比原计划收缩）：本机无 MinerU 服务，本轮只交付"文档登记 + 候选核对"通道，
   未实现 PDF→结构化六部件。`docs/CLINICAL-DATA-2026.md` 与 README 已如实标注。**这是本轮未做，不是通过。**
4. 0 访谈 → 所有患者场景句标 `hypothesis`（未核实）。
