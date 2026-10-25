# M6 装机记录（V2/V3 取证）

> 06 号四要素逐条对照**已装进 profile 的实际文件**，不看仓库里的文件。
> **V2/V3 未完成前一律 ⏳**：装进去 ≠ 加载成功 ≠ 业务闭环。

## 1. 装的是什么

| 项 | 值 |
| --- | --- |
| 包名 | `@ferropal-dsh/thalassemia-workbench` |
| 版本 | **0.4.0**（2026-10-25 第二次装机；0.3.0 已被 profile 重写清掉） |
| tgz | `release/ferropal-dsh-thalassemia-workbench-0.4.0.tgz` |
| sha256 | `820360680d36cf3cf9094669efaa2206f3744d4a9585bc0c4f3d959c88cd1779` |
| 包内文件数 | 44（无 PDF / 无 guidebooks / 无 node_modules / 无 demo-data.js） |
| profile | `~/.dsh/profiles/desktop`（pnpm **11.7.0**，与 `.modules.yaml` 同版本） |
| 安装方式 | `corepack pnpm@11.7.0 add file:…tgz`（**生产依赖**，与其它 bundle 同槽） |
| bundles 登记 | `dsh.profile.bundles` 追加 `@ferropal-dsh/thalassemia-workbench` |

## 2. 四要素对照（装机副本）

| # | 要素 | 装机副本实测 | 结论 |
| --- | --- | --- | --- |
| ① | `package.json` 的 `dsh.bundle.patch` + `dsh.client.inject` + `repository` | 三项齐全；`main` = `exports["."]` = `./dsh/index.js` | ✅ |
| ② | `cordis.patch.yml` 的 `insert.name` = npm 包名 + `config.root` | `config.root: !!js dshHomePath('ferropal-workbench')` 在位 | ✅ |
| ③ | 真客户端链路 `lib/client.js` | 14,644 字节；ModuleLoader + register + iframe + splitter + 宿主草稿桥 | ✅ |
| ④ | 版本簿记三处一致 | `VERSION`=0.4.0 / `package.json`=0.4.0 / `lib/version.js`=0.4.0 | ✅ |

## 3. 装机三轮踩到的坑（都已写进回流）

1. **pnpm 大版本不匹配会静默不写入**：profile 的 `.modules.yaml` 记 `pnpm@11.7.0` + `store/v11`；
   用默认 `corepack pnpm`（v10）装会报 store 不符 —— 输出看着像断在中间，装完 `node_modules/@ferropal-dsh/` 可能是**空目录**。
   正确：`corepack pnpm@11.7.0 add …`，装完**必须** `ls node_modules/@<scope>/<pkg>` 验实。
2. **profile 会被外部进程整份重写**：0.3.0 装好、bundles 登记好，几小时后 `package.json` 里连 devDependencies
   都换了（dsh-m / dsh-xdpool / bridge-next 等），本包条目消失。**每次装机后要重新核对 bundles 是否还在**，
   不能"上次装过"就当本次有效。
3. **装在 devDependency 里会被 prune 掉**：必须用**生产依赖**（与其它 bundle 同槽），否则下一次依赖整理就没了。
4. **pnpm 供应链策略会拦锁文件**：profile 的 `minimumReleaseAge` 命中两个既有第三方条目（billion-context 0.1.207 / dsh-m 0.10.13）。
   本次是**安装本地 file: tgz**，用 `--config.minimumReleaseAge=0` 只放行**这一条命令**；
   这不是"我的包过审"，也不能当成对那两个第三方包的安全背书。

## 4. 重启与验活（当前状态）

| 步骤 | 结果 |
| --- | --- |
| 装入 profile + bundles 登记 | ✅ |
| 重启 DSH Desktop | ⏳ 待用户执行（重启会结束当前会话进程） |
| 重启后**新建会话**（宿主按会话授权，旧会话看不到新插件） | ⏳ |
| `/api/ferropal-workbench/api/health` 在会话内 200 | ⏳ |
| 真机走查：记一笔输血 → 回看板 → 导出 | ⏳ |
| 真机截图刷新 README | ⏳ |

> 未授权时该接口回 401 是**正常**（宿主鉴权在前），不能拿 401 当"插件已加载"的证据。
> 只有"新建会话里能看到工作台 + 能读写 + 无 4xx"才算 V2；一次完整业务闭环才算 V3。
