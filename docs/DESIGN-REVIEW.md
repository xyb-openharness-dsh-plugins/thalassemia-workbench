# DESIGN-REVIEW · 小铁宝 FerroPal

- 评审人：独立子代理（不共享开发者上下文）
- 日期：2026-10-25
- 评审对象：git HEAD b3c71e8
- 复跑结果：check=staticPass:true / test=33/33 / diff=46.2% / probe=26/26 / hvt=0 failed / voice=0 errors

> 复跑明细（全部实测，与构建方自报一致）：`npm run check`（staticPass:true，33 tests / 33 pass / 0 fail）、
> `npm test`（33/33）、`node scripts/measure-diff.mjs`（一级 6/13 = 46.2%，二级 9/45 = 20% 与 7/45 = 15.6%，判定 PASS）、
> `node scripts/probe-prototype.mjs`（total 26 / passed 26 / failed 0）、`node scripts/check-hvt.mjs`（failed 0；
> X1 views 13/13、subs 45/45、paths 16、orphan none）、`node scripts/check-voice.mjs`（pages 13 / voices 13 /
> public 6 / hypothesis 7 / interview 0 / errors []）、`git rev-parse --short HEAD` = b3c71e8。
>
> 反例说明：自报全绿**不等于**闭环成立——下面 6 条 P0 全部在 33 个测试与 26 条探针全绿的情况下存在，
> 原因是**闸门断言的对象比文档承诺的对象弱**（逐条见证据）。这是本轮评审的主要发现。

## 一、结论

**P0 6 条 / P1 12 条 / P2 5 条。**

**不建议签认 G2。**

一句话理由：写通道（`public/app.js` 零 `fetch`/POST）、整页视图、IP10 示例、G2 节奏层界面四处**核心模块无挂载点**，
另有依从热力图与"下次预约"两处**伪造事实层**违反 M1/M5/M6 红线；全绿是因为 `check-hvt.mjs` 与 `probe-prototype.mjs`
断言的是内存对象与"组件存在"，而不是"接到宿主且真的写进去"。

按 `prompts/ZERO-TO-DEV.md:224` 的约定，P0 需修复留痕（commit 号）后才可交签认。

## 二、检验单（13 项）

