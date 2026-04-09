/**
 * Build a gateway URL from OpenClawConfig.gateway fields.
 *
 * Consolidates the hardcoded `127.0.0.1:18789` scattered across
 * Dashboard, Gateway, Setup, and Layout into a single source of truth.
 */

interface GatewayConfig {
  gateway?: {
    port?: number
    bind?: string
    controlUi?: { basePath?: string }
  }
}

export function buildGatewayUrl(
  config: GatewayConfig | null | undefined,
  options?: { protocol?: 'http' | 'ws'; includeBasePath?: boolean },
): string {
  const port = config?.gateway?.port ?? 18789
  const bind = config?.gateway?.bind ?? '127.0.0.1'
  // If bound to all interfaces, use loopback for browser access
  const host = bind === '0.0.0.0' ? '127.0.0.1' : bind
  const proto = options?.protocol ?? 'http'
  const basePath = options?.includeBasePath
    ? (config?.gateway?.controlUi?.basePath ?? '')
    : ''
  return `${proto}://${host}:${port}${basePath}`
}
