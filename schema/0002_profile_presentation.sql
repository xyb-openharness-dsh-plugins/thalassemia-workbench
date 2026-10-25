-- 0002：档案的"展示字段"落到库里（只增不改；0001 不动）。
-- 为什么单独一版：原型与开发版必须逐字符一致，展示用的 meta/headline/mindset/dash_keys
-- 原本只存在于 demo 生成器里，读模型拼不出来 → 一旦进库就能 parity 逐字对齐。
ALTER TABLE profile ADD COLUMN meta_text TEXT;
ALTER TABLE profile ADD COLUMN headline_text TEXT;
ALTER TABLE profile ADD COLUMN mindset_text TEXT;
ALTER TABLE profile ADD COLUMN dash_keys TEXT;