| # | 检验项 | 结论 | 证据（文件:行号或命令输出） |
| --- | --- | --- | --- |
| 1 | 医生任务冒充患者需要 | PASS | 生殖页只给 4 个"问医生"问题、明写"不计算风险百分之几"（`prototypes/v0.2/app.js:507-512`）；T2\* 不标注区间不判读（`app.js:433`）；筛查计划日只取医嘱原文（`app.js:492`）。**WARN**：`app.js:99` 并列的 G1-16 摘录含"0.5～1U/10kg""维持 90～140g/L"剂量文本，虽经 `docs/GUIDELINE-BRIDGE.md:75-76` 授权并列，仍是最易被误读为推荐值的一处 |
| 2 | 证据成立性 | PASS | 6 条 `public` 全部带编号出处、7 条 `hypothesis` 全带徽章（`app.js:54-68`）；`check-voice` 13/13、interview 0。**WARN**：F07 界面文案与 `docs/FEATURE-LINES.md:16` 不逐字一致（见 P1-1） |
| 3 | 解释价值 vs 记录本 | WARN | AI"整理"实为正则回声：`app.js:1095` `const guess = /(\d{2,4})/.exec(text)`，字段靠 `/铁蛋白/`、`/输/` 关键词猜（`app.js:1099`），无真实抽取。候选-确认闭环本身成立（X4 三条 PASS），但解释价值目前是模板句 |
| 4 | 营养心理照护完整度 | PASS | 术语页正面对照"地贫是贫血要补铁"误解（`app.js:555-556`）；营养页含"多吃猪肝补血/红枣红糖补血"误区（`app.js:586-587`）与"只给要问医生的清单、不给食谱"（`app.js:577`）；心理 4 子页 + 私密闸门（`app.js:598-621`），与 `docs/DEV-REQUIREMENTS-2026-10-25.md:116` M4 一致 |
| 5 | 四核心模块 | PASS | 看板/资料库/一图秀/就诊准备均在 `src/pages.json`；一级重名 6/13 = 46.2% ≤70%，二级 20% / 15.6% ≤30%（`node scripts/measure-diff.mjs` 实测） |
| 6 | 双主体冲突处理 | WARN | "家长代记"徽章只在档案字段与设置页出现（`app.js:631`、`app.js:867`）；`app.js:977` 的 `switch-profile` 切的是 A/B 两个档案，**不是**"本人/代记"视角。`docs/DIFF-MATRIX.md:25` 声称的"同一账号双视角"在界面无切换入口 |
| 7 | 范围适当性 | PASS | 无治疗线折页、无分期页、无 CTCAE 分级（`docs/DIFF-MATRIX.md:57-62`）；`docs/METRIC-GRADING.md:8` 0 项分级且界面无级别徽章。**但** `next_due` 越界，见 P0-6 |
| 8 | 医学来源时效 | FAIL | `app.js:85-106` 的 `GUIDE_REFS` 只硬编码 **10** 条（G1-01/02/05/07/11/14/16/17/22/23），`assets/reference/guideline/refs.json` 实有 **24** 条；`docs/GUIDELINE-BRIDGE.md:44` 标题写"15 条"，与两者都不符；`app.js:589` 仍写"本轮未取得指南原件"，与 `GUIDELINE-BRIDGE.md:18`（三份原件已取得）自相矛盾 |
| 9 | S→F→A 同源一致 | FAIL | `docs/INTERACTION-DESIGN.md:13-24` 场景表只有 S01–S12（12 条），`src/paths.json` 实为 S00–S15（16 条）；S00 与 S13/S14/S15 无场景文档，F 线与 S 路径之间无任何显式映射表。`check-hvt.mjs` X1（`:30-37`）只断言 views/subs 全覆盖，不断言 S↔F↔A 三方对齐 |
| 10 | 假设不冒充事实 | PASS | 7 条 hypothesis 全部渲染"假设句 · 未经访谈核实"（`app.js:69-80`），`check-voice` V4 断言该字面量存在；V5 拦"我们访谈了/访谈了 N 位"（`scripts/check-voice.mjs:52-58`）；`docs/FEATURE-LINES.md:53` 规定 hypothesis 冒充引语 = P0，实测 0 例 |
| 11 | 差异化真实性 | PASS | §三 12 条逐条在原型有可见入口（12/12 走查可见）；4 处"刻意不同"未被统一（`app.js:672-673` 分类只画节点、`app.js:515` 无风险比例）。**WARN**：`docs/DIFF-MATRIX.md:64-68` 五个判据框仍是未勾选的 `[ ]` |
| 12 | 红线（判读列/建议性文案/三态/private 三出口/候选闭环） | FAIL | 判读列 0 命中（`check-schema` 13 表、errors []）、禁词 0 命中（`check-wording` errors []）。但：**伪造三态** P0-5、**推算"下次预约"** P0-6；private 三出口只落实到一句声明"心理与家庭模块默认不导出"（`app.js:937`），导出函数 `exportReview()`（`app.js:926-951`）根本不遍历 mind 数据（按 omission 而非按 filter），AI 与摘要两个出口也没有可过滤的真实私密数据源（`app.js:604-611` 是 4 段硬编码字符串） |
| 13 | 交互门槛 IP1–IP10 | FAIL | IP10「每个一级页 ≥1 处示例」**零实现**（P0-3）；探针 `IP10-a` 退化为"输入框存在"（`scripts/probe-prototype.mjs:138-145`）；IP4/IP5/IP6/IP7/IP8/IP9 无任何脚本断言（grep `IP[0-9]` 仅命中 IP2/IP3/IP10 三处） |

## 三、问题清单

### P0（结构性断链 / 红线被破）

