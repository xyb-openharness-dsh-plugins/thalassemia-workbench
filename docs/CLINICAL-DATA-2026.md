# CLINICAL-DATA-2026 · 临床试验库口径与覆盖（本轮：**未查过**）

> 唯一入口：`unified-trial-mcp`（MIT）。本机检查结果：**未安装**（`~/Downloads/unified_search_trials` 不存在）。
> 因此本轮**没有任何一条试验记录**，终态统一写「未查过」。**不把"没查到"写成"不存在"。**

## 一、本机事实（2026-10-25 实测）

| 检查项 | 命令 | 结果 |
| --- | --- | --- |
| 本地是否有 unified-trial-mcp | `ls ~/Downloads/unified_search_trials` | ❌ 不存在 |
| 离线语料是否覆盖地贫 | `corpora/manifest.json` | ❌ 不存在（且已知三个离线语料**只有胰腺癌**） |
| 是否尝试联网直连登记库 | — | ❌ 未尝试（工具契约要求走 MCP，不自己拼 URL） |

## 二、四件套交付状态

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `research/tdt/manifest.json` | 🔧 骨架 | 含 `generated_at`、`sources[]` 逐通道终态、`records: 0` |
| `research/tdt/trials-2026.jsonl` | 🔧 空文件（0 行） | 与 manifest `records: 0` 一致 |
| `research/tdt/tdt_trials_2026.sqlite` | 🔧 空表 | 表结构同其他仓，行数 0 |
| `research/tdt/README.md` | ✅ | 写清"未查过"与原因 |

**一致性断言**：`manifest.records === jsonl 行数 === sqlite COUNT(*)` → `0 === 0 === 0`（脚本可跑，值都是 0）。

## 三、逐来源终态（诚实口径）

| 通道 | 状态码 | 含义 | 本轮 |
| --- | --- | --- | --- |
| `ictrp`（WHO ICTRP） | `not_queried` | 未查过（工具未装） | ✅ 如实记 |
| `ctv`（Veeva/CTG 深度索引） | `not_queried` | 未查过；且本地无索引 | ✅ |
| `chictr_online`（ChiCTR 实时） | `not_queried` | 未查过 | ✅ |
| `chinadrugtrials`（CDE） | `not_queried` | 未查过 | ✅ |
| ChiCTR 离线语料 | `not_configured` | 该语料只覆盖胰腺癌 | ✅ |
| 小胰宝归档 | `not_configured` | 同上 | ✅ |

## 四、采集脚本契约（M4 实现 `scripts/fetch-tdt-trials-2026.mjs`）

```
node scripts/fetch-tdt-trials-2026.mjs [--dry-run] [--out research/tdt]
```

- 关键字：`地中海贫血`、`thalassemia`、`thalassaemia`、`输血依赖`、`β-地中海贫血`、`去铁`、`铁过载`。
- 必须支持 `--dry-run`（只打印将发出的查询与通道，不写文件）。
- **同口径重跑条数可复现**：固定 `data_cutoff`，不允许"今天跑到几条算几条"。
- 多通道结果只在**确认同一登记身份**（登记号一致）时合并，其余并排保留来源。
- 任何异常 → 该通道终态写实际错误码，整体仍写出 manifest（不许因一个通道失败就不写文件）。
- 调用方不许传 URL / 超时 / 路径（工具契约）。

## 五、什么时候能填真数据

1. 装 unified-trial-mcp（`git clone` + `npm i` + `npm run build` + `npm run doctor`）；
2. `get_source_status` 四通道都通；
3. 跑脚本，`--dry-run` 与实跑条数一致。

在此之前，**界面上的"临床研究"页签（若有）只能显示"未查过"空态**，不显示任何编造条目。
本轮 `src/pages.json` 未设独立"临床研究"一级页，试验线索挂在 `就诊准备` 的"报告与任务"下（空态）。
