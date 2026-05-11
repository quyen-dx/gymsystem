const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')
const path = require('path')

const rootDir = path.join(__dirname, '..')
const frontendDir = path.join(rootDir, 'gym-frontend')
const backendDir = path.join(rootDir, 'gym-backend')
const devUrl = 'http://localhost:5173'
const backendUrl = 'http://localhost:5000/api/health'

const isWindows = process.platform === 'win32'
const npmCommand = 'npm'
const electronCommand = path.join(rootDir, 'node_modules', '.bin', isWindows ? 'electron.cmd' : 'electron')

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options,
  })

  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })

  return child
}

function hasPackageScript(directory, scriptName) {
  try {
    const packageJsonPath = path.join(directory, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return Boolean(packageJson.scripts?.[scriptName])
  } catch {
    return false
  }
}

function stopProcess(child) {
  if (!child || child.killed) return

  if (isWindows && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      shell: true,
    })
    return
  }

  child.kill()
}

function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume()
        resolve()
      })

      request.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`))
          return
        }
        setTimeout(check, 500)
      })

      request.setTimeout(2000, () => {
        request.destroy()
      })
    }

    check()
  })
}

async function main() {
  const backendScript = hasPackageScript(backendDir, 'dev') ? 'dev' : 'start'
  const backend = spawnProcess(npmCommand, ['run', backendScript], {
    cwd: backendDir,
  })

  const vite = spawnProcess(npmCommand, ['run', 'dev'], {
    cwd: frontendDir,
  })

  const stopChildren = () => {
    stopProcess(vite)
    stopProcess(backend)
  }

  process.on('SIGINT', () => {
    stopChildren()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    stopChildren()
    process.exit(0)
  })

  await Promise.all([
    waitForServer(devUrl),
    waitForServer(backendUrl),
  ])

  const electron = spawnProcess(electronCommand, ['.'], {
    cwd: rootDir,
    env: {
      ...process.env,
      ELECTRON_DEV_SERVER_URL: devUrl,
    },
  })

  electron.on('exit', (code) => {
    stopChildren()
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
