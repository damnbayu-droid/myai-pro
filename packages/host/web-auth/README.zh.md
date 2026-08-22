# `@deepseek-ai/dsh-host-web-auth`

[English](README.md) | 中文

可选启用的单密码 + 签名会话 Cookie 门禁，覆盖 [webserver](../webserver/README.md) 的 `/api` 表面和两条 WebSocket 升级路径,通过其 `registerGuard` 预派发钩子注册——因此无论哪个插件注册了路由,都会经过同一道检查。静态 SPA 壳层从不受门禁限制：它对每位访问者都是非机密且完全相同的,而真正的能力边界（会话数据、LLM 调用、工具执行)完全位于 `/api/*` 之后。

该门禁在结构上默认处于闲置状态,直到真正存储了密码为止:`apply()` 只有在 `config.enabled` 为 true 时才会挂载门禁和 `/auth/*` 路由;而门禁本身,只要 [`ctx.credentials`](../../credentials/credentials/README.md) 中 `DSH_WEB_AUTH_PASSWORD_HASH` 没有值,就会放行所有请求。部署方通过组合 bundle 的 `--set-password-stdin` CLI 标志设置密码(绝不通过网页设置——那样会形成循环依赖),而不是直接编辑配置。

会话是无状态的签名 Cookie(对 `{iat, exp}` 载荷做 HMAC-SHA256,密钥存于 `DSH_WEB_AUTH_SESSION_SECRET`)——不存在服务端会话表,因此撤销会话的方式是轮换密钥,这会一次性使所有已签发的 Cookie 失效。

## 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `false` | 总挂载开关——一个用于恢复误锁定的应急出口。真正的激活条件是凭据是否存在,而非该标志;运维者可在自己的补丁层中将其覆盖为 `false`,在不触碰已存储哈希的情况下强制打开门禁。 |
| `cookieName` | `dsh_web_auth` | 会话 Cookie 名称。 |
| `sessionTtlMs` | 30 天 | 会话有效期。 |
| `secureCookie` | `false` | 是否为 Cookie 附加 `Secure` 属性。部署在 TLS 终止的反向代理之后时设为 true;纯 HTTP 的本地开发环境保持 false。 |

## 模型体验

无。该包在密码门禁之后认证 HTTP 请求，其中没有任何内容会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

- **`POST /auth/login` 没有暴力破解限流或锁定机制。** 对于运行在反向代理之后、供个人或小团队使用的单一共享密码场景是可接受的;若面向公众部署且需容忍多次尝试,则需要额外机制。
- **`API_PATH_PREFIX`(`/api`)是手动同步的字符串字面量**,并非从 [`@deepseek-ai/dsh-client-connection`](../../client/connection/README.md) 导入——`packages/host/*` 不得依赖 `packages/client/*`(层级方向不允许)。若该包的 API 路径发生变化,此处字面量需手动更新。
- **会话撤销是全有或全无的。** 轮换 `DSH_WEB_AUTH_SESSION_SECRET` 会一次性使所有已签发会话失效;不存在按会话粒度的撤销列表。
- **仅支持单一共享密码**——没有按用户的账户体系,也没有登录审计日志。这与产品现有的单运维者模型相符;若需支持多用户部署,则需要不同的设计。
