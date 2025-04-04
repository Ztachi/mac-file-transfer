<template>
  <div class="app-header">
    <div class="logo">
      <usb-outlined />
      <h1>MTP 文件传输</h1>
    </div>
    <div class="actions">
      <a-tooltip title="设置">
        <a-button type="text" icon>
          <template #icon><setting-outlined /></template>
        </a-button>
      </a-tooltip>
      <a-tooltip title="关于">
        <a-button type="text" icon @click="showAboutInfo">
          <template #icon><info-circle-outlined /></template>
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup>
import { UsbOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';
import { Modal } from 'ant-design-vue';

const showAboutInfo = () => {
  Modal.info({
    title: '关于 MTP 文件传输',
    content: `
      <div style="padding: 16px">
        <p>MTP 文件传输 v0.1.0</p>
        <p>一款专为 macOS 设计的 MTP 文件传输应用</p>
        <p>支持通过 MTP 协议连接各种设备，如手机、相机、游戏设备等</p>
        <p>基于 Electron + Vue + Ant Design Vue 构建</p>
      </div>
    `,
    okText: '确定'
  });
};
</script>

<style lang="scss" scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  height: 64px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1890ff;
  }
}

.actions {
  display: flex;
  gap: 8px;
}
</style> 