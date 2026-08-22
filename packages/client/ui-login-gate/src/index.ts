/**
 * Login-gate overlay, node half. Pure UI plugin: the empty apply exists so
 * the plugin appears in the host cordis.yml / Loader; the browser half ships
 * via exports["./client"], discovered through the package.json dsh.client
 * declaration. The auth check/login it drives lives at the `/auth/*` routes
 * owned by `@deepseek-ai/dsh-host-web-auth`.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
