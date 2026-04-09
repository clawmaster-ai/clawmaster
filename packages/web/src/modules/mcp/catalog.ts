import type { McpServerConfig, McpTransport } from '@/shared/adapters/mcp'

export type McpCategory = 'developer' | 'productivity' | 'utilities' | 'monitoring'
export type McpInputTarget = 'env' | 'header'

export interface CatalogMcpField {
  key: string
  labelKey: string
  required: boolean
  sensitive: boolean
  target: McpInputTarget
  headerName?: string
  prefix?: string
}

export interface CatalogMcpServer {
  id: string
  name: string
  descriptionKey: string
  package?: string
  url?: string
  transport: McpTransport
  category: McpCategory
  featured?: boolean
  docsUrl?: string
  fields: CatalogMcpField[]
  defaultArgs?: string[]
}

export const MCP_CATALOG: CatalogMcpServer[] = [
  {
    id: 'context7',
    name: 'Context7',
    descriptionKey: 'mcp.catalog.context7.desc',
    url: 'https://mcp.context7.com/mcp',
    transport: 'http',
    category: 'developer',
    featured: true,
    fields: [],
    docsUrl: 'https://github.com/upstash/context7',
  },
  {
    id: 'tavily',
    name: 'Tavily',
    descriptionKey: 'mcp.catalog.tavily.desc',
    package: 'tavily-mcp',
    transport: 'stdio',
    category: 'developer',
    featured: true,
    fields: [
      { key: 'TAVILY_API_KEY', labelKey: 'mcp.env.tavilyKey', required: true, sensitive: true, target: 'env' },
    ],
    docsUrl: 'https://docs.tavily.com/documentation/mcp',
  },
  {
    id: 'github',
    name: 'GitHub',
    descriptionKey: 'mcp.catalog.github.desc',
    package: '@modelcontextprotocol/server-github',
    transport: 'stdio',
    category: 'developer',
    featured: true,
    fields: [
      { key: 'GITHUB_PERSONAL_ACCESS_TOKEN', labelKey: 'mcp.env.githubToken', required: true, sensitive: true, target: 'env' },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    descriptionKey: 'mcp.catalog.deepwiki.desc',
    package: 'deepwiki-mcp',
    transport: 'stdio',
    category: 'developer',
    featured: true,
    fields: [],
    docsUrl: 'https://deepwiki.com',
  },
  {
    id: 'linear',
    name: 'Linear',
    descriptionKey: 'mcp.catalog.linear.desc',
    package: 'linear-mcp',
    transport: 'stdio',
    category: 'productivity',
    fields: [
      { key: 'LINEAR_API_KEY', labelKey: 'mcp.env.linearKey', required: true, sensitive: true, target: 'env' },
    ],
    docsUrl: 'https://linear.app',
  },
  {
    id: 'notion',
    name: 'Notion',
    descriptionKey: 'mcp.catalog.notion.desc',
    package: '@notionhq/notion-mcp-server',
    transport: 'stdio',
    category: 'productivity',
    fields: [
      { key: 'NOTION_API_TOKEN', labelKey: 'mcp.env.notionToken', required: true, sensitive: true, target: 'env' },
    ],
    docsUrl: 'https://developers.notion.com',
  },
  {
    id: 'slack',
    name: 'Slack',
    descriptionKey: 'mcp.catalog.slack.desc',
    package: '@modelcontextprotocol/server-slack',
    transport: 'stdio',
    category: 'productivity',
    fields: [
      { key: 'SLACK_BOT_TOKEN', labelKey: 'mcp.env.slackToken', required: true, sensitive: true, target: 'env' },
    ],
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    descriptionKey: 'mcp.catalog.filesystem.desc',
    package: '@modelcontextprotocol/server-filesystem',
    transport: 'stdio',
    category: 'utilities',
    fields: [],
    defaultArgs: ['/home'],
  },
  {
    id: 'memory',
    name: 'Memory',
    descriptionKey: 'mcp.catalog.memory.desc',
    package: '@modelcontextprotocol/server-memory',
    transport: 'stdio',
    category: 'utilities',
    fields: [],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    descriptionKey: 'mcp.catalog.sequentialThinking.desc',
    package: '@modelcontextprotocol/server-sequential-thinking',
    transport: 'stdio',
    category: 'utilities',
    fields: [],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    descriptionKey: 'mcp.catalog.sentry.desc',
    package: '@sentry/mcp-server',
    transport: 'stdio',
    category: 'monitoring',
    fields: [
      { key: 'SENTRY_AUTH_TOKEN', labelKey: 'mcp.env.sentryToken', required: true, sensitive: true, target: 'env' },
    ],
    docsUrl: 'https://sentry.io',
  },
]

export const FEATURED_MCP_SERVERS = MCP_CATALOG.filter((server) => server.featured)
export const CATEGORY_ORDER: McpCategory[] = ['developer', 'productivity', 'utilities', 'monitoring']

export const CATEGORY_COLORS: Record<McpCategory, string> = {
  developer: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-100',
  productivity: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
  utilities: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  monitoring: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
}

export function buildMcpServerConfig(
  catalog: CatalogMcpServer,
  inputs: Record<string, string>,
  extraArgs?: string[],
): McpServerConfig {
  const env: Record<string, string> = {}
  const headers: Record<string, string> = {}

  for (const field of catalog.fields) {
    const raw = inputs[field.key]?.trim()
    if (!raw) continue

    if (field.target === 'header' && field.headerName) {
      headers[field.headerName] = field.prefix ? `${field.prefix}${raw}` : raw
      continue
    }

    env[field.key] = raw
  }

  if (catalog.transport === 'http' || catalog.transport === 'sse') {
    return {
      transport: catalog.transport,
      url: catalog.url ?? '',
      headers,
      env,
      enabled: true,
      meta: {
        source: 'catalog',
      },
    }
  }

  return {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', catalog.package ?? '', ...(extraArgs ?? catalog.defaultArgs ?? [])].filter(Boolean),
    env,
    enabled: true,
    meta: {
      source: 'catalog',
      managedPackage: catalog.package,
    },
  }
}
