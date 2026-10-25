# TRIALS-MATCH · 本项目（地贫）试验匹配口径

> 通用规范：starter `docs/35-CLINICAL-TRIAL-MATCHING.md`（2026-10-25 新增）· 项目填写件 `templates/TRIALS-MATCH.md`
> 实现：`lib/trial-matching.js`（纯函数）· 测试：`test/trial-matching.test.mjs`（11 条）
> 状态：**纯逻辑已实现并测试；界面建档页、SQLite 业务表、外部检索接线尚未完成 → 不构成 G2 通过**。

## 1. 有没有这条线

有。地贫的入组判断高度依赖**基因型（HBB / HBA1 / HBA2）**与**输血依赖状态**，这两项患者手上通常有报告原件，
适合做"个人建档 → 本地/外部检索 → 对照结果"。

**不做的**：不把肿瘤 `IHC`（ER/PR/HER2/PD-L1）搬过来。地贫不是靠 IHC 分层的病种，硬塞一栏等于伪造专业度
（35 号 §4 明确禁止）。

## 2. 建档字段（三态，患者手上真有的）

| 字段 | 三态呈现 | 患者从哪拿 | 登记库侧对应 |
| --- | --- | --- | --- |
| 所在国家/地区 `country` | 已知 / 未测 / 无此项 | 自填 | `trial.country`（部分登记记录有） |
| 分型 `thalassemiaType` ∈ `alpha / beta / both` | 同上 | 基因报告原文（HBB→β；HBA1/HBA2→α） | 仅当标题/适应症**明写** α/β |
| 输血依赖 `transfusionDependence` ∈ `dependent / non_dependent` | 同上 | 医生记录/输血记录 | 仅当标题/适应症**明写** |
| 基因型原文 `genotypeText` | 自由文本，**不参与打分** | 基因检测报告 | 库内无结构化字段 |
| 既往治疗（移植/基因治疗/去铁方案） | 自由文本，**不参与打分** | 出院小结 | 库内无结构化字段 |

**三态的语义**（`lib/trial-matching.js` 的 `fact()`）：
- `known` 才有 `value`，非法枚举值降级为 `untested`（不猜）；
- `untested` = 没查过，**不等于阴性**；
- `not_applicable` = 本病种/本人不存在这一项，**同样不进分母**。

## 3. 匹配指数（唯一算法）

```
index = round( 100 * Σ score[d] / count(score[d] != null) )
count == 0 → index = null（界面显示"暂无可对照字段"，不显示 0）
```

| 维度 | 打分 | 库内没有时 |
| --- | --- | --- |
| 地区 | 同国 1 / 不同 0 | `null`，不进分母 |
| 明写分型 | 一致或一方为 `both` → 1；明写另一型 → 0 | `null`，不进分母 |
| 明写输血依赖 | 一致 1 / 不一致 0 | `null`，不进分母 |

**与 35 号的唯一偏离（有意，写在这里）**：35 号把「招募状态」列为等权维度。
本项目把它**单列为登记侧事实 `recruit`，不计入指数**，理由是可断言的：
它对任何患者都给同一个分，一旦进分母，会出现"患者零已知事实仍得 100 分"（`test/trial-matching.test.mjs`
第 1 条就是防这个）。招募状态仍以固定档呈现（`RECRUITING 1 / NOT_YET 0.6 / ACTIVE_NOT 0.4 / BY_INVITATION 0.4`），
未识别枚举一律 `null` + 缺口说明，不猜"Not Recruiting"对应哪个枚举。

**永远不进分母的缺口**：入排标准（只能研究者判定）、基因/生物标志阈值（登记记录只有散文）、年龄区间（多数无此字段）。

**不符不能被高分掩盖**：分型或输血依赖明写不符时 `hasMismatch = true`，`warnings` 里逐条写出
「你 X / 登记 Y」，界面必须显著提示（仍不给"能不能入组"的结论）。

## 4. 结果格式

`computeMatch(profile, trial)` 返回：

```js
{ index, knownDims, totalDims, dims, recruit, missing, warnings, hasMismatch,
  headline, ruleVersion, notice }
```

- `notice` 常驻：**指数不是入组资格、不是疗效/安全性判断，登记状态未核实**。
- `ruleVersion`（当前 `dtm-1.0.0`）随结果走，档案或规则变更即标"需重新分析"（04 号快照要求）。
- 指数**不进趋势图**（它不是时间序列）。

## 5. 数据侧现状（诚实区）

| 项 | 状态 |
| --- | --- |
| 真实 MCP 采集 | ✅ 已跑：ICTRP 英文命中但**截断**、CDE 中文 41 条、中文 ICTRP **上游失败**、CTV/ChiCTR **未就绪** |
| 原始候选 | 241 条，全部 `unknownStartDate` → **不能说是"9 个月内合格研究"** |
| 现有业务 SQLite | `research/tdt/*.sqlite` 仍是 0 条未查询库；新采集在 `assets/clinical/` |
| 建档数据表 | **未建**（需 `0003` 迁移：基因三态、分型、输血依赖、来源与日期） |
| 界面 | **未接**（建档页/结果页/缺口清单都没有渲染点） |

## 6. 验收（T1–T9，当前只完成 T3/T4/T5/T6 的纯函数部分）

| 编号 | 断言 | 状态 |
| --- | --- | --- |
| T1 | 三态可分（界面） | ⏳ 未接 UI |
| T2 | 未测不显示成阴性（界面） | ⏳ 未接 UI |
| T3 | 全未知时 index=null 不显示 0 | ✅ 单测 |
| T4 | 分母只累加已知 | ✅ 单测 |
| T5 | 缺口不进分母、单独列出 | ✅ 单测 |
| T6 | 无结论词（剥否定前缀后为空） | ⏳ 待 UI 文案检查 |
| T7 | 通道终态与 manifest 一致 | ⏳ 待接 UI |
| T8 | `unsupported/截断` 通道写"0 条不代表没有研究" | ⏳ 待接 UI |
| T9 | manifest=jsonl=sqlite 行数一致 | ✅ 采集脚本已断言（241=241=241） |
