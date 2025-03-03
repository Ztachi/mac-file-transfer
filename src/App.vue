<template>
  <div class="container mx-auto p-6">
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-center">Switch MTP文件传输</h1>
      <p class="text-center text-gray-600">连接您的Switch并传输文件</p>
    </header>

    <main>
      <div class="bg-white p-6 rounded-lg shadow-md">
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">设备状态</h2>
          <div class="flex items-center space-x-2">
            <div :class="['w-3 h-3 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500']"></div>
            <span>{{ isConnected ? '已连接' : '未连接' }}</span>
          </div>
          <button 
            @click="detectDevices" 
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            检测设备
          </button>
        </div>

        <div v-if="isConnected" class="grid grid-cols-2 gap-6">
          <div class="border rounded p-4">
            <h3 class="text-lg font-medium mb-2">设备文件</h3>
            <div class="h-64 overflow-y-auto bg-gray-50 p-2 rounded">
              <!-- 设备文件列表将显示在这里 -->
              <p class="text-gray-500 italic">暂无文件</p>
            </div>
          </div>
          
          <div class="border rounded p-4">
            <h3 class="text-lg font-medium mb-2">本地文件</h3>
            <div class="h-64 overflow-y-auto bg-gray-50 p-2 rounded">
              <!-- 本地文件列表将显示在这里 -->
              <p class="text-gray-500 italic">暂无文件</p>
            </div>
            <button 
              @click="selectLocalFile" 
              class="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
            >
              选择本地文件
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref } from 'vue';
const { ipcRenderer } = window.require('electron');

export default {
  name: 'App',
  setup() {
    const isConnected = ref(false);
    const devices = ref([]);
    const selectedLocalFile = ref(null);

    async function detectDevices() {
      try {
        const result = await ipcRenderer.invoke('detect-mtp-devices');
        if (result.success) {
          devices.value = result.devices;
          isConnected.value = result.devices.length > 0;
        } else {
          console.error('设备检测失败:', result.error);
        }
      } catch (error) {
        console.error('设备检测错误:', error);
      }
    }

    async function selectLocalFile() {
      try {
        const result = await ipcRenderer.invoke('select-local-file');
        if (result.success) {
          selectedLocalFile.value = result.filePath;
          console.log('已选择文件:', selectedLocalFile.value);
        }
      } catch (error) {
        console.error('选择文件错误:', error);
      }
    }

    return {
      isConnected,
      devices,
      detectDevices,
      selectLocalFile
    };
  }
};
</script>

<style lang="scss">
// 如果需要特定样式，可以在这里添加
</style> 