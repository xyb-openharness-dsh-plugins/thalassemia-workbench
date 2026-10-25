# M6 装机记录（V2/V3 取证）

> 06 号四要素逐条对照**已装进 profile 的实际文件**，不看仓库里的文件。

## 1. 装的是什么

| 项 | 值 |
| --- | --- |
| 包名 | `@ferropal-dsh/thalassemia-workbench` |
| 版本 | `0.3.0` |
| tgz | `release/ferropal-dsh-thalassemia-workbench-0.3.0.tgz` |
| sha256 | `85ad1e3a18cacc72b4b148f74a0b9e42bcec026004181c5893be368f176a3b41` |
| 包内文件数 | 38（无 PDF / 无 guidebooks / 无 node_modules / 无 sqlite） |
| profile | `~/.dsh/profiles/desktop`（pnpm 11.7.0，与 .modules.yaml 同版本） |
| 安装方式 | `corepack pnpm@11.7.0 add -D file:…tgz` |
| bundles 登记 | `dsh.profile.bundles` 追加 `@ferropal-dsh/thalassemia-workbench` |

## 2. 四要素对照（装机副本）

| # | 要素 | 装机副本实测 | 结论 |
| --- | --- | --- | --- |
| ① | `package.json` 的 `dsh.bundle.patch` + `dsh.client.inject` + `repository` | 三项齐全；`main` = `exports["."]` = `./dsh/index.js` | ✅ |
| ② | `cordis.patch.yml` 的 `insert.name` = npm 包名 + `config.root` | `name: "@ferropal-dsh/thalassemia-workbench"`；`config.root: !!js dshHomePath('ferropal-workbench')` | ✅ |
| ③ | 真客户端链路 `lib/client.js`（非 init 占位） | 8,409 字节，`window.__ModuleLoader__.load` + `desktopWorkbenches.register` + customFrame + splitter | ✅ |
| ④ | 版本簿记三处一致 | `VERSION`=0.3.0 / `package.json.version`=0.3.0 / `lib/version.js`=`0.3.0` | ✅ |

## 3. 装机前踩到的两个坑（写进回流）

1. **pnpm 大版本不匹配会静默失败**：profile 的 `node_modules/.modules.yaml` 记 `packageManager: pnpm@11.7.0`、`storeDir: …/store/v11`；
   直接用 `corepack pnpm`（解析到 v10）会报 store 不符并**不写入** —— 看起来"装过了"，`node_modules/@ferropal-dsh/` 却是空目录。
   正确做法：`corepack pnpm@<.modules.yaml 里的版本> add …`，装完必须 `ls node_modules/@<scope>/<pkg>` 验实。
2. **`npm pack` 会把 `assets/` 下无关的参考 PDF 一起打进包**（init 模板自带 `assets/reference/ctcae/*.pdf` 2.9MB）：
   本仓不启用 CTCAE，删掉后包体积 3.5MB → 0.3MB。**别让模板资产混进业务包。**

## 4. 重启与验活

| 步骤 | 命令/动作 | 结果 |
| --- | --- | --- |
| 重启 DSH | （见下） | ⏳ |
| 新建会话 | 宿主按会话授权，旧会话看不到新插件 | ⏳ |
| `/api/ferropal-workbench/api/health` | 未授权时 401（预期）；会话内应 200 | ⏳ |
| 真机走查 | 记一笔输血 → 回看板 → 导出 | ⏳ |

> 未完成前，README 与 DEV-PLAN 里 V2/V3 一律写 ⏳，不得写 ✅。
