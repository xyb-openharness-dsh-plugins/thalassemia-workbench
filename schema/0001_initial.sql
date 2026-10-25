-- FerroPal · 重型地中海贫血（输血依赖型）工作台
-- 0001_initial.sql · 2026-10-25 · 冻结后只增不改（改结构一律新增 0002_*.sql）
--
-- 四契约：
--   ① 看法恒不为结论：全表无 diagnosis / risk_level / severity / grade_auto / is_conclusion / is_normal
--   ② 分类不进趋势：metrics.kind='qual' 时 dec 非空、value_num 必须为空
--   ③ 更正只新增版本：变更记录新增行 + supersedes_id，不物理删除
--   ④ 事实四层不合并：docs → candidates → 记录表 → metrics
--
-- 命名：保留字 using → in_use；每个分节 {title, rows} 对应 *_title 列。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- 档案级 ----------
CREATE TABLE IF NOT EXISTS profile (
  id               TEXT PRIMARY KEY,
  display_name     TEXT NOT NULL,
  relation         TEXT NOT NULL CHECK (relation IN ('self', 'caregiver')),
  sex              TEXT CHECK (sex IN ('female', 'male', 'unknown')),
  birth_date       TEXT,                    -- YYYY-MM-DD
  dx_date          TEXT,                    -- 确诊日
  genotype_text    TEXT,                    -- 基因型报告原文（不解析）
  transfusion_start TEXT,                   -- 首次输血日
  note             TEXT,
  section_title    TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- ---------- 通用四层：docs / candidates / metrics ----------
CREATE TABLE IF NOT EXISTS docs (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profile(id),
  filename    TEXT NOT NULL,
  kind        TEXT NOT NULL,                -- report / lab / invoice / photo / other
  sha256      TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  note        TEXT,
  section_title TEXT NOT NULL,
  UNIQUE (profile_id, sha256)
);

CREATE TABLE IF NOT EXISTS candidates (
  id         TEXT PRIMARY KEY,
  doc_id     TEXT REFERENCES docs(id),
  profile_id TEXT NOT NULL REFERENCES profile(id),
  field      TEXT NOT NULL,
  value      TEXT,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  page_no    INTEGER,
  created_at TEXT NOT NULL,
  note       TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  kind       TEXT NOT NULL CHECK (kind IN ('numeric', 'qual')),
  code       TEXT NOT NULL,                -- hb / ferritin / height / weight / ...
  date       TEXT NOT NULL,
  value_num  REAL,
  value_text TEXT,
  unit       TEXT,
  ref_low    REAL,
  ref_high   REAL,
  dec        TEXT,                         -- 分类值（kind='qual'）
  ord        INTEGER,                      -- 手写排序；倒序只 ORDER BY ord，不叠 DESC
  in_use     INTEGER NOT NULL DEFAULT 1,
  note       TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    (kind = 'numeric' AND value_num IS NOT NULL AND dec IS NULL) OR
    (kind = 'qual'    AND dec IS NOT NULL      AND value_num IS NULL)
  ),
  CHECK (ref_low IS NULL OR ref_high IS NULL OR ref_high >= ref_low)
);

-- ---------- 专属记录 ----------
CREATE TABLE IF NOT EXISTS transfusion (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  date          TEXT NOT NULL,              -- 输血日
  hb_before     REAL,                       -- 输血前 Hb (g/L)
  units         REAL,                       -- 输注量（U）
  volume_ml     REAL,
  product_type  TEXT,                       -- 去白红细胞 / 洗涤 / 其他（原文）
  reaction_text TEXT,                       -- 输血反应原文
  site          TEXT,
  note          TEXT,
  section_title TEXT NOT NULL,
  supersedes_id TEXT REFERENCES transfusion(id),
  created_at    TEXT NOT NULL,
  CHECK (hb_before IS NULL OR hb_before > 0)
);

