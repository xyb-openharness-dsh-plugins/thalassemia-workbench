# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.3.1 — 2026-10-25

- **修复装机即崩**：`openDatabase()` 在 `dshHomePath('ferropal-workbench')` 指向的目录不存在时抛
  `ERR_SQLITE_ERROR(14) unable to open database file`；现在开库前会递归创建父目录。
- **修复异步未 await**：`openDataSource()` 没等待 `openDatabase()`，失败变成 unhandled rejection，
  宿主 Node 24 直接 `fatal load failure` 退出。`apply()` 改为 async 并等待开库；失败时降级为
  503 + 可读错误，不再带崩整个 DSH。
- `scripts/dev-server.mjs` 同步补上顶层 `await`（此前本地 dev-server 也拿不到数据库对象）。
- 新增 `test/plugin-load.test.mjs`：锁住“目录不存在可自建”“apply 可等待”“打开失败降级 503”。
- 用户可见结果：装进 Desktop 后工作台能正常打开，数据落在 `~/.dsh/ferropal-workbench/xyb-ferropal.sqlite`；
  即使数据目录不可写，也只是工作台报错，不会导致 DSH 启动失败。

## 0.3.0 — 2026-10-25

- 装机包首版：dsh 服务端入口 + 客户端面板 + 13 个视图 + schema/迁移 + 演示库。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 (1541b8a) 初始化，仅有注册骨架与健康接口，无业务功能。
