import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const smokePort = String(Number.parseInt(process.env.CLAWMASTER_SMOKE_PORT ?? '3411', 10))
const smokeToken = process.env.CLAWMASTER_SMOKE_TOKEN?.trim() || 'ci-install-smoke-token'
const smokeUrl = `http://127.0.0.1:${smokePort}`

function resolveInstalledBinary() {
  if (process.env.CLAWMASTER_BINARY?.trim()) {
    return process.env.CLAWMASTER_BINARY.trim()
  }
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const prefix = execFileSync(npmCommand, ['prefix', '-g'], { encoding: 'utf8' }).trim()
  return process.platform === 'win32'
    ? path.join(prefix, 'clawmaster.cmd')
    : path.join(prefix, 'bin', 'clawmaster')
}

function formatCommand(binary, args) {
  return [binary, ...args].join(' ')
}

function assertSuccess(result, binary, args) {
  assert.equal(
    result.status,
    0,
    `${formatCommand(binary, args)} failed with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
}

async function waitForHealthyStatus(binary, env) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = spawnSync(binary, ['status', '--url', smokeUrl, '--token', smokeToken], {
      encoding: 'utf8',
      env,
    })
    if (result.status === 0) {
      return result.stdout
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${smokeUrl} to become reachable.`)
}

const binary = resolveInstalledBinary()
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'clawmaster-install-smoke-'))
const env = {
  ...process.env,
  HOME: tempHome,
  USERPROFILE: tempHome,
}

if (process.platform === 'win32') {
  env.APPDATA = path.win32.join(tempHome, 'AppData', 'Roaming')
  env.LOCALAPPDATA = path.win32.join(tempHome, 'AppData', 'Local')
}

try {
  const versionResult = spawnSync(binary, ['--version'], { encoding: 'utf8', env })
  assertSuccess(versionResult, binary, ['--version'])
  assert.match(versionResult.stdout, new RegExp(`ClawMaster v${pkg.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))

  const helpResult = spawnSync(binary, ['--help'], { encoding: 'utf8', env })
  assertSuccess(helpResult, binary, ['--help'])
  assert.match(helpResult.stdout, /--silent/)

  const doctorResult = spawnSync(binary, ['doctor'], { encoding: 'utf8', env })
  assertSuccess(doctorResult, binary, ['doctor'])
  assert.doesNotMatch(doctorResult.stdout, /missing build output/i)

  const serveArgs = ['serve', '--daemon', '--silent', '--host', '127.0.0.1', '--port', smokePort, '--token', smokeToken]
  const serveResult = spawnSync(binary, serveArgs, { encoding: 'utf8', env })
  assertSuccess(serveResult, binary, serveArgs)

  const statusOutput = await waitForHealthyStatus(binary, env)
  assert.match(statusOutput, new RegExp(`ClawMaster service is reachable at ${smokeUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))

  const stopResult = spawnSync(binary, ['stop'], { encoding: 'utf8', env })
  assertSuccess(stopResult, binary, ['stop'])
  assert.match(stopResult.stdout, /Stopped ClawMaster service/)
} finally {
  spawnSync(binary, ['stop'], { encoding: 'utf8', env })
  fs.rmSync(tempHome, { recursive: true, force: true })
}
