/**
 * 网络检测 + 国内镜像自动切换
 *
 * 所有安装路径（npm install / install.sh / Tauri 桌面端）共用此逻辑
 */

export interface MirrorConfig {
  npm: string
  nodeDownload: string
  pypi: string
  uv: string
  label: string
}

/** 官方源 */
export const OFFICIAL_MIRRORS: MirrorConfig = {
  npm: 'https://registry.npmjs.org',
  nodeDownload: 'https://nodejs.org/dist',
  pypi: 'https://pypi.org/simple',
  uv: 'https://pypi.org/simple',
  label: '官方源',
}

/** 国内镜像 */
export const CN_MIRRORS: MirrorConfig = {
  npm: 'https://registry.npmmirror.com',
  nodeDownload: 'https://npmmirror.com/mirrors/node',
  pypi: 'https://pypi.tuna.tsinghua.edu.cn/simple',
  uv: 'https://pypi.tuna.tsinghua.edu.cn/simple',
  label: '国内镜像（淘宝 npm + 清华 PyPI）',
}

/**
 * 检测网络连通性，决定使用哪套镜像
 *
 * 尝试访问 registry.npmjs.org，2 秒超时
 * 不通 → 返回国内镜像
 * 通   → 返回官方源
 */
export async function detectMirrors(timeoutMs = 2000): Promise<{
  mirrors: MirrorConfig
  isChina: boolean
}> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    await fetch('https://registry.npmjs.org/', {
      method: 'HEAD',
      signal: controller.signal,
    })

    clearTimeout(timer)
    return { mirrors: OFFICIAL_MIRRORS, isChina: false }
  } catch {
    return { mirrors: CN_MIRRORS, isChina: true }
  }
}

/**
 * 生成 shell 命令来配置镜像
 * 用于安装执行器在安装前先配好镜像
 */
export function getMirrorSetupCommands(mirrors: MirrorConfig): string[] {
  if (mirrors === OFFICIAL_MIRRORS) return []

  return [
    `npm config set registry ${mirrors.npm}`,
    `pip config set global.index-url ${mirrors.pypi} 2>/dev/null || true`,
  ]
}
