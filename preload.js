// 预加载脚本：在渲染进程和主进程之间提供安全桥接
const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  // MTP设备操作
  detectDevices: () => ipcRenderer.invoke('detect-mtp-devices'),
  disconnectDevice: () => ipcRenderer.invoke('disconnect-mtp-device'),
  getDeviceFiles: (folderPath) => ipcRenderer.invoke('get-device-files', folderPath),
  transferFile: (sourcePath, destinationPath) => 
    ipcRenderer.invoke('transfer-file', sourcePath, destinationPath),
  
  // 文件操作
  selectLocalFile: () => ipcRenderer.invoke('select-local-file')
});
