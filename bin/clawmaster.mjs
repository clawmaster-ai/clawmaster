#!/usr/bin/env node

/**
 * 🦞 龙虾管理大师 CLI 入口
 *
 * 启动 Web 模式：Express 后端 + Vite 前端
 * 用户运行 `clawmaster` 即可打开管理界面
 */

import { spawn } from 'child_process'
import { createRequire } from 'module'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const args = process.argv.slice(2)
const command = args[0]

// 版本信息
if (command === '--version' || command === '-v') {
  const require = createRequire(import.meta.url)
  const pkg = require(resolve(root, 'package.json'))
  console.log(`🦞 龙虾管理大师 (ClawMaster) v${pkg.version}`)
  process.exit(0)
}

// 帮助信息
if (command === '--help' || command === '-h') {
  console.log(`
🦞 龙虾管理大师 (ClawMaster)
   OpenClaw 生态的六边形战士

用法:
  clawmaster            启动管理界面（Web 模式）
  clawmaster --version  显示版本号
  clawmaster --help     显示帮助信息

启动后访问 http://localhost:3000 打开管理界面
`)
  process.exit(0)
}

// 启动 Web 模式
console.log('🦞 龙虾管理大师正在启动...')
console.log('')

const backendDir = resolve(root, 'packages/backend')
const webDir = resolve(root, 'packages/web')

// 检查目录存在
if (!existsSync(backendDir) || !existsSync(webDir)) {
  console.error('错误：找不到 packages/backend 或 packages/web 目录')
  console.error('请确保在项目根目录下运行，或通过 npm install -g clawmaster 安装')
  process.exit(1)
}

// 启动后端
const backend = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: backendDir,
  stdio: 'pipe',
  shell: true,
})

backend.stdout?.on('data', (data) => {
  const msg = data.toString().trim()
  if (msg) console.log(`  [后端] ${msg}`)
})

backend.stderr?.on('data', (data) => {
  const msg = data.toString().trim()
  if (msg && !msg.includes('ExperimentalWarning')) {
    console.error(`  [后端] ${msg}`)
  }
})

// 等后端启动后启动前端
setTimeout(() => {
  const frontend = spawn('npx', ['vite', '--port', '3000'], {
    cwd: webDir,
    stdio: 'pipe',
    shell: true,
  })

  frontend.stdout?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg) {
      console.log(`  [前端] ${msg}`)
      // 检测到 Vite 启动成功
      if (msg.includes('Local:') || msg.includes('localhost')) {
        console.log('')
        console.log('  🦞 龙虾管理大师已就绪!')
        console.log('  📎 打开浏览器访问: http://localhost:3000')
        console.log('  按 Ctrl+C 停止')
        console.log('')
      }
    }
  })

  frontend.stderr?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg && !msg.includes('ExperimentalWarning')) {
      console.error(`  [前端] ${msg}`)
    }
  })

  // 优雅退出
  const cleanup = () => {
    frontend.kill()
    backend.kill()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  frontend.on('close', cleanup)
}, 1500)

backend.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`后端进程退出，代码: ${code}`)
  }
})
