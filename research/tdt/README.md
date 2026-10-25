# 地贫临床研究库（2026 采集）

> **本轮未查过。** manifest.records = 0，jsonl 0 行，sqlite 0 行——三者一致。
> 0 条 ≠ 不存在；本文件不提供任何"某药在某试验中有效"的说法。

- 数据截止日：2026-10-25
- 采集方式：unified-trial-mcp（MCP stdio，四通道）。本机检查结果：**未安装**。
- 逐通道终态见 `manifest.json` 的 `channels[].terminal`（全部 `not_queried` / `not_configured`）。
- 口径文档：[`docs/CLINICAL-DATA-2026.md`](../../docs/CLINICAL-DATA-2026.md)

## 复采步骤

1. `git clone git@github.com:opencare-skillhub/unified-trial-search-mcp-service.git ~/Downloads/unified_search_trials`
2. `npm install && npm run build && npm run doctor`（四通道 `get_source_status` 必须全通）
3. `node scripts/fetch-tdt-trials-2026.mjs --dry-run` 核对待发查询
4. `node scripts/fetch-tdt-trials-2026.mjs` 实跑，检查三处记录数一致