CREATE TABLE IF NOT EXISTS iron_lab (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  date          TEXT NOT NULL,
  ferritin      REAL,                       -- ng/mL
  ref_low       REAL,
  ref_high      REAL,
  lab_name      TEXT,
  report_text   TEXT,                       -- 报告原文摘录
  section_title TEXT NOT NULL,
  supersedes_id TEXT REFERENCES iron_lab(id),
  created_at    TEXT NOT NULL,
  CHECK (ref_low IS NULL OR ref_high IS NULL OR ref_high >= ref_low)
);

CREATE TABLE IF NOT EXISTS chelation_plan (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  drug_text     TEXT NOT NULL,              -- 药名（原文，不归一）
  dose_text     TEXT,                       -- 剂量原文（不拆 mg/kg）
  route         TEXT,                       -- oral / pump / patch / other
  start_date    TEXT NOT NULL,
  end_date      TEXT,                       -- NULL = 当前在用
  change_reason TEXT,                       -- 换药原因原文
  in_use        INTEGER NOT NULL DEFAULT 1,
  section_title TEXT NOT NULL,
  supersedes_id TEXT REFERENCES chelation_plan(id),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS t2star_report (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  date          TEXT NOT NULL,
  organ         TEXT NOT NULL CHECK (organ IN ('heart', 'liver')),
  t2star_ms     REAL,
  report_text   TEXT,                       -- 报告原文（含放射科结论原文，但**不拆成判读列**）
  hospital      TEXT,
  section_title TEXT NOT NULL,
  supersedes_id TEXT REFERENCES t2star_report(id),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_measure (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  date          TEXT NOT NULL,
  height_cm     REAL,
  weight_kg     REAL,
  age_months    INTEGER,                    -- 记录时月龄（百分位读取时按生日重算）
  note          TEXT,
  section_title TEXT NOT NULL,
  supersedes_id TEXT REFERENCES growth_measure(id),
  created_at    TEXT NOT NULL,
  CHECK (height_cm IS NULL OR height_cm > 0),
  CHECK (weight_kg IS NULL OR weight_kg > 0)
);

CREATE TABLE IF NOT EXISTS screening_item (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  item_text     TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('annual', 'endocrine', 'cardiac', 'infection')),
  planned_date  TEXT,                       -- 医生说的日期（原文）
  done_date     TEXT,
  result_text   TEXT,
  source_text   TEXT,                       -- 谁在什么场景说的（出处）
  section_title TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS antibody_record (
  id             TEXT PRIMARY KEY,
  profile_id     TEXT NOT NULL REFERENCES profile(id),
  date           TEXT NOT NULL,
  antibody_text  TEXT,                      -- 抗体名称原文
  crossmatch_text TEXT,                     -- 交叉配血结果原文
  note           TEXT,
  section_title  TEXT NOT NULL,
  supersedes_id  TEXT REFERENCES antibody_record(id),
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_record (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  date          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('transfusion', 'chelation', 'other')),
  amount_cents  INTEGER,                    -- 整数分；未知写 NULL
  insurance_flag TEXT,                      -- insured / self_pay / unknown
  note          TEXT,
  section_title TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  CHECK (amount_cents IS NULL OR amount_cents >= 0)
);

CREATE TABLE IF NOT EXISTS question_item (
  id            TEXT PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profile(id),
  text          TEXT NOT NULL,
  source_page   TEXT,                       -- 指回来源页 id（dashboard/transfusion/...）
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'asked', 'answered', 'dropped')),
  created_at    TEXT NOT NULL,
  section_title TEXT NOT NULL
);

-- ---------- 索引 ----------
CREATE INDEX IF NOT EXISTS idx_transfusion_date ON transfusion(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_iron_date        ON iron_lab(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_growth_date      ON growth_measure(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_metrics_code     ON metrics(profile_id, code, date);
CREATE INDEX IF NOT EXISTS idx_candidates_stat  ON candidates(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_stat   ON question_item(profile_id, status);
