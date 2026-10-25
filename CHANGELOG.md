# CHANGELOG

## v0.3.0 — 2026-10-25（开发版，待装机验活）

### 新增
- **M1 调研**：医学证据（TIF 4th ed 2021 / Short Guide 2022 / 《86 个罕见病病种诊疗指南（2025 年版）》#78，三份原件页级摘录）、
  公开患者/家长原话 15 条（逐条回源核对）、证据分层（E1=0 / E2=15 / E4=其余）。
- **G1 出处层**：`assets/reference/guideline/refs.json` 24 条（页码 + 表号 + ≤200 字符摘录），界面两段式（指南写的 / 你的记录是）。
- **G2 节奏层**：`cadence.json` + `dsh/cadence.js` 纯函数（月末夹取、节点=起点+k×间隔、两套口径并列不取严）。
- **M2 原型 v0.2**：13 一级 / 45 二级；Fritsch–Carlson 单调插值；分类事件不进曲线；折叠卡收/展；3D 翻转；整页视图；AI 五态与候选核对。
- **M3 数据模型**：`schema/0001_initial.sql`（13 表）+ 冻结契约 sha256 `13155ee5…`；`0002_profile_presentation.sql`（只增不改）。
- **M4 临床库**：`scripts/fetch-tdt-trials-2026.mjs` + `research/tdt/` 四件套；**0 条，逐通道记「未查过」**。
- **M5 开发版**：`dsh/*`（store/demo/readmodels/cadence/server/index）+ `public/*`（与原型 app.js/style.css **字节一致**）+
  `src/client.js → lib/client.js`（customFrame、iframe、splitter 25–45%、五态）。
- **测试**：33 条（store / cadence / server / ui-parity 58 组合逐字 / guideline 三处登记一致）。

### 变更
- `cordis.patch.yml` 补 `config.root: !!js dshHomePath('ferropal-workbench')`，注释放在条目**之后**（checker 要求文件以 `- insert:` 开头）。
- 删掉 init 模板自带的 `assets/reference/ctcae/*.pdf`（2.9MB，本仓不启用 CTCAE）：包体积 3.5MB → 0.3MB。

### 未做（不算通过）
- **0 一手访谈**；F06 生殖与遗传、F05 筛查日历等 7 条功能线仍是 `hypothesis`。
- **G3 分级层** 有意不启用（不判读）。
- **MinerU 六部件** 未实现（本机无服务）。
- **V2/V3** 装机验活未做：已装入 profile，尚未重启后新建会话走查。
- 中华医学会 2017 版地贫指南、NMPA 批件、中国在研基因治疗管线：未取得。
