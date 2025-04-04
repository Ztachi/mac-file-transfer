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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
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
  console.log('[main.js] 收到 detect-mtp-devices 请求');
  try {
    const devices = await mtpService.detectDevices();
    console.log('[main.js] detect-mtp-devices 结果:', devices);
    return devices;
  } catch (error) {
    console.error('[main.js] detect-mtp-devices 错误:', error);
    throw error;
  }
});

// 获取设备文件列表
ipcMain.handle('get-device-files', async (event, folderPath) => {
  console.log(`[main.js] 收到 get-device-files 请求: ${folderPath}`); // 添加日志
  try {
    const files = await mtpService.getFiles(folderPath);
     console.log('[main.js] get-device-files 结果:', files); // 添加日志
    return { success: true, files };
  } catch (error) {
    console.error('[main.js] get-device-files 错误:', error); // 添加日志
    return { success: false, error: error.message };
  }
});

// 选择本地文件
ipcMain.handle('select-local-file', async () => {
  console.log('[main.js] 收到 select-local-file 请求'); // 添加日志
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
       console.log('[main.js] select-local-file 结果:', result.filePaths[0]); // 添加日志
      return { success: true, filePath: result.filePaths[0] };
    }
    
     console.log('[main.js] select-local-file 用户取消'); // 添加日志
    return { success: false, error: '未选择文件' };
  } catch (error) {
    console.error('[main.js] select-local-file 错误:', error); // 添加日志
    return { success: false, error: error.message };
  }
});

// 传输文件到设备
ipcMain.handle('transfer-file', async (event, sourcePath, destinationPath) => {
  console.log(`[main.js] 收到 transfer-file 请求: ${sourcePath} -> ${destinationPath}`); // 添加日志
  try {
    const success = await mtpService.transferFile(sourcePath, destinationPath);
    console.log('[main.js] transfer-file 结果:', success); // 添加日志
    return { success };
  } catch (error) {
    console.error('[main.js] transfer-file 错误:', error); // 添加日志
    return { success: false, error: error.message };
  }
});

// 断开MTP设备连接
ipcMain.handle('disconnect-mtp-device', async () => {
  console.log('[main.js] 收到 disconnect-mtp-device 请求');
  try {
    const success = await mtpService.disconnect();
    console.log('[main.js] disconnect-mtp-device 结果:', success);
    return success;
  } catch (error) {
    console.error('[main.js] disconnect-mtp-device 错误:', error);
    throw error;
  }
}); 