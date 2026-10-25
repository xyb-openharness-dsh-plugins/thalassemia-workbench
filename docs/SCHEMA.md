# SCHEMA · 数据模型设计（M3 落成 `schema/0001_initial.sql`）

> 本文件是设计意图。**唯一可执行定义是 `schema/0001_initial.sql`**，冻结后以 `schema/freeze-contract.md` 的 sha256 为准。
> 四契约（starter 04 号）：① 看法恒不为结论；② 分类不进趋势；③ 更正只新增版本；④ 事实四层不合并。

## 一、分层（事实四层，不许合并）

```
文档 docs ──(抽取)──> 候选 candidates ──(用户核对)──> 记录 records ──(派生)──> 指标 metrics
```

- `docs`：原始文件（PDF/照片），只存路径 + sha256 + 导入时间，**进候选之前不改写内容**。
- `candidates`：AI/MinerU 抽出的字段值，带 `status ∈ {pending, accepted, rejected}`；未 accepted 的不进读模型。
- `records`：用户确认过的事实（输血、方案、报告、生长、筛查、抗体、费用、问题）。
- `metrics`：只有"数值型"与"分类型"两种取值，供趋势图使用。

## 二、表清单（档案级 1 + 通用 3 + 专属 9）

| 表 | 作用 | 关键列 | 说明 |
| --- | --- | --- | --- |
| `profile` | 档案级 | `id, display_name, relation, sex, birth_date, dx_date, genotype_text, transfusion_start, section_title` | `relation ∈ {self, caregiver}`（R3 双视角） |
| `docs` | 通用 | `id, profile_id, filename, kind, sha256, imported_at, note` | `sha256` 去重 |
| `candidates` | 通用 | `id, doc_id, field, value, status, page_no, created_at` | 三态；`accepted` 才落记录 |
| `metrics` | 通用 | `id, profile_id, kind, code, date, value_num, value_text, unit, ref_low, ref_high, dec, ord, in_use` | `kind ∈ {numeric, qual}`；`dec` 分类值列、`ord` 手写排序 |
| `transfusion` | 专属 | `id, profile_id, date, hb_before, units, volume_ml, product_type, reaction_text, site, section_title` | 一次输血一行；间隔**不落库** |
| `iron_lab` | 专属 | `id, profile_id, date, ferritin, ref_low, ref_high, lab_name, report_text, section_title` | `report_text` 存原文摘录 |
| `chelation_plan` | 专属 | `id, profile_id, drug_text, dose_text, route, start_date, end_date, change_reason, in_use, section_title` | 换药只新增行，不覆盖旧行 |
| `t2star_report` | 专属 | `id, profile_id, date, organ, t2star_ms, report_text, hospital, section_title` | `organ ∈ {heart, liver}`；**不存判读结论列** |
| `growth_measure` | 专属 | `id, profile_id, date, height_cm, weight_kg, age_months, note, section_title` | 百分位**不落库**（读取时按参考标准算） |
| `screening_item` | 专属 | `id, profile_id, item_text, category, planned_date, done_date, result_text, source_text, section_title` | `category ∈ {annual, endocrine, cardiac, infection}` |
| `antibody_record` | 专属 | `id, profile_id, date, antibody_text, crossmatch_text, note, section_title` | 只记报告原文 |
| `cost_record` | 专属 | `id, profile_id, date, category, amount_cents, insurance_flag, note, section_title` | 整数分；`category ∈ {transfusion, chelation, other}` |
| `question_item` | 专属 | `id, profile_id, text, source_page, status, created_at, section_title` | 就诊问题清单条目，`source_page` 指回来源页 |

## 三、硬约束落到列

| 约束 | 落法 |
| --- | --- |
| 无判读列 | 全表**不得出现** `diagnosis / risk_level / severity / grade_auto / is_conclusion / is_normal`；`check-schema.mjs` 断言 PRAGMA 结果 |
| 显式 null | 所有可空列显式写 `NULL`；读模型按 `=== null` 分支 |
| 保留字 | `in_use`（不用 `using`） |
| 分节标题 | 每个 `{title, rows}` 节对应列 `section_title` |
| 分类不进趋势 | `metrics.kind='qual'` 的行不参与 `smoothPath`；`dec IS NOT NULL` 时 `value_num IS NULL` |
| 排序 | 复合主键表裸 `SELECT` 一律 `ORDER BY rowid`；手写倒序只 `ORDER BY ord` |
| 参考值 | `iron_lab.ref_low/ref_high` 可空；有值时必须 `ref_high >= ref_low`（写入校验） |
| 迁移 | `0001` 冻结；后续 `0002_*.sql` 只增 |
| 派生不落库 | 输血间隔、百分位、逾期天数、累计输血次数全部读取时算 |

## 四、读模型形状（与原型逐字符对齐）

`GET /api/bootstrap` 返回：

```json
{
  "profile": { "id": "...", "name": "...", "relation": "caregiver", "headline": "...", "mindset": "...",
               "dash_keys": ["hb", "ferritin", "height"] },
  "transfusion": { "section_title": "输血记录", "rows": [["2026-10-12", "78", "2U", "无", "..."]], "summary": {} },
  "iron": { "section_title": "铁蛋白趋势", "rows": [] },
  "growth": { "section_title": "身高体重", "rows": [] },
  "screening": { "section_title": "年度清单", "rows": [] },
  "questions": { "section_title": "就诊问题", "rows": [] },
  "events": [ { "date": "...", "kind": "transfusion" } ],
  "docs": [], "candidates": [],
  "generated_at": "2026-10-25T00:00:00+08:00", "data_end": "2026-10-25"
}
```

- `events` / `docs` / `candidates` 是**定长数组**（parity 依赖）。
- 分类值走 `dec`，不补 `unit` 键（原型没有就不许补）。

## 五、本轮不建的表

`treatment_line`（无治疗线）、`staging`（无分期）、`ctcae_grade`（不判读）、`reminder`（不发通知）。
理由见 `docs/DIFF-MATRIX.md` §四 与 `docs/METRIC-GRADING.md`。
