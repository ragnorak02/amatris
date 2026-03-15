/* ============================================================
   electron-main.js — LUMINA Studio OS — Electron Main Process
   Starts the existing Node server, then opens the dashboard
   in a native window with dark title bar.
   ============================================================ */

const { app, BrowserWindow, Menu, shell, globalShortcut } = require('electron');
const path = require('path');

let mainWindow = null;
const PORT = 3001;
const DASHBOARD_URL = `http://localhost:${PORT}/lumina%20dashboard.html`;

/* ---- App settings ---- */
app.setName('LUMINA Studio OS');

/* ---- Create the main window ---- */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 960,
        minWidth: 1024,
        minHeight: 600,
        title: 'LUMINA \u2014 Studio OS',
        icon: path.join(__dirname, 'lumina-crystal.ico'),
        backgroundColor: '#0a0a12',
        show: false,                  // show after ready-to-show
        autoHideMenuBar: true,        // clean look, Alt shows menu
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Dark title bar via Windows DWM
    if (process.platform === 'win32') {
        try {
            // Electron 20+ supports titleBarOverlay color
            mainWindow.setTitleBarOverlay && mainWindow.setTitleBarOverlay({
                color: '#0a0a12',
                symbolColor: '#d4af37'
            });
        } catch (_) {}
    }

    mainWindow.loadURL(DASHBOARD_URL);

    // Show when ready (avoids white flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/* ---- Minimal application menu ---- */
function buildMenu() {
    const template = [
        {
            label: 'LUMINA',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => { if (mainWindow) mainWindow.reload(); }
                },
                {
                    label: 'Force Reload',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => { if (mainWindow) mainWindow.webContents.reloadIgnoringCache(); }
                },
                { type: 'separator' },
                {
                    label: 'Toggle DevTools',
                    accelerator: 'F12',
                    click: () => { if (mainWindow) mainWindow.webContents.toggleDevTools(); }
                },
                { type: 'separator' },
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+=',
                    click: () => {
                        if (mainWindow) {
                            var z = mainWindow.webContents.getZoomLevel();
                            mainWindow.webContents.setZoomLevel(z + 0.5);
                        }
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        if (mainWindow) {
                            var z = mainWindow.webContents.getZoomLevel();
                            mainWindow.webContents.setZoomLevel(z - 0.5);
                        }
                    }
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        if (mainWindow) mainWindow.webContents.setZoomLevel(0);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit LUMINA',
                    accelerator: 'Alt+F4',
                    click: () => { app.quit(); }
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---- App lifecycle ---- */
app.whenReady().then(() => {
    // Start the server (it self-starts on require)
    require('./server.js');

    // Give the server a moment to bind, then open window
    setTimeout(() => {
        buildMenu();
        createWindow();
    }, 500);
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (mainWindow === null) createWindow();
});
