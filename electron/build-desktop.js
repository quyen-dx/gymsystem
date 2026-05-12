const fs = require('fs')
const path = require('path')
const { Arch, Platform, build } = require('electron-builder')

const rootDir = path.join(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const buildDir = path.join(rootDir, 'build')
const buildNumberFile = path.join(buildDir, 'build-number.json')
const iconPath = path.join(buildDir, 'icon.ico')
const frontendDownloadDir = path.join(rootDir, 'gym-frontend', 'public', 'download')
const frontendDownloadManifest = path.join(frontendDownloadDir, 'desktop-installer.json')
const frontendStableInstallerName = 'GymSystem-latest-win-x64.exe'

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

function cleanFrontendDownloadDir() {
  fs.mkdirSync(frontendDownloadDir, { recursive: true })

  for (const fileName of fs.readdirSync(frontendDownloadDir)) {
    if (/^GymSystem.*\.exe$/i.test(fileName) || fileName === frontendStableInstallerName || fileName === 'desktop-installer.json') {
      fs.rmSync(path.join(frontendDownloadDir, fileName), { force: true })
    }
  }
}

function publishInstallerToFrontend(artifactPaths) {
  const installerPath = artifactPaths.find((artifactPath) => (
    artifactPath.toLowerCase().endsWith('.exe')
    && !artifactPath.toLowerCase().includes('__uninstaller')
  ))

  if (!installerPath) {
    throw new Error('Electron Builder did not return an installer exe artifact.')
  }

  cleanFrontendDownloadDir()

  const fileName = path.basename(installerPath)
  const publicInstallerPath = path.join(frontendDownloadDir, fileName)
  const publicStableInstallerPath = path.join(frontendDownloadDir, frontendStableInstallerName)
  const manifest = {
    version,
    fileName,
    stableFileName: frontendStableInstallerName,
    url: `/download/${encodeURIComponent(frontendStableInstallerName)}`,
    versionedUrl: `/download/${encodeURIComponent(fileName)}`,
    updatedAt: new Date().toISOString(),
  }

  fs.copyFileSync(installerPath, publicInstallerPath)
  fs.copyFileSync(installerPath, publicStableInstallerPath)
  fs.writeFileSync(frontendDownloadManifest, `${JSON.stringify(manifest, null, 2)}\n`)

  return manifest
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
  artifactName: `GymSystem-${version}-win-x64.exe`,
  updatedAt: new Date().toISOString(),
}

writeBuildMetadata()
fs.rmSync(distDir, { recursive: true, force: true })

process.env.GYMSYSTEM_BUILD_VERSION = version

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
    const manifest = publishInstallerToFrontend(artifactPaths)
    console.log(`Published desktop installer: ${manifest.url}`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
