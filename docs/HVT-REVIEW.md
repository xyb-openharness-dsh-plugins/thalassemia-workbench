# HVT 评审 · X1–X4（机器断言）

- 生成时间：见 docs/HVT-PROBE.json（本文件不再写入时间戳，避免每次跑都产生无意义 diff）
- 生成方式：`node scripts/check-hvt.mjs`（读 `src/pages.json` + `src/paths.json`，在无头 Chrome 里逐条走）
- 结论：**全部 PASS**

| 层 | 断言 | 结果 | 证据 |
| --- | --- | --- | --- |
| X1 | views | PASS | `{"total":13,"covered":13,"orphan":[]}` |
| X1 | subs | PASS | `{"total":45,"covered":45,"orphan":[]}` |
| X1 | paths | PASS | `{"paths":16}` |
| X2 | S00 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S01 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S02 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S03 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S04 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S05 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S06 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S07 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S08 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S09 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S10 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S11 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S12 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S13 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S14 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | S15 | PASS | `{"visible":true,"clicked":true,"subOk":true}` |
| X2 | console | PASS | `{"errors":[]}` |
| X3 | dashboard | PASS | `{"primary":1,"more":4,"forms":0}` |
| X3 | transfusion | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | iron | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | growth | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | screening | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | genetics | PASS | `{"primary":0,"more":0,"forms":0}` |
| X3 | cost | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | glossary | PASS | `{"primary":0,"more":0,"forms":0}` |
| X3 | nutrition | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | mind | PASS | `{"primary":0,"more":0,"forms":0}` |
| X3 | records | PASS | `{"primary":0,"more":1,"forms":0}` |
| X3 | timeline | PASS | `{"primary":0,"more":0,"forms":0}` |
| X3 | review | PASS | `{"primary":0,"more":0,"forms":0}` |
| X4 | candidate-created | PASS | `{"count":1}` |
| X4 | reject-zero-side-effect | PASS | `{"tags":["已拒收"],"acceptedInData":0}` |
| X4 | accept-writes | PASS | `{"tags":["已拒收","已入档"],"acceptedInData":1}` |

## 口径

- **X1**：页面树与路径表双向覆盖；孤儿页 = 0。
- **X2**：入口文案在看板可见 + 点击后 hash 落到目标页 + 目标 (view,sub) 有正文。
- **X3**：直接打开写入表单的 `.primary` 按钮每页 ≤1；手工入口统一收在卡片「⋯ 更多」；页面内无裸 `<form>`。
- **X4**：AI 产出候选必核；拒收后事实层无新增；接受才入档。

> 本文件是生成物，不要手改；改断言请改 `scripts/check-hvt.mjs`。
