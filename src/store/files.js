import { defineStore } from 'pinia';
import { useDeviceStore } from './device';
import { message } from 'ant-design-vue';

export const useFilesStore = defineStore('files', {
  state: () => ({
    files: [],
    selectedFile: null,
    isLoading: false,
    uploadProgress: {},
    errorMessage: ''
  }),
  
  getters: {
    sortedFiles: (state) => {
      return [...state.files].sort((a, b) => {
        // 文件夹在前
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        // 按名称字母排序
        return a.name.localeCompare(b.name);
      });
    },
    
    isRootDirectory: () => {
      const deviceStore = useDeviceStore();
      return deviceStore.currentPath === '/';
    },
    
    canGoUp: () => {
      const deviceStore = useDeviceStore();
      return deviceStore.currentPath !== '/';
    },
    
    pathSegments: () => {
      const deviceStore = useDeviceStore();
      if (deviceStore.currentPath === '/') return [];
      return deviceStore.currentPath.substring(1).split('/');
    }
  },
  
  actions: {
    async loadFiles(path = '/') {
      if (!path) path = '/';
      
      this.isLoading = true;
      this.errorMessage = '';
      
      try {
        const deviceStore = useDeviceStore();
        
        if (!deviceStore.isConnected) {
          throw new Error('设备未连接');
        }
        
        console.log(`加载文件列表: ${path}`);
        const result = await window.electronAPI.getDeviceFiles(path);
        
        if (result.success) {
          this.files = result.files;
          deviceStore.setCurrentPath(path);
          return { success: true, data: result.files };
        } else {
          throw new Error(result.error || '获取文件列表失败');
        }
      } catch (error) {
        console.error('加载文件失败:', error);
        this.errorMessage = `加载文件失败: ${error.message || '未知错误'}`;
        this.files = [];
        return { success: false, error };
      } finally {
        this.isLoading = false;
      }
    },
    
    selectFile(file) {
      this.selectedFile = file;
    },
    
    async openFile(file) {
      if (file.type === 'folder') {
        await this.loadFiles(file.path);
      } else {
        message.info(`暂不支持预览文件: ${file.name}`);
      }
    },
    
    async goToRoot() {
      return this.loadFiles('/');
    },
    
    async goUp() {
      if (!this.canGoUp) return;
      
      const deviceStore = useDeviceStore();
      const lastSlashIndex = deviceStore.currentPath.lastIndexOf('/');
      
      if (lastSlashIndex === 0) {
        return this.loadFiles('/');
      } else {
        return this.loadFiles(deviceStore.currentPath.substring(0, lastSlashIndex));
      }
    },
    
    async navigateToPath(segmentIndex) {
      if (segmentIndex < 0) {
        return this.goToRoot();
      }
      
      const newPath = '/' + this.pathSegments.slice(0, segmentIndex + 1).join('/');
      return this.loadFiles(newPath);
    },
    
    async uploadFile(filePath, progressCallback) {
      const deviceStore = useDeviceStore();
      const electronAPI = window.electronAPI;
      
      if (!deviceStore.isConnected || !electronAPI) {
        return { success: false, error: '设备未连接或API未就绪' };
      }
      
      const fileName = filePath.split('/').pop();
      const destinationPath = `${deviceStore.currentPath}${deviceStore.currentPath.endsWith('/') ? '' : '/'}${fileName}`;
      
      this.uploadProgress[fileName] = 0;
      
      try {
        // 上传进度更新
        if (progressCallback) {
          const updateProgress = (progress) => {
            this.uploadProgress[fileName] = progress;
            progressCallback(progress);
          };
          
          // 模拟进度更新
          let progress = 0;
          const intervalId = setInterval(() => {
            progress += 10;
            if (progress <= 90) {
              updateProgress(progress);
            } else {
              clearInterval(intervalId);
            }
          }, 300);
        }
        
        const result = await electronAPI.transferFile(filePath, destinationPath);
        
        if (progressCallback) {
          this.uploadProgress[fileName] = 100;
          progressCallback(100);
        }
        
        if (result.success) {
          await this.loadFiles(deviceStore.currentPath); // 刷新当前目录
          return { success: true };
        } else {
          return { success: false, error: result.error || '上传失败' };
        }
      } catch (error) {
        console.error(`[FilesStore] 上传文件出错 (${filePath}):`, error);
        return { success: false, error: `上传文件时出错: ${error.message}` };
      } finally {
        // 清理进度状态
        setTimeout(() => {
          delete this.uploadProgress[fileName];
        }, 2000);
      }
    },
    
    resetState() {
      this.files = [];
      this.selectedFile = null;
      this.errorMessage = '';
      this.uploadProgress = {};
    }
  }
}); 