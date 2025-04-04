<template>
  <div class="status-bar">
    <div class="status-info">
      <a-tag :color="isConnected ? 'success' : 'default'">{{ statusText }}</a-tag>
      <span class="device-name">{{ deviceName }}</span>
    </div>
    <div class="actions">
      <a-button 
        type="text" 
        size="small" 
        :loading="isLoading" 
        @click="handleDetect"
        :disabled="isLoading"
      >
        <template #icon><ReloadOutlined /></template>
        检测设备
      </a-button>
      <a-button 
        type="text" 
        size="small" 
        danger 
        @click="handleDisconnect" 
        :disabled="!isConnected || isLoading"
      >
        <template #icon><DisconnectOutlined /></template>
        断开连接
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useDeviceStore } from '@/store/device';
import { ReloadOutlined, DisconnectOutlined } from '@ant-design/icons-vue';

// 定义发出的事件
const emit = defineEmits(['re-detect', 'disconnect']);

// 使用设备 store
const deviceStore = useDeviceStore();
const { isConnected, isLoading, deviceInfo } = storeToRefs(deviceStore);

// 计算设备名称
const deviceName = computed(() => {
  if (!isConnected.value) return '未连接';
  return deviceInfo.value?.name || 'MTP设备';
});

// 状态文本
const statusText = computed(() => {
  if (isLoading.value) return '正在检测设备...';
  return isConnected.value ? '已连接' : '未连接';
});

// 检测设备
const handleDetect = async () => {
  emit('re-detect');
};

// 断开连接
const handleDisconnect = async () => {
  emit('disconnect');
};
</script>

<style lang="scss" scoped>
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f5f5f5;
  border-top: 1px solid #e8e8e8;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-name {
  font-size: 12px;
  color: #8c8c8c;
}

.actions {
  display: flex;
  gap: 8px;
}
</style> 