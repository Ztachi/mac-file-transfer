/*
 * @Author: ztachi(legendryztachi@gmail.com)
 * @Date: 2025-04-04 15:37:13
 * @LastEditors: ztachi(legendryztachi@gmail.com)
 * @LastEditTime: 2025-04-04 16:44:14
 * @FilePath: /mac-file-transfer/src/store/device.js
 * @Description: 
 */
import { defineStore } from 'pinia';

export const useDeviceStore = defineStore('device', {
  state: () => ({
    isConnected: false,
    isLoading: false,
    deviceInfo: null,
    currentPath: '/',
    errorMessage: null
  }),
  
  getters: {
    deviceName: (state) => state.deviceInfo?.name || '未知设备',
    isReady: (state) => state.isConnected && !state.isLoading
  },
  
  actions: {
    async detectDevices() {
      this.isLoading = true;
      this.errorMessage = '';
      
      try {
        // 清除先前的连接状态
        if (this.isConnected) {
          await this.disconnectDevice();
        }
        
        const result = await window.electronAPI.detectDevices();
        
        if (result && result.connected) {
          this.isConnected = true;
          this.deviceInfo = {
            name: result.name || 'MTP设备',
            vid: result.vid || 0,
            pid: result.pid || 0
          };
          
          // 设置初始路径为根目录
          this.currentPath = '/';
          
          return true;
        } else {
          this.isConnected = false;
          this.deviceInfo = null;
          this.errorMessage = '未检测到MTP设备';
          return false;
        }
      } catch (error) {
        console.error('设备检测错误:', error);
        this.isConnected = false;
        this.deviceInfo = null;
        this.errorMessage = `设备检测错误: ${error.message || '未知错误'}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    
    async disconnectDevice() {
      if (!this.isConnected) return true; // 已经断开连接
      
      this.isLoading = true;
      this.errorMessage = '';
      
      try {
        const success = await window.electronAPI.disconnectDevice();
        
        // 重置状态
        this.isConnected = false;
        this.deviceInfo = null;
        this.currentPath = '/';
        
        return true;
      } catch (error) {
        console.error('断开设备连接错误:', error);
        this.errorMessage = `断开设备连接错误: ${error.message || '未知错误'}`;
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    
    setCurrentPath(path) {
      this.currentPath = path;
    }
  }
}); 