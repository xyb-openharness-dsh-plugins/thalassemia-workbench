# CHANGELOG

## v0.4.0 — 2026-10-25（开发版，装机验活中）

### 修复（独立评审 6 条 P0 中的 5 条，第 6 条部分）
- **P0-1 保存只改内存**：正式页保存改为 POST → 刷新 bootstrap → 才关表单；失败保留输入并 `role=alert`；
  新增 growth 写 API；dev-server 打开写通道。真实浏览器测试 8 次写入 / 8 次重载 / 8 次重开 SQLite 全通过。
- **P0-2 整页视图无挂载点**：图表数据点、事件竖线、三张表行接 `pv-day` / 行入口，点开即整页。
- **P0-3 AI 草稿零渲染点**：宿主侧 `sessions.scope → conversation.input.for → setDraft` 桥（严格 message source/origin/type 校验、
  引用态拒写、失败回 `ok:false` 不谎报）；iframe 侧按回执提示。**真机未验证**。
- **P0-4 节奏层有后端无界面**：`/api/cadence` 改为纯数据（去掉函数 helpers），筛查页渲染参考节点 + 无固定间隔缺口 + 带宽声明。
- **P0-5 依从热力图伪造三态**：删除日期哈希生成的"已做/未做"，无打卡事实一律"未记录"。
- **P0-6 下次预约推算**：读模型与演示源均 `next_due=null`（`test/appointment-facts.test.mjs` 两出口断言）；保存分支的 +20 天同步移除。
- 患者引语校验改为全文比对；删除行尾 `wording-allow` 整行豁免。

### 新增
- **分类 3D 指标卡 + 一图秀指标选择窗**（用户实看反馈）：同目录分类排序、固定 276px 真 3D 翻面、隐藏面 inert、
  来源点不触发翻面、窄窗单列；选择窗 draft 最多 4 条、取消不生效。
- **地贫试验匹配纯逻辑** `lib/trial-matching.js`：35 号算法的地贫适配，三态事实、`null≠0`、招募状态单列不进分母、
  明写分型/输血依赖不符显著提示、不搬肿瘤 IHC。`docs/TRIALS-MATCH.md` 写清偏离与未接界面。
- **真实 MCP 采集**：`assets/clinical/` 241 条原始候选（ICTRP 英文截断、CDE 中文 41、中文 ICTRP 上游失败、CTV/ChiCTR 未就绪），
  manifest 明确 `candidateOnly` 与"请求的 9 个月窗口未被上游证实"。

### 未完成（不算通过）
- **G2 未签认**：需重新独立评审 + 用户签认。
- **MinerU 六部件**未实现。
- **试验建档页/结果页未接**：`T1/T2/T6/T7/T8` 仍 ⏳。
- **V2/V3 未验证**：0.4.0 已装入 profile，尚未重启后新建会话走查。

## 未发布修复 — 2026-10-25

- 独立评审检出6条P0，G2不签认；此前测试全绿未覆盖真实闭环。暂停发布、装机完成态和BACKLOG完成态回填。
- 客户端会话节点不再随收起卸载；真实函数树生命周期测试已通过，不代替宿主真机验收。
- 读模型与唯一演示源不再推算“上次输血+20天”预约，缺事实明确null；新增两出口回归。
- 公开患者引语改为全文检查，删除行尾wording-allow整行豁免。
- 用户反馈的系列化3D指标卡、一图秀指标选择窗、地贫临床/基因建档—试验匹配进入修订，**尚未验收**。
- 医学与脚手架合同核对见`docs/TRIAL-MATCHING-GAP.md`：IHC不生搬；未发现明确匹配指数合同，候选规则不得冒称既有规则。
- 当前本机工程版本0.3.1是既有未发布开发状态，下次打包必须重新升版；此段不表示已生成或安装新包。

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
