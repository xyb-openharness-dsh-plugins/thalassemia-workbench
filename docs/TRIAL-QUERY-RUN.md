# 地贫试验 MCP 实际查询记录

日期：2026-10-25（Asia/Shanghai）。本轮仅允许修改采集脚本、临床输出目录与本报告，不修改应用、schema、通用测试，不安装、不发布、不写用户配置。

## 配置与运行前核对

- 已读取 [MCP README](/Users/sammini/Downloads/unified_search_trials/README.md#L293-L317) 与 [stdio 配置示例](/Users/sammini/Downloads/unified_search_trials/README.md#L349-L361)、[package](/Users/sammini/Downloads/unified_search_trials/package.json#L1-L18)。该 MCP 仓库没有检索到 AGENTS.md。
- MCP package `0.3.1`，仓库 HEAD `d104176`；当前 Node `v22.19.0`，满足要求 `>=22.13.0`。
- 按官方 stdio 入口启动短生命周期子进程：`node <MCP>/dist/src/cli/main.js serve`；用已有 MCP SDK Client 调用工具，完成后关闭 transport，不注册用户配置、不启动常驻服务器。
- `doctor` 实际退出码 **1**，官方含义为“部分未就绪/降级可用”，不是全渠道成功。ICTRP 上游入口可用且 lowerBound=true；CDE 显示会话已配置（未读取/打印值）；CTV 缺上游目录与本地索引；ChiCTR 在线未配置；两份离线档案均未配置，且已知本病无覆盖。
- 原项目脚本原先永不查询，且会删除重建 research 目录数据库；本次改为实际 MCP 只读查询，输出仅 [临床资产目录](../assets/clinical/manifest.json)，不触碰旧 research 快照。未执行 bootstrap/configure/refresh/sync/install。

## 查询口径与限制

[采集脚本](../scripts/fetch-tdt-trials-2026.mjs) 先 `get_source_status`，再调用两次 `search_trials`：关键词分别为 `thalassemia`、`地中海贫血`；每次显式选择 `ictrp`、`ctv`、`chictr_online`、`chinadrugtrials`。起始窗口 `2026-01-25` 至 `2026-10-25`，每来源 limit=200、offset=0。

工具 schema 的 `startDateFrom/To` 表示**研究起始日期**，不是登记/更新日期；本轮不伪装为登记更新窗口。仅第一页有界查询，未宣称穷尽全部别名、分页或所有仍招募研究；更早开始但仍招募研究可能遗漏。两份胰腺癌离线语料不作本病来源。跨来源合并由 MCP 按确认登记身份负责；本脚本跨查询按返回的规范登记机构+登记号分组，缺登记号才回退来源 recordId，保留各成员，不按相似标题合并。

终态、coverage/completeness、原始错误和查询参数保存在 [完整响应](../assets/clinical/query-responses.json)，行数/hash/完整性保存在 [manifest](../assets/clinical/manifest.json)。失败不等于0结果，登记≠有效≠安全≠可入组。空资产不是患者匹配度0%。

## 本次结果

实际查询于 2026-10-25 14:53:56–14:54:52（Asia/Shanghai）完成。脚本 exit0 仅表示产物落盘与 SQLite 完整性通过，**不表示四源成功、窗口合规或覆盖完整**。

| 关键词 | ICTRP | CDE / ChinaDrugTrials | CTV | ChiCTR 在线 |
| --- | --- | --- | --- | --- |
| thalassemia | SUCCESS / OK，返回200；truncated=true，rowsReturned=1010，lowerBound=true | NO_RESULTS / EMPTY_RESULT_SET，0条；仅该源本次口径无命中 | NEEDS_SETUP / CTV_MCP_NOT_CONFIGURED | NOT_ENABLED / CHICTR_ONLINE_NOT_CONFIGURED |
| 地中海贫血 | FAILED / UPSTREAM_UNKNOWN_ERROR：`ictrp_search 上游返回错误：上游工具返回 isError，但未提供错误详情。` | SUCCESS / OK，41条，upstreamReportedTotal=41；recordsIncomplete=true | NEEDS_SETUP / CTV_MCP_NOT_CONFIGURED | NOT_ENABLED / CHICTR_ONLINE_NOT_CONFIGURED |

- 真实调用：get_source_status 1次（返回6源状态）、search_trials 2次（每次四源）、get_trial_detail 2次、get_record_evidence 2次。未额外翻页、未自动扩展12个月、未绕过验证挑战、未运行维护命令。CDE 返回的 coverage 描述为受控归档，不能冒称官网实时全量；未验证上游内部缓存/归档行为。
- 原始返回候选 **241**（ICTRP200+CDE41）；规范登记身份分组后 **241**，未发现跨查询相同登记身份组。本轮仅为候选数据，不是241条确认合适/可入组研究。
- 241组都缺可核实的研究 start 日期：verifiedInWindow=0、outsideWindow=0、unknownStartDate=241。请求虽带日期参数，**无证据证明各源实际严格执行9个月窗口**；未知不等于已合规，也不等于全部窗口外。英文结果第一条甚至是健康受试者研究，说明关键词命中不代表适合地贫患者，仍须逐项入排条件核验。
- 详情/证据抽样仅2条 ICTRP：`ictrp:CTIS2025-525025-12-00`、`ictrp:NCT07774351`。两次详情均返回数据；每条返回3个证据引用。仅代表引用元数据取得，未在本轮逐个打开证据文件/核实原文，不扩大为241条证据均核实。
- JSONL=241行、SQLite trials=241、source_status=8（2查询×4源）；`PRAGMA integrity_check=ok`；manifest记录数/SQLite数一致，JSONL sha256实测与manifest一致。原始来源coverage/completeness和错误保留；manifest明确coverage=partial、clinicalCoverageComplete=false、candidateOnly=true。
- 新脚本支持 `--dry-run`（不写文件）与 `--rebuild-assets`（只从保存响应重建资产，不新增网络调用）。本轮查询后使用后者补齐登记身份分组和日期审计；不是声称联网重跑字节稳定。固定查询口径不保证实时来源不同时间返回相同条数。
- 提交前对3份JSON/JSONL扫描 credential赋值、Bearer、Cookie票据赋值、sk-key模式，命中均0；未读取/输出会话值。该扫描是辅助检查，不声称穷尽所有秘密类型；SQLite仅含已扫描候选JSON与来源状态JSON。
- 未触碰旧 research 冻结路径，未实现应用匹配、未装机、未发布、不宣称G2通过。后续优先补配置缺源、核实窗口实际语义、对候选按患者/健康受试者及入排标准核验，并经授权处理截断分页；不能将本快照直接包装成匹配完成。
