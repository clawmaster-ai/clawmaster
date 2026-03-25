/** 能力项 ID */
export type CapabilityId = 'engine' | 'memory' | 'observe' | 'ocr' | 'agent'

/** 能力项状态 */
export interface CapabilityStatus {
  id: CapabilityId
  name: string
  status: 'checking' | 'installed' | 'not_installed' | 'error'
  version?: string
  error?: string
}

/** 安装进度 */
export interface InstallProgress {
  id: CapabilityId
  status: 'waiting' | 'installing' | 'done' | 'error'
  progress?: number // 0-100
  log?: string // 当前安装输出行
  error?: string
}

/** 安装向导总状态 */
export type SetupPhase = 'detecting' | 'ready' | 'installing' | 'done' | 'error'

/** 能力定义（用户看到的名称和底层安装命令的映射） */
export interface CapabilityDef {
  id: CapabilityId
  name: string
  detectCmd: string
  detectArgs: string[]
  installSteps: Array<{ cmd: string; args: string[] }>
}

/** 五项内置能力定义 */
export const CAPABILITIES: CapabilityDef[] = [
  {
    id: 'engine',
    name: '核心引擎',
    detectCmd: 'openclaw',
    detectArgs: ['--version'],
    installSteps: [
      { cmd: 'npm', args: ['install', '-g', 'openclaw'] },
    ],
  },
  {
    id: 'memory',
    name: '记忆管理',
    detectCmd: 'pmem',
    detectArgs: ['--version'],
    installSteps: [
      { cmd: 'pip', args: ['install', 'powermem'] },
      { cmd: 'openclaw', args: ['plugins', 'install', 'memory-powermem'] },
    ],
  },
  {
    id: 'observe',
    name: '可观测性',
    detectCmd: 'clawprobe',
    detectArgs: ['--version'],
    installSteps: [
      { cmd: 'npm', args: ['install', '-g', 'clawprobe'] },
    ],
  },
  {
    id: 'ocr',
    name: '文档与图像识别',
    detectCmd: 'clawhub',
    detectArgs: ['list', '--json'],
    installSteps: [
      { cmd: 'clawhub', args: ['install', 'paddleocr-doc-parsing'] },
      { cmd: 'clawhub', args: ['install', 'paddleocr-text-recognition'] },
    ],
  },
  {
    id: 'agent',
    name: '智能体编排',
    detectCmd: 'python3',
    detectArgs: ['-c', 'import deepagents; print(deepagents.__version__)'],
    installSteps: [
      { cmd: 'pip', args: ['install', 'langchain', 'langgraph', 'deepagents'] },
    ],
  },
]
