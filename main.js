const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const mtpService = require('./src/services/mtpService');

// 保持对窗口对象的全局引用，避免JavaScript对象被垃圾回收时窗口关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  // 加载应用
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 打开开发工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 当窗口关闭时调用的方法
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 处理MTP设备检测
ipcMain.handle('detect-mtp-devices', async () => {
  try {
    const devices = await mtpService.detectDevices();
    return { success: true, devices };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 获取设备文件列表
ipcMain.handle('get-device-files', async (event, folderPath) => {
  try {
    const files = await mtpService.getFiles(folderPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 选择本地文件
ipcMain.handle('select-local-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    
    return { success: false, error: '未选择文件' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 传输文件到设备
ipcMain.handle('transfer-file', async (event, sourcePath, destinationPath) => {
  try {
    const success = await mtpService.transferFile(sourcePath, destinationPath);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
}); 