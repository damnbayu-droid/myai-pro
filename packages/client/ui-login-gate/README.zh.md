# `@deepseek-ai/dsh-client-ui-login-gate`

[English](README.md) | 中文

为可选启用的 [`@deepseek-ai/dsh-host-web-auth`](../../host/web-auth/README.md) 密码门禁提供的全屏登录遮罩。注册进 [ui-layout](../ui-layout/README.md) 的 `shell.overlay` 列表插槽(通过 `ctx.slots.inject` 等待其声明就绪,因为 AppFrame 的挂载顺序相对本包并无保证),在挂载时检查一次 `GET /auth/session`,当门禁未启用或浏览器已通过认证时不渲染任何内容。否则会用 [`OnboardingSurface`](../ui-primitives/README.md) 挡住应用其余部分,直到 `POST /auth/login` 成功——无需刷新页面,因为应用早已完整启动,后续的同源 `/api` 请求会自动携带新的会话 Cookie。

通过纯 `fetch` 封装(`session-client.ts`)与 `/auth/*` 通信,而非 RPC 桥接(`@deepseek-ai/dsh-client-connection`)——那套机制假设会话已经建立,而这里恰恰是建立会话的端点,存在循环依赖。

## 模型体验

无。该包渲染的是浏览器端登录遮罩，其中没有任何内容会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

- **壳层会在门禁解析完成前就完整启动。** 未认证访问者的“惰性”应用可能在遮罩渲染前,由无关插件在挂载时发出若干后台 `/api` 请求;门禁会硬性拒绝这些请求(不会泄露数据),但可能会短暂出现控制台警告或来自无关插件的临时提示。此问题暂缓而非彻底解决。