**P0-1（②断链）装机版写通道完全未接线：所有"保存"只改内存，刷新即丢。**
`public/app.js` 与原型逐字节一致（`test/ui-parity.test.mjs` 的"源码字节一致"通过），全文件 `fetch(` 出现 **0 次**；
`save-transfusion`（`prototypes/v0.2/app.js:991-1008`）只做 `p.transfusion.rows.push(...)` 并改 `window.DEMO_DATA` 内存对象。
而服务端三个写路由已就绪却**无任何调用者**：`dsh/server.js:134`（POST /api/transfusion）、`:143`（/api/ferritin）、`:152`（/api/question）。
`public/bootstrap.js:38` 只有一处 `GET /api/bootstrap`。
闸门为何全绿：`scripts/check-hvt.mjs:100-114` 的 `accept-writes` 断言读的是
`window.DEMO_DATA.profiles.A.candidates`（内存），从不校验一次网络写，也从不重载验证。
→ 装机后"记这次输血"成功提示照常弹出，但数据在刷新后消失，且**无任何用户可见提示**。
建议落点文件：`prototypes/v0.2/app.js`（引入 `API_BASE` 与 POST 封装）、`public/app.js`（构建后同步）、
`scripts/check-hvt.mjs`（X4 增加"POST 后重载仍有该行"断言）。

**P0-2（②断链）整页视图无挂载点，且验收探针打的是脚手架演示而非原型。**
`openPageView()` 定义在 `prototypes/v0.2/app.js:715`，全仓 grep `openPageView` 仅命中该定义行与
`scripts/probe-prototype.mjs:203` 的一句注释；`data-act="pv-back"`/`"pv-close"` 只出现在模板自身（`app.js:776,778`），
没有任何业务按钮触发它。`state.pageview` 因此永远为 `null`，`app.js:770` 的分支是死代码。
受影响交付物与场景：`docs/DEV-REQUIREMENTS-2026-10-25.md:59` 的 P10、`docs/INTERACTION-DESIGN.md:23` 的 S11（点数据点 → 整页视图）。
更关键的是验收对象错位：`scripts/probe-page-view.mjs:5` 明确"对象：examples/page-view.html"，
`:74` 默认 URL 指向 `${PORT}/examples/page-view.html`——**A1–A10 十三条断言从未运行在 FerroPal 原型上**，
所以"P10 由 probe-page-view.mjs A1–A10 验"这条接线是空的。
建议落点文件：`prototypes/v0.2/app.js`（在记录行/报告原文/图表数据点接 `openPageView`）、
`scripts/probe-page-view.mjs`（增加指向原型的 `--url` 并纳入 `npm run check`）。

**P0-3（②断链）IP10 / agent-draft 无任何渲染点。**
`app.js:1063` 有 `if (act === 'agent-draft')` 分支（预写提示词、不自动发送），但全仓无一个元素带
`data-act="agent-draft"`（grep 仅命中该 handler 自身与 `public/app.js` 的同名副本）。
`docs/INTERACTION-DESIGN.md:59` 的 IP10 要求"每个一级页 ≥1 处示例"，实测 **0/13**。
`docs/DEV-REQUIREMENTS-2026-10-25.md:92` F10 要求"AI 按钮走 `xxx:agent-draft` 一键携带提示词 + 病情上下文"，
原型既无触发点，也无任何与宿主会话的通信（`src/client.js` 169 行内无 `postMessage`/draft 相关代码）。
闸门为何全绿：`scripts/probe-prototype.mjs:138-145` 的 `IP10-a` 在注释里就写明"顶栏没有 draft 按钮时退化为直接检查 draft 机制存在"，
最终只断言 `!!document.querySelector('#agent-input')`。
建议落点文件：`prototypes/v0.2/app.js`（在 `pageHead` 每页加 `data-act="agent-draft"` 按钮）、
`scripts/probe-prototype.mjs`（IP10-a 改为断言每页 draft 按钮数 ≥1）。

