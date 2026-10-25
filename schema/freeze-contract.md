# Schema 冻结契约 · 0001_initial.sql

- 冻结时间：2026-10-25
- 文件：`schema/0001_initial.sql`
- **sha256**：`13155ee50e04a71584a31a9e161ab65f2039b466da574f967283f0a521947276`
- 字节数：见 `shasum -a 256` 实算（本文件不复制数字，避免两处漂移）
- 校验方式：`node scripts/check-schema.mjs`（sha256 不符即失败）

## 一、冻结内容边界

1. **表与列**：`profile / docs / candidates / metrics / transfusion / iron_lab / chelation_plan / t2star_report /
   growth_measure / screening_item / antibody_record / cost_record / question_item` 共 13 张表。
2. **约束**：`metrics` 的 kind/dec 互斥 CHECK、`ref_high >= ref_low` CHECK、枚举 CHECK、金额非负 CHECK。
3. **索引**：见文件末尾 6 个 `idx_*`。
4. **不冻结**：演示数据内容（`demo/demo-data.sqlite` 是生成物）、读模型形状（`docs/SCHEMA.md` §四 可增键）。

## 二、改动规则（只增不改）

| 场景 | 做法 |
| --- | --- |
| 加表 / 加列 | 新增 `schema/0002_*.sql`，`ALTER TABLE ... ADD COLUMN`；**不改 0001** |
| 改列类型 / 删列 | 新增 `0003_*.sql` 建新表 → 迁移 → 重命名（SQLite 无 DROP COLUMN 旧版本） |
| 加索引 | 可放进新的 `000N_*.sql` |
| 改约束 | 同上，走建表重建 |

**任何情况下不允许**编辑已发布的 `0001_initial.sql`：已装机的库已经按旧结构建过，改文件只会让"代码结构与用户库结构"分叉。

## 三、四条红线（脚本断言，不靠人记）

| # | 断言 | 实现 |
| --- | --- | --- |
| R1 | 全表**无判读列**：`diagnosis / risk_level / severity / grade_auto / is_conclusion / is_normal` | `PRAGMA table_info` 全表扫描 |
| R2 | `metrics` 分类值与数值互斥（`kind='qual'` 时 `value_num IS NULL`） | 插入反例必须被 CHECK 拒绝 |
| R3 | 参考区间顺序合法（`ref_high >= ref_low`） | 插入反例必须被 CHECK 拒绝 |
| R4 | 迁移可重复执行（`IF NOT EXISTS` 全覆盖） | 连执行两次不报错 |

## 四、与读模型的关系

- 读模型（`GET /api/bootstrap`）**形状**见 `docs/SCHEMA.md` §四；形状变化不需要改 schema，但要同步：
  `demo/build-demo-data.mjs`（演示源）→ `prototypes/v0.2/demo-data.js` → `dsh/readmodels.js` → `test/ui-parity.test.mjs`。
- 派生值（输血间隔、百分位、逾期天数）**不落库**：`metrics` 里只有原始数值与分类值。

## 五、历史

| 版本 | 日期 | 变更 | sha256 |
| --- | --- | --- | --- |
| 0001 | 2026-10-25 | 初版（M3 冻结） | `13155ee5…276` |
