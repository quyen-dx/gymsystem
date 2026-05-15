const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const devUrl = process.env.ELECTRON_DEV_SERVER_URL || 'http://localhost:5173'
const productionUrl = 'https://GymPro.pages.dev/'

function getIconPath() {
  return path.join(__dirname, '..', 'build', 'icon.ico')
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    center: true,
    title: 'GymPro',
    autoHideMenuBar: true,
    backgroundColor: '#0f0f0f',
    icon: getIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  })

  win.setMenuBarVisibility(false)

  win.webContents.on('before-input-event', (event, input) => {
    const key = input.key?.toLowerCase()
    const blockedDevToolsShortcut =
      key === 'f12' ||
      (input.control && input.shift && (key === 'i' || key === 'j'))

    if (blockedDevToolsShortcut) {
      event.preventDefault()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(devUrl)
  } else {
    win.loadURL(productionUrl)
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

