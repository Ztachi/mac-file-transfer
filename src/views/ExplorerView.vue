<template>
  <div class="explorer-view">
    <AppHeader />
    <div class="main-content">
      <StatusBar 
        @re-detect="handleRedetect" 
        @disconnect="handleDisconnect" 
      />
      
      <div v-if="isConnected" class="file-explorer-container">
        <FileExplorer 
          ref="explorerRef"
          :is-connected="isConnected"
          :device-name="deviceInfo?.name"
          @error="handleError" 
        />
      </div>
      
      <div v-else class="connect-prompt">
        <a-empty
          description="未连接设备"
          :image="Empty.PRESENTED_IMAGE_SIMPLE"
        >
          <a-button type="primary" @click="handleRedetect" :loading="isLoading">
            检测设备
          </a-button>
        </a-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppHeader from '../components/Header.vue';
import FileExplorer from '../components/FileExplorer.vue';
import StatusBar from '../components/StatusBar.vue';
import { Empty, message } from 'ant-design-vue';
import { UsbOutlined, DisconnectOutlined } from '@ant-design/icons-vue';
import { useDeviceStore } from '@/store/device';
import { useFilesStore } from '@/store/files';
import { storeToRefs } from 'pinia';

const deviceStore = useDeviceStore();
const filesStore = useFilesStore();
const { isConnected, isLoading, deviceInfo, currentPath } = storeToRefs(deviceStore);

const explorerRef = ref(null);

// 组件挂载时自动检测设备
onMounted(async () => {
  try {
    console.log('ExplorerView组件挂载, 正在检测设备...');
    await deviceStore.detectDevices();
  } catch (error) {
    console.error('检测设备失败:', error);
    message.error(`检测设备失败: ${error.message || '未知错误'}`);
  }
});

// 重新检测设备
const handleRedetect = async () => {
  try {
    await deviceStore.detectDevices();
  } catch (error) {
    console.error('重新检测设备失败:', error);
    message.error(`重新检测设备失败: ${error.message || '未知错误'}`);
  }
};

// 断开连接
const handleDisconnect = async () => {
  try {
    await deviceStore.disconnectDevice();
  } catch (error) {
    console.error('断开设备连接失败:', error);
    message.error(`断开设备连接失败: ${error.message || '未知错误'}`);
  }
};

// 处理错误
const handleError = (error) => {
  console.error('文件操作错误:', error);
  message.error(`文件操作错误: ${error.message || '未知错误'}`);
};

function loadFiles(path) {
  if (explorerRef.value) {
    explorerRef.value.loadFiles(path);
  }
}
</script>

<style lang="scss" scoped>
.explorer-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f5f5f5;
}

.file-explorer-container {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.connect-prompt {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #fff;
  border-radius: 8px;
  margin: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style> 