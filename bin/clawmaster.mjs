#!/usr/bin/env node

import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { spawn, execFile as execFileCallback } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chmodSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { promisify } from 'node:util'
import os from 'node:os'

const execFile = promisify(execFileCallback)
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const pkg = require(resolve(root, 'package.json'))
const serviceStateDir = join(os.homedir(), '.clawmaster', 'service')
const serviceStateFile = join(serviceStateDir, 'service-state.json')

function printHelp() {
  console.log(`
ClawMaster v${pkg.version}

Usage:
  clawmaster serve [--host 127.0.0.1] [--port 3001] [--daemon] [--token <token>]
  clawmaster status [--url http://127.0.0.1:3001] [--token <token>]
  clawmaster stop
  clawmaster doctor
  clawmaster --version
  clawmaster --help

Commands:
  serve    Start the ClawMaster service in the foreground, or in the background with --daemon.
  status   Check whether a running ClawMaster service is reachable.
  stop     Stop the background ClawMaster service recorded in the local state file.
  doctor   Inspect local runtime prerequisites and packaged build assets.

Notes:
  The service expects built backend and frontend assets.
  clawmaster serve protects the web UI with a service token by default.
  For local source checkouts, run:
    npm run build:backend
    npm run build
`)
}

function parseFlagValue(args, name, fallback) {
  const longFlag = `--${name}`
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === longFlag) {
      return args[index + 1] ?? fallback
    }
    if (arg.startsWith(`${longFlag}=`)) {
      return arg.slice(longFlag.length + 1) || fallback
    }
  }
  return fallback
}

function hasFlag(args, name) {
  const longFlag = `--${name}`
  return args.includes(longFlag)
}

function getServiceUrl(args = []) {
  const stored = readServiceState()
  return parseFlagValue(args, 'url', stored?.url ?? 'http://127.0.0.1:3001')
}

function getBackendHost(args = []) {
  return parseFlagValue(args, 'host', '127.0.0.1')
}

function getBackendPort(args = []) {
  const raw = parseFlagValue(args, 'port', '3001')
  const parsed = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid --port value: ${raw}`)
  }
  return String(parsed)
}

function getServiceToken(args = []) {
  const provided = parseFlagValue(args, 'token', '').trim()
  return provided || randomBytes(24).toString('base64url')
}

function resolveServiceAssets() {
  const backendEntry = resolve(root, 'packages/backend/dist/index.js')
  const frontendDist = resolve(root, 'packages/web/dist')
  const frontendIndex = resolve(frontendDist, 'index.html')

  return {
    backendEntry,
    frontendDist,
    frontendIndex,
    backendReady: existsSync(backendEntry),
    frontendReady: existsSync(frontendIndex),
  }
}

function ensureServiceStateDir() {
  mkdirSync(serviceStateDir, { recursive: true })
}

function readServiceState() {
  try {
    return JSON.parse(readFileSync(serviceStateFile, 'utf8'))
  } catch {
    return null
  }
}

function writeServiceState(state) {
  ensureServiceStateDir()
  writeFileSync(serviceStateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  try {
    chmodSync(serviceStateFile, 0o600)
  } catch {
    // best effort
  }
}

function readLogTail(pathToFile, maxChars = 1200) {
  try {
    const content = readFileSync(pathToFile, 'utf8')
    return content.length > maxChars ? content.slice(-maxChars) : content
  } catch {
    return ''
  }
}

function clearServiceState() {
  rmSync(serviceStateFile, { force: true })
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getRunningServiceState() {
  const state = readServiceState()
  if (!state) return null
  if (isProcessAlive(Number(state.pid))) return state
  clearServiceState()
  return null
}

async function probeCommand(command, args) {
  try {
    const { stdout } = await execFile(command, args, { shell: false })
    return { ok: true, output: stdout.trim() }
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : String(error),
    }
  }
}

async function fetchServiceInfo(baseUrl, options = {}) {
  const {
    retries = 1,
    retryDelayMs = 250,
    token = '',
  } = options

  let lastError = null
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/system/detect`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
      }
    }
  }

  throw lastError ?? new Error('unknown service probe failure')
}

async function runDoctor() {
  const assets = resolveServiceAssets()
  const nodeVersion = process.version
  const npm = await probeCommand('npm', ['--version'])
  const openclaw = await probeCommand('openclaw', ['--version'])

  console.log('ClawMaster doctor')
  console.log('')
  console.log(`node:       ${nodeVersion}`)
  console.log(`npm:        ${npm.ok ? npm.output : `missing (${npm.output})`}`)
  console.log(`openclaw:   ${openclaw.ok ? openclaw.output : `missing (${openclaw.output})`}`)
  console.log(`backend:    ${assets.backendReady ? assets.backendEntry : 'missing build output'}`)
  console.log(`frontend:   ${assets.frontendReady ? assets.frontendIndex : 'missing build output'}`)
  console.log('')

  if (!assets.backendReady || !assets.frontendReady) {
    console.log('Build assets are missing. Run `npm run build:backend` and `npm run build` before `clawmaster serve`.')
    process.exitCode = 1
    return
  }
}

async function runStatus(args) {
  const baseUrl = getServiceUrl(args).replace(/\/+$/, '')
  const state = getRunningServiceState()
  const token = parseFlagValue(args, 'token', state?.token ?? '')
  try {
    const data = await fetchServiceInfo(baseUrl, { retries: 8, retryDelayMs: 250, token })
    console.log(`ClawMaster service is reachable at ${baseUrl}`)
    if (state) {
      console.log(`pid:      ${state.pid}`)
      console.log(`started:  ${state.startedAt}`)
    }
    console.log(`openclaw: ${data?.openclaw?.installed ? data.openclaw.version || 'installed' : 'not detected'}`)
    console.log(`config:   ${data?.openclaw?.configPath ?? 'unknown'}`)
    console.log(`runtime:  ${data?.runtime?.mode ?? 'unknown'}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`ClawMaster service is not reachable at ${baseUrl}: ${message}`)
    process.exitCode = 1
  }
}

async function runStop() {
  const state = getRunningServiceState()
  if (!state) {
    console.error('No running ClawMaster background service was found.')
    process.exitCode = 1
    return
  }

  try {
    process.kill(Number(state.pid), 'SIGTERM')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to stop ClawMaster service: ${message}`)
    process.exitCode = 1
    return
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isProcessAlive(Number(state.pid))) {
      clearServiceState()
      console.log(`Stopped ClawMaster service (pid ${state.pid}).`)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  console.error(`Timed out waiting for ClawMaster service pid ${state.pid} to stop.`)
  process.exitCode = 1
}

async function runServe(args) {
  const host = getBackendHost(args)
  const port = getBackendPort(args)
  const daemon = hasFlag(args, 'daemon')
  const token = getServiceToken(args)
  const assets = resolveServiceAssets()
  const url = `http://${host}:${port}`
  const running = getRunningServiceState()
  const stdoutLog = join(serviceStateDir, 'service.stdout.log')
  const stderrLog = join(serviceStateDir, 'service.stderr.log')

  if (!assets.backendReady || !assets.frontendReady) {
    console.error('ClawMaster service assets are missing.')
    console.error('Expected:')
    console.error(`  backend: ${assets.backendEntry}`)
    console.error(`  frontend: ${assets.frontendIndex}`)
    console.error('')
    console.error('Run `npm run build:backend` and `npm run build`, or install the published npm package.')
    process.exit(1)
  }

  if (running) {
    console.error(`ClawMaster service is already running at ${running.url} (pid ${running.pid}).`)
    console.error('Use `clawmaster status` to inspect it or `clawmaster stop` to stop it first.')
    process.exit(1)
  }

  ensureServiceStateDir()
  const child = spawn(process.execPath, [assets.backendEntry], {
    cwd: root,
    stdio: daemon
      ? ['ignore', openSync(stdoutLog, 'a'), openSync(stderrLog, 'a')]
      : 'inherit',
    env: {
      ...process.env,
      BACKEND_HOST: host,
      BACKEND_PORT: port,
      CLAWMASTER_FRONTEND_DIST: assets.frontendDist,
      CLAWMASTER_SERVICE_TOKEN: token,
    },
    detached: daemon,
    shell: false,
  })

  writeServiceState({
    pid: child.pid,
    host,
    port: Number(port),
    url,
    token,
    startedAt: new Date().toISOString(),
    stdoutLog,
    stderrLog,
  })

  if (daemon) {
    try {
      await fetchServiceInfo(url, { retries: 40, retryDelayMs: 250, token })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      try {
        process.kill(child.pid, 'SIGTERM')
      } catch {
        // ignore cleanup failure here
      }
      const stderrTail = readLogTail(stderrLog).trim()
      clearServiceState()
      console.error(`ClawMaster service failed to become ready at ${url}: ${message}`)
      if (stderrTail) {
        console.error('')
        console.error('Recent stderr:')
        console.error(stderrTail)
      }
      process.exit(1)
    }

    child.unref()
    console.log(`Started ClawMaster service in the background at ${url}`)
    console.log(`pid: ${child.pid}`)
    console.log(`token: ${token}`)
    console.log('Use `clawmaster status` to inspect it and `clawmaster stop` to stop it.')
    return
  }

  console.log(`Starting ClawMaster service on ${url}`)
  console.log(`token: ${token}`)
  console.log('Press Ctrl+C to stop.')

  const stopChild = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', () => stopChild('SIGINT'))
  process.on('SIGTERM', () => stopChild('SIGTERM'))

  child.on('exit', (code, signal) => {
    clearServiceState()
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] ?? 'serve'

  if (command === '--version' || command === '-v' || command === 'version') {
    console.log(`ClawMaster v${pkg.version}`)
    return
  }

  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp()
    return
  }

  if (command === 'doctor') {
    await runDoctor()
    return
  }

  if (command === 'status') {
    await runStatus(args.slice(1))
    return
  }

  if (command === 'stop') {
    await runStop()
    return
  }

  if (command === 'serve') {
    await runServe(args.slice(1))
    return
  }

  console.error(`Unknown command: ${command}`)
  console.error('')
  printHelp()
  process.exitCode = 1
}

void main()