**P0-4（②断链）G2 节奏层：文档标"✅ 启用"，后端有实现，界面零消费者。**
`docs/GUIDELINE-BRIDGE.md:26` 声明 G2「✅ 启用」，交付物是 `assets/reference/guideline/cadence.json` + `dsh/cadence.js`，
并要求"显示带宽 ±30 天须在界面标注"。后端确实到位：`dsh/index.js:51-58` 导出 `cadence()`（checks / band_note / helpers），
`dsh/server.js:129` 暴露 `GET ${prefix}/api/cadence`。
但全仓 `cadence`/`checkpoints` 的引用只存在于 `dsh/`、`assets/`、`test/` 三处——
`prototypes/v0.2/app.js`、`public/app.js`、`src/client.js`、`lib/client.js` **零引用**。
界面唯一沾边的是 `app.js:401` 一句静态文案"显示带宽是工作台口径"，其后并没有任何节点或带宽被渲染。
即：G2 的"启用"只启用在数据层，患者永远看不到参考节点与 ±30 天带宽。
建议落点文件：`prototypes/v0.2/app.js`（vScreening/vTransfusion 经 `/api/cadence` 渲染节点与带宽）、
`docs/GUIDELINE-BRIDGE.md:26`（若本轮不做界面，应把"✅ 启用"改回 ⏳，并同步 `docs/DEV-REQUIREMENTS-2026-10-25.md:125`）。

**P0-5（③红线）依从打卡热力图用日期哈希伪造"已做/未做/未记"三态。**
`app.js:435` 注释自称"三态（已做/未做/未记）"，紧接着 `app.js:439-440`：
`const seed = (Number(d.replace(/-/g,'')) * 2654435761) % 97` / `const st = seed < 70 ? 'done' : seed < 82 ? 'miss' : 'none'`。
即 28 天的"完成/漏做"状态是**日期字符串的纯函数**，与任何记录无关；数据层也没有依从表
（`schema/0001_initial.sql` 共 13 张表，全仓 grep `adherence` 0 命中）。
直接违反 `docs/METRIC-GRADING.md:18`「依从性…漏记 ≠ 未做 → 打卡日历（三态：已做/未做/未记）」与 M6（`DEV-REQUIREMENTS:118`），
同时 `docs/DIFF-MATRIX.md:41` 把"热力图与打卡同源"当作验证判据——实际不同源。
这是把伪造的三态当成患者事实呈现，属红线被破，不是演示瑕疵。
建议落点文件：`prototypes/v0.2/app.js`（改读真实打卡数据；无数据时整块降级为空态"还没有打卡记录"）、
`schema/`（新增迁移建 adherence 表，只增不改）。

**P0-6（③红线）"下次预约"由 `上次输血日 + 20 天` 推算，工作台自行发明治疗节律。**
`app.js:1005-1006`：`const d2 = new Date(last[0] + 'T00:00:00+08:00'); d2.setDate(d2.getDate() + 20)` → `next_due`；
同一算式复制到读模型 `dsh/readmodels.js:91`（`next_due: last ? addDays(last.date, 20) : null`）与
`demo/build-demo-data.mjs:249`。看板把它渲染成"下次预约 YYYY-MM-DD（还有 N 天）"（`app.js:277`）。
`transfusion` 表没有任何 `planned_date` 列（`schema/0001_initial.sql:80-95`），所以这个日期**没有医嘱出处**。
违反 `docs/DEV-REQUIREMENTS-2026-10-25.md:117` M5（输血周期一律不给默认推荐值）与
`docs/GUIDELINE-BRIDGE.md:71`（不推算"该查了"；是否该查由 `planned_date` 医嘱原文决定）。
`docs/FEATURE-LINES.md:10`（F01）支撑的是"下次输血日要一眼看到"——即**显示医嘱给的日期**，不是让工作台造一个。
建议落点文件：`prototypes/v0.2/app.js:1005-1006`、`dsh/readmodels.js:91`、`demo/build-demo-data.mjs:249`
（改为读 `planned_date` 医嘱字段；缺失则显示"下次输血日：未记录医嘱"）。

