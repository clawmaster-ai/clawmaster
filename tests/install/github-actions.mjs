import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function getNpmExecOptions() {
  return {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }
}

function appendGitHubOutput(key, value) {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT is not set')
  }
  fs.appendFileSync(outputPath, `${key}=${value}\n`)
}

function extractTrailingJsonArray(stdout) {
  const match = String(stdout ?? '').match(/(\[\s*{[\s\S]*}\s*\])\s*$/)
  if (!match) {
    throw new Error('npm pack --json did not end with a JSON array payload')
  }

  return {
    logs: stdout.slice(0, match.index ?? 0),
    jsonText: match[1],
    data: JSON.parse(match[1]),
  }
}

function resolveGlobalBinaryPath() {
  const prefix = execFileSync(getNpmCommand(), ['prefix', '-g'], getNpmExecOptions()).trim()
  return process.platform === 'win32'
    ? path.join(prefix, 'clawmaster.cmd')
    : path.join(prefix, 'bin', 'clawmaster')
}

function writePackOutput() {
  const result = spawnSync(getNpmCommand(), ['pack', '--json'], getNpmExecOptions())
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }

  const payload = extractTrailingJsonArray(result.stdout)
  if (payload.logs) process.stdout.write(payload.logs)
  fs.writeFileSync('pack-result.json', `${payload.jsonText}\n`, 'utf8')
  appendGitHubOutput('tarball', payload.data[0].filename)
}

function writeBinaryOutput() {
  appendGitHubOutput('path', resolveGlobalBinaryPath())
}

const command = process.argv[2] ?? ''

if (command === 'pack-output') {
  writePackOutput()
} else if (command === 'binary-output') {
  writeBinaryOutput()
} else {
  throw new Error(`Unknown command: ${command}`)
}
