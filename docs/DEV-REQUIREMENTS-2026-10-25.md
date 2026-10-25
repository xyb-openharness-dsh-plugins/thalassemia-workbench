# 强约束文档 · 小铁宝 FerroPal（重型地中海贫血 / 输血依赖型 TDT）

- 日期：2026-10-25
- 版本：v1（M0 交付物，后续只追加不推翻；推翻需在该条下写"作废原因"）
- 样板基准：`cervical-workbench` v0.1.1（client 链路底本，逐字符对齐对象）
- 成熟对比基准：`breast-cancer-workbench` v0.12.0（**26 号口径**：四核心模块 + 营养/心理/复诊/资料）
- 认领 Issue：[#34](https://github.com/xyb-openharness-dsh-plugins/.github/issues/34)
- 仓库：`thalassemia-workbench`（private）
- 品牌占位：**小铁宝 / FerroPal**（可整体替换；替换点见 §五 D4）

> 本文件是"范围与红线"的唯一来源。`docs/DEV-PLAN.md` 是"进度与里程碑"的唯一来源。
> 两者冲突时：范围以本文件为准，进度以 DEV-PLAN 为准，并当场修正另一方。

---

## 〇、患者视角红线（独立评审一票否决项）

1. **每条功能线必须挂一句患者原话**，写在 `docs/FEATURE-LINES.md` 与对应页面源码注释里。
2. 原话必须有**证据状态**三选一：
   - `interview`：一手访谈（本轮 **0 条**）
   - `public`：公开患者/家长叙述，附 URL 与抓取日期（见 `research/patient-voices.md`）
   - `hypothesis`：由疾病轴推导的假设句，**必须显式标注"未经访谈核实"**，不得写成引语
3. **本轮 0 访谈**，所有 `hypothesis` 句一律不得以引号形式出现在界面或 README 中冒充一手引语。
4. **医生任务不得冒充患者需要**：凡是"医生要看的东西"（分期判读、影像结论、剂量决策），只能以
   "把原文整理好带去给医生看"的形态出现，不得做成医生工作流（如自动判读、自动建议方案）。
   独立评审（`docs/DESIGN-REVIEW.md`）把它列为 P0 级否决项。
5. 界面不出现：`建议治疗` / `可以停药` / `无需就医` / `治愈率` / `预后` / `是否达标` / `风险等级`。

---

## 一、范围：交付物 × 落点 × 怎么验

| # | 交付物 | 落点 | 怎么验 |
| --- | --- | --- | --- |
| 1 | 可点的 HTML 原型（四件套） | `prototypes/v0.2/{index.html,style.css,app.js,demo-data.js}` | `file://` 直接打开；页签穷举 0 空白；控制台 0 error；`body.scrollWidth === innerWidth` |
| 2 | 演示数据唯一源 | `demo/build-demo-data.mjs` → `demo/demo-data.sqlite` + `prototypes/v0.2/demo-data.js` | 重跑两次产物字节一致；不许手改 `demo-data.js` |
| 3 | 数据模型 | `schema/0001_initial.sql` + `schema/freeze-contract.md` | sha256 与实算一致；判读列断言 0 命中 |
| 4 | 临床研究库 | `research/tdt/{manifest.json,trials-2026.jsonl,tdt_trials_2026.sqlite,README.md}` | manifest 记录数 = jsonl 行数 = sqlite 行数；逐来源终态落库 |
| 5 | 开发版（宿主可装） | `dsh/*` + `public/*` + `src/client.js` → `lib/client.js` | `npm run check` 全绿；`npm test` 五套全绿；HVT X1–X4 一致 |
| 6 | 装机产物 | `release/*.tgz` + sha256 | 06 号四要素逐条对照 tgz 实清单；真机重启后新建会话可见 |
| 7 | 文档体系 | `docs/` 9 件 + `research/` | 每份文档的断言都能被某条命令/某张截图验证 |
| 8 | 回流 | starter 的 LESSONS / 编号文档 / 检查器待实施清单 | `start/check-starter` + `npm test` 绿 |

---

## 二、照抄样板的产品要求（不许按比例缩减）

| # | 要求 | 来源 | 怎么验 |
| --- | --- | --- | --- |
| P1 | 顶栏三段式：左=品牌+档案切换，中=页签，右=AI 助手开关 + 设置 | cervical `public/index.html` | 截图对照；`#agent-splitter`/`#agent-hide`/`#agent-label` 三个 id 必须存在 |
| P2 | AI 五态：关闭 / 收起 / 展开 / 调宽 / 生成中 | starter 20 号 | `ui-parity.test.mjs` 断言五态 |
| P3 | 面板默认右侧，宽 25%–45%，可拖可收；参数唯一源 `lib/layout.js` | starter 02/20 号 | 拖拽到两端夹取；`businessPanePx()` 单测 |
| P4 | 一图秀（`timeline`）：SVG `class="chart"`、单调三次插值 `smoothPath`（Fritsch–Carlson）、末点 13px 避让、分类序列只画节点不连线 | starter 16 号 + 32 号折叠卡 | 截图 + 单测（分类不进曲线） |
| P5 | 3D 卡：整卡 180° 翻转，背面是迷你折线 | starter 08/27 号 | 手点每张卡，分类卡不翻 |
| P6 | 折叠卡（治疗线 / 长列表）：收起态显示 1 行摘要 + 计数，展开态不撑破一屏 | starter 32 号 | 截图两张（收/展） |
| P7 | 页脚贴底 `min-height:calc(100vh - 32px)` + `flex:1`；`[hidden]{display:none!important}` | starter 03 号 | 截图 1440/1280/1024 三档 |
| P8 | 字号基线 12.5px，大字 15px；面板 25–45% | starter 03 号 | `ui-parity.test.mjs` 只允许字号差异 |
| P9 | README 按 33 号放实渲截图 ≥4 张（含折叠收/展态） | starter 33 号 | README 内图片路径全部存在 |
| P10 | 整页视图（32 号）：记录详情/报告原文/全屏图表从主页点开就是一整页，返回与关闭两个入口 | starter 32 号 | `scripts/probe-page-view.mjs` A1–A10 |

---

## 三、硬约束（每条带"错误来源"）

### 3.1 数据层

| # | 约束 | 错误来源 |
| --- | --- | --- |
| D1 | 复合主键表裸 `SELECT` 必须 `ORDER BY rowid` | 家族多仓 parity 红：无 ORDER BY 时 SQLite 返回顺序随插入批次变 |
| D2 | 手写倒序数组只 `ORDER BY ord`，**不叠 `DESC`** | 食管癌 M5：`ord DESC` 导致同一记录在两处顺序相反 |
| D3 | 可选字段显式写 `null`；读模型按 `=== null` 分支，不用 `undefined` 兜底 | 家族通用：`undefined` 序列化后键消失，parity 报"缺键" |
| D4 | SQLite 保留字 `using` → 列名一律 `in_use` | 家族通用（starter 22 号） |
| D5 | 每一节 `{title, rows}` 必须有对应 `*_title` 列 | 乳腺 parity：标题写死在读模型 → 用户改不了 |
| D6 | 分类指标 `dec IS NULL` 且 `kind ∈ {grade,qual}`；分类事件不进趋势曲线 | 16 号一图秀规格 |
| D7 | 化验/体征 2–4 周一点延续到今天；影像/内镜按真实频率**不加密** | 乳腺癌 v0.10：加密后曲线形状失真 |
| D8 | **本轮不设任何判读列**：无 `diagnosis` / `risk_level` / `severity` / `is_conclusion` / `grade_auto` | 一条患者视角红线 + 验收断言（`check-schema.mjs`） |
| D9 | 迁移只增不改：改结构只能新增 `0002_*.sql`；`0001` 冻结后加 sha256 | 头颈癌 M6：改 0001 导致已装机库与代码不一致 |
| D10 | 所有 INSERT 写**显式列名 + 显式问号数** | 家族通用：`INSERT INTO t VALUES(?)` 在加列后静默错位 |
| D11 | 派生值（如输血间隔天数、百分位）**读取时算、不落库** | 22 号：标准/参考值会升版，落库等于把旧口径写成历史事实 |

### 3.2 前端

| # | 约束 | 错误来源 |
| --- | --- | --- |
| F1 | 图标 key 走别名兜底（未知 key 不抛错） | 家族通用：新增页签时图标缺失白屏 |
| F2 | 内联 svg 必须给宽高 | 家族通用：无宽高在 flex 容器里塌成 0 |
| F3 | 二级页签按 `state.sub` 分流且**穷举测试** `(view, sub)` | 宫颈 parity：漏一个组合 → 空白页 |
| F4 | `[hidden]` 必须 `display:none!important` | 家族通用：面板收起后仍占位 |
| F5 | 页脚贴底；面板 25–45% 可拖可收 | 03 号 |
| F6 | 字号只允许 12.5px（大字 15px）两档，`ui-parity` 只容忍这一处差异 | 家族通用 |
| F7 | 数据加载两侧同验注入契约：`API_BASE = 挂载前缀`（独立启动空串，宿主 `/api/<slug>`），页面统一拼 `${API_BASE}/api/xxx` | GBM 踩 4：页面拼 `/api/api/...` → 装机全 404 |
| F8 | 启动期校验失败**渲染错误横幅，禁止裸 throw 白屏** | GBM/MPM 两轮 |
| F9 | 演示数据只有一个来源，`public/` 与原型逐字符对齐（只允许 3 个品牌变量 + 品牌字 + 英文名 + 字号差异） | 一条原则② + 逐字符对齐要求 |
| F10 | AI 按钮走 `xxx:agent-draft` 一键携带提示词 + 病情上下文；私密模块不进上下文草稿 | 20 号 + 宫颈 A4 |

### 3.3 工程

| # | 约束 | 错误来源 |
| --- | --- | --- |
| E1 | 改包必升版（`VERSION` + `package.json` + `CHANGELOG` 三处一致） | 家族通用 |
| E2 | `lib/version.js` 是生成物，不手改；字面量引用唯一源 | 家族通用 |
| E3 | `cordis.patch.yml` 的 `config.root: !!js dshHomePath('ferropal-workbench')` 必须在；注释只能放**条目之后**（文件须以 `- insert:` 开头） | 本仓 M0 实测：注释放首行 → `staticPass:false`（checker 用 `^-\s+insert:` 断言） |
| E4 | `dsh` 块（`bundle.patch` + `client.inject`）与 `repository` 必须在 `package.json` 里 | GBM 三连踩：init 生成物没有这两块，"文件存在"≠"接线完成" |
| E5 | 真客户端链路：`src/client.js` → `scripts/build-client.mjs` → `lib/client.js`；`check` 含 `build:client --check` | init 占位骨架（"接入骨架…待实现"）不能直接装机 |
| E6 | 运行期按拼出来的路径读目录（`schema/migrations/` 等）必须进 `files` 白名单 | 头颈癌 M6：装进去**静默空库**，服务能起、界面能开、列表全空 |
| E7 | `npm pack` 清单实测四要素对照（入口/补丁/客户端/public） | 06 号 |
| E8 | 并行写同仓以 `check` 为准合流并立即提交 | 硬纪律 |

### 3.4 医学口径

| # | 约束 | 错误来源 |
| --- | --- | --- |
| M1 | **只记录、不判读**：界面只显示"报告原文 + 日期 + 出处"，不出现"正常/异常/偏高/达标"。T2\*、铁蛋白、Hb 一律如此 | 一条红线：不做诊断与处置建议 |
| M2 | 引用医学内容必须有**署名出处与版本**；本轮未取得指南全文的，一律标「未核实」，不得用相邻疾病外推 | 22 号 + 本仓 `docs/GUIDELINE-BRIDGE.md` |
| M3 | 不复制指南临床正文，只引用病种名称、章节名、表号、≤200 字符摘录 | 版权红线 |
| M4 | 患者级误解必须被正面处理：**"地贫要补铁"是错的**——界面在术语页显式对照，且任何页面不得出现补铁建议 | 疾病常识 + 044 号红线 |
| M5 | 输血周期、去铁剂量等**剂量/阈值型内容一律不给默认推荐值**；只记"医嘱原文" | 处置建议红线 |
| M6 | 三态必须可区分：`已查 / 未查 / 未出报告`；判断不出来的写 `未核实`，不写"正常" | 23 号 |

---

## 四、本轮明确未做（不许在验收里算通过）

1. **0 访谈**：无一手患者/家长访谈，场景来自疾病轴推导 + 公开二手材料。
2. **指南原件未取得**：`G1/G2/G3` 三层（出处/节奏/分级）**本轮不启用**，界面不出现页码引用；
   原因与失败记录见 `docs/GUIDELINE-BRIDGE.md` 与 `research/medical-evidence.md`。
3. **MinerU 六部件**：只做接线与占位，本机无 MinerU 服务 → 标「未实测」。
4. **临床研究库**：本机无 unified-trial-mcp；只交付采集脚本 + 来源终态记录，"未查过"如实写。
5. **装机 V2/V3**：未装到 DSH Desktop 前一律 ⏳，不得写 ✅。
6. **市场投稿**：本轮不做。
7. **真实病例**：演示数据全部为构造数据，不含任何真实病历。
8. **基因治疗/移植后随访**：只在"治愈性治疗入口"里做资料整理与问题清单，不做方案比较。

---

## 五、我替你定的默认值（可回退）

> 来源：开工前一轮 AskUserQuestion（2026-10-25，4 问全选推荐项）。回退方式：改这里 + 改 `docs/SPEC.md` 对应段落 + 重跑 `npm run check`。

| # | 默认值 | 理由 | 回退代价 |
| --- | --- | --- | --- |
| D1 | **服务主体＝患儿家长代记为主**，同一账号内「本人 / 代记」双视角 | BACKLOG §2.3 规定 R3 代记主体=家长；重型 TDT 多在儿童期确诊，家长是实际记录者 | 高：导航与字段的"记录人"维度要重做 |
| D2 | **病程覆盖＝确诊→终身随访**，含生育与遗传咨询入口；不含终末期与移植后照护 | 家长决策最密集的一段是"规律输血 + 排铁 + 并发症筛查 + 要不要再生" | 中：新增/删减页签 |
| D3 | **MinerU＝接骨架**，环境可用才实测，否则标「未实测」 | 本机无 MinerU 服务；不实测就不写通过 | 低：去掉六部件 |
| D4 | **品牌＝小铁宝 / FerroPal** | 地贫管理日常核心是"排铁"；家族命名一致 | 低：3 个 CSS 变量 + 品牌字 + 英文名 + 包名（包名改动需重发版） |
| D5 | 数据目录 slug＝`ferropal-workbench`（`dshHomePath('ferropal-workbench')`） | 与品牌一致，和 `pinkypal-workbench` 同族 | 中：改 slug 需迁移用户数据目录 |
| D6 | 一级页签 13 个（见 `docs/INTERACTION-DESIGN.md`），一级重名率实测 46.2% | ≤70% 硬指标；保留家族四核心模块 | 中 |
| D7 | 单位一律**中国临床常用**：Hb g/L、铁蛋白 ng/mL(µg/L)、身高 cm、体重 kg；日期 `YYYY-MM-DD`，时区 Asia/Shanghai | 目标用户在境内就诊 | 低 |
| D8 | 不做账号/云同步，全部本机 SQLite；导出走 Markdown/CSV | 一条红线：患者数据本机优先 | 高 |