### P1（文档滞后、可改进）

1. **F07 原话界面与文档不逐字一致**：`docs/FEATURE-LINES.md:16` 为「这些排铁药都是进口的，28片2100元……」，
   界面 `app.js:61` 多出"，像这一盒瑞士进口的"。`docs/FEATURE-LINES.md:53` 要求"逐字一致"。
   闸门为何放过：`scripts/check-voice.mjs:40` 只比 `plain.slice(0, 14)` 前 14 字。
   建议落点：`app.js:61` / `public/app.js:61` 对齐 FEATURE-LINES；`scripts/check-voice.mjs:40` 改为全串相等。
2. **G1 条目数三处不一致**：`docs/GUIDELINE-BRIDGE.md:44` 写"15 条"，`refs.json` 实有 24 条，`app.js:85-106` 硬编码 10 条。建议落点：`docs/GUIDELINE-BRIDGE.md:44`。
3. **原型维护了 refs.json 的第二份副本**：`app.js:85-106` 的 `GUIDE_REFS` 与 `assets/reference/guideline/refs.json` 同源不同步（10 vs 24），违反 `app.js:5` 自述的"唯一源"约定。建议落点：`prototypes/v0.2/app.js`（改为从注入数据读 refs）。
4. **`DEV-REQUIREMENTS:125` 与 `GUIDELINE-BRIDGE:26` 直接冲突**：前者写"G1/G2/G3 三层本轮不启用"，后者写 G1 ✅ / G2 ✅。建议落点：`docs/DEV-REQUIREMENTS-2026-10-25.md:125`（注明已被 GB 取代）。
5. **术语/营养页残留过期免责句**：`app.js:589` "本轮未取得指南原件"在 G1 启用后已不成立（对照 `GUIDELINE-BRIDGE.md:18`）。建议落点：`app.js:589`、`public/app.js:589`。
6. **手工通道 11/14 项退化为提示 toast**：`app.js:919` 把非白名单动作统一降级为 `demo-only`，`app.js:988` 只弹"原型演示：此入口在开发版接真实表单"；真正有表单的仅 `save-transfusion`/`save-ferritin`/`save-growth` 三项。而 `docs/INTERACTION-DESIGN.md:28-44` 的 CRUD 矩阵逐实体承诺 3–6 字段表单。建议落点：`app.js:897-924`。
7. **`check-wording` 有整行豁免后门**：`scripts/check-wording.mjs:31` 对含 `wording-allow`/`eslint-disable`/`BANNED`/`const JUDGE` 的行**整行 skip**，任一行加个注释即可绕过全部禁词。实测 `app.js:6` 与 `app.js:448` 已带该标记。建议落点：`scripts/check-wording.mjs:31`（只豁免词表定义行，且按语句而非整行）。
8. **`// wording-allow` 出现在渲染字符串里**：`app.js:448` 的 `<p class="note-line">…没记"。 // wording-allow</p>`，注释会随 innerHTML 一起显示给用户。建议落点：`app.js:448`、`public/app.js:448`。
9. **百分位参考表无出处**：`app.js:371-379` 的 `REF_TABLE`（male6/female24 的 h50/hsd）为自造数值，注释自认"参考值未取得指南/标准核对"，界面输出"身高约第 N 百分位（示例参考表 · 未核对）"（`app.js:377`）。自披露使其不构成红线，但 `docs/DIFF-MATRIX.md:37` 把"百分位算法单测"列为已验证项，实际无参考标准版本可核。建议落点：`app.js:371-379` 补标准名与版本，或降级为不显示百分位。
10. **`DIFF-MATRIX` 判据框全部未勾**：`docs/DIFF-MATRIX.md:64-68` 五行仍是 `[ ]`，而同文件 `:9-17` 已给出实测数字。建议落点：`docs/DIFF-MATRIX.md:64-68`。
11. **场景路径文档缺 4 条**：`src/paths.json` 有 S00–S15（16 条），`docs/INTERACTION-DESIGN.md:13-24` 只有 S01–S12。S00（回到看板）、S13（看懂一个词）、S14（记一件孩子在学校的难处）、S15（查今天吃什么）均无入口/成功/失败态文档。建议落点：`docs/INTERACTION-DESIGN.md`。
12. **评审命令会改仓库文件**：`scripts/check-hvt.mjs:119-120` 直接写 `docs/HVT-PROBE.json` 与 `docs/HVT-REVIEW.md`，`scripts/probe-prototype.mjs:264` 写 `docs/PROTOTYPE-PROBE.json`。按任务书复跑第 1 步就会产生非预期 dirty（本次已 `git checkout -- docs/HVT-REVIEW.md` 还原；该文件原本只有时间戳一行差异）。建议落点：两个脚本改为 `--write` 显式开关才落盘。

