const fs = require('fs')
const path = require('path')
const { Arch, Platform, build } = require('electron-builder')

const rootDir = path.join(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const buildDir = path.join(rootDir, 'build')
const buildNumberFile = path.join(buildDir, 'build-number.json')
const iconPath = path.join(buildDir, 'icon.ico')

function readBuildNumber() {
  try {
    const raw = fs.readFileSync(buildNumberFile, 'utf8')
    const parsed = JSON.parse(raw)
    const current = Number(parsed.buildNumber)

    return Number.isInteger(current) && current > 0 ? current : 0
  } catch {
    return 0
  }
}

function writeBuildMetadata() {
  fs.mkdirSync(buildDir, { recursive: true })
  fs.writeFileSync(
    buildNumberFile,
    `${JSON.stringify(buildMetadata, null, 2)}\n`,
  )
}

if (!fs.existsSync(iconPath)) {
  console.error('Missing required app icon: build/icon.ico')
  process.exit(1)
}

const buildNumber = readBuildNumber() + 1
const version = `1.0.${buildNumber}`
const buildMetadata = {
  buildNumber,
  version,
  artifactName: `GymPro-${version}-win-x64.exe`,
  updatedAt: new Date().toISOString(),
}

writeBuildMetadata()
fs.rmSync(distDir, { recursive: true, force: true })

process.env.GymPro_BUILD_VERSION = version

build({
  projectDir: rootDir,
  targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
  config: {
    buildVersion: version,
    extraMetadata: {
      version,
    },
    win: {
      icon: 'build/icon.ico',
    },
    nsis: {
      installerIcon: 'build/icon.ico',
      uninstallerIcon: 'build/icon.ico',
      installerHeaderIcon: 'build/icon.ico',
    },
  },
})
  .then((artifactPaths) => {
    const installerPath = artifactPaths.find((artifactPath) => (
      artifactPath.toLowerCase().endsWith('.exe')
      && !artifactPath.toLowerCase().includes('__uninstaller')
    ))

    console.log(`Built desktop installer: ${installerPath || 'not found'}`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