### P2（记录不阻塞）

1. **AI 抽取仅正则**：`app.js:1095` `/(\d{2,4})/` 取第一个 2–4 位数字，字段由关键词决定（`app.js:1099`）。候选需用户点头才入档，故不构成红线，但"整理"价值接近于零。建议落点：`app.js:1095-1101`。
2. **`public/app.js` 与原型逐行重复**：靠 `test/ui-parity.test.mjs` 保一致，缺陷同源复制（P0-1/P0-5/P0-6 均双份存在）。记录用。
3. **`check-hvt` X3 断言偏松**：`scripts/check-hvt.mjs:85` 仅断言 `counts.primary <= 1 && counts.forms === 0`，不校验"每页恰好一个显式编辑入口"的语义。记录用。
4. **`VERSION = 'v0.3.1'`（`app.js:14`）与目录名 `v0.2` 并存**：版本号与目录名不一致，属命名滞后。记录用。
5. **`examples/page-view.html`（5252 字节）存在但未标注与原型的关系**：易被误读为原型已实现整页视图（见 P0-2）。记录用。

## 四、我认为最该被证伪的三个假设

1. **"33 个测试 + 26 条探针全绿 ⇒ 交付物可用"。**
   这是我本轮最想被推翻、也最可能站得住的判断。四个 P0（P0-1 写通道、P0-2 整页视图、P0-3 IP10、P0-4 节奏层）
   在闸门全绿时同时存在，因为断言普遍止步于"组件存在 / 内存对象变更"。若有人能指出某条命令真的走了
   `POST /api/transfusion` 并重载验证，或 `probe-page-view.mjs --url` 真的打过原型，我立刻撤回对应 P0。
   证据面：`scripts/check-hvt.mjs:100-114`、`scripts/probe-prototype.mjs:138-145,203`、`scripts/probe-page-view.mjs:5,74`。

2. **"演示数据可以就地伪造状态，只要原型标了演示"。**
   依从热力图与"下次预约"都不是占位文案，而是**结构化呈现的患者历史**，读者无法区分"演示"与"这位患者第 12 天漏做了"。
   我据此判 P0。可被证伪的方式：若 `docs/DEV-REQUIREMENTS-2026-10-25.md` 或 HVT 评审里存在一条
   "原型允许按日期生成三态数据"的明文授权，则应降为 P1。我在 `METRIC-GRADING.md:18`、M1/M5/M6、
   `GUIDELINE-BRIDGE.md:71` 中只找到相反规定，未找到授权。

3. **"13 条功能线 ↔ 13 个一级页一一对应 ⇒ 场景-功能-验收同源"。**
   实证是三个编号体系互不咬合：F01–F13（`docs/FEATURE-LINES.md:10-22`）、S00–S15（`src/paths.json`，其中 4 条无文档）、
   IP1–IP10（`docs/INTERACTION-DESIGN.md:46-59`，其中 8 条无断言）。数量相等掩盖了没有映射表这一事实。
   若有人能给出 F↔S↔IP 三列对照表且逐行有脚本断言，这一条应改为 PASS。
