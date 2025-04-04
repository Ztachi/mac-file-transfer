<template>
  <div 
    class="file-explorer" 
    @dragover="handleDragOver"
    @drop="handleFileDrop"
    @dragleave="handleDragLeave"
  >
    <!-- 面包屑导航 -->
    <div class="explorer-breadcrumb">
      <a-breadcrumb>
        <a-breadcrumb-item @click="goToRoot">
          {{ deviceName || 'MTP设备' }}
        </a-breadcrumb-item>
        <template v-for="(segment, index) in pathSegments" :key="index">
          <a-breadcrumb-item @click="navigateToPath(index)">
            {{ segment }}
          </a-breadcrumb-item>
        </template>
      </a-breadcrumb>
      <div class="explorer-actions">
        <a-button type="primary" @click="refreshFiles" :loading="isLoadingFiles">
          <template #icon><sync-outlined /></template>
          刷新
        </a-button>
        <a-button v-if="canGoUp" @click="goUp">
          <template #icon><arrow-up-outlined /></template>
          返回上级
        </a-button>
      </div>
    </div>

    <!-- 文件区域 -->
    <div 
      class="explorer-content"
      :class="{ 'drag-over': isDragOver }"
    >
      <div v-if="isLoadingFiles" class="loading-container">
        <a-spin tip="加载中..."></a-spin>
      </div>
      <div v-else-if="sortedFiles.length === 0" class="empty-container">
        <inbox-outlined style="font-size: 48px; color: #d9d9d9;" />
        <p>此文件夹为空</p>
      </div>
      <div v-else class="files-container">
        <file-item 
          v-for="file in sortedFiles" 
          :key="file.path || file.name" 
          :item="file" 
          :is-selected="selectedFile === file"
          @item-click="selectFileItem"
          @item-double-click="openFileItem"
        />
      </div>

      <!-- 拖拽提示 -->
      <div v-if="isDragOver" class="drag-overlay">
        <upload-outlined style="font-size: 48px;" />
        <p>释放鼠标上传文件到当前文件夹</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import FileItem from './FileItem.vue';
import { SyncOutlined, ArrowUpOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useDeviceStore } from '@/store/device';
import { useFilesStore } from '@/store/files';
import { storeToRefs } from 'pinia';

const props = defineProps({
  deviceName: {
    type: String,
    default: ''
  },
  isConnected: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['path-change', 'error']);

const deviceStore = useDeviceStore();
const filesStore = useFilesStore();

const isDragOver = ref(false);

// 使用storeToRefs获取响应式状态
const { isConnected: deviceConnected, isLoading: deviceLoading, currentPath } = storeToRefs(deviceStore);
const { files, isLoading: filesLoading, selectedFile } = storeToRefs(filesStore);

// 计算属性直接从store中获取
const sortedFiles = computed(() => filesStore.sortedFiles);
const isRootDirectory = computed(() => filesStore.isRootDirectory);
const canGoUp = computed(() => filesStore.canGoUp);
const pathSegments = computed(() => filesStore.pathSegments);

// 文件加载状态
const isLoadingFiles = computed(() => filesLoading.value || deviceLoading.value);

// 加载文件列表
const loadFiles = async () => {
  try {
    if (!deviceConnected.value) {
      message.warning('设备未连接，请先连接设备');
      return;
    }
    await filesStore.loadFiles(currentPath.value);
  } catch (error) {
    console.error('加载文件列表失败:', error);
    message.error(`加载文件列表失败: ${error.message || '未知错误'}`);
  }
};

// 选择文件
const selectFileItem = (file) => {
  filesStore.selectFile(file);
};

// 打开文件或文件夹
const openFileItem = async (file) => {
  try {
    await filesStore.openFile(file);
  } catch (error) {
    console.error('打开文件失败:', error);
    message.error(`打开文件失败: ${error.message || '未知错误'}`);
  }
};

// 返回根目录
const goToRoot = async () => {
  try {
    await filesStore.goToRoot();
  } catch (error) {
    console.error('返回根目录失败:', error);
    message.error(`返回根目录失败: ${error.message || '未知错误'}`);
  }
};

// 返回上级目录
const goUp = async () => {
  try {
    if (canGoUp.value) {
      await filesStore.goUp();
    }
  } catch (error) {
    console.error('返回上级目录失败:', error);
    message.error(`返回上级目录失败: ${error.message || '未知错误'}`);
  }
};

// 导航到特定路径
const navigateToPath = async (path) => {
  try {
    await filesStore.navigateToPath(path);
  } catch (error) {
    console.error(`导航到路径 ${path} 失败:`, error);
    message.error(`导航到路径失败: ${error.message || '未知错误'}`);
  }
};

// 监听设备连接状态变化
watch(deviceConnected, async (newValue) => {
  console.log('设备连接状态变化:', newValue);
  if (newValue) {
    await loadFiles();
  } else {
    // 重置文件状态
    filesStore.resetState();
  }
});

// 组件挂载时如果设备已连接，则加载文件
onMounted(async () => {
  console.log('FileExplorer组件挂载, 连接状态:', deviceConnected.value);
  if (deviceConnected.value) {
    await loadFiles();
  }
});

// 刷新当前目录
function refreshFiles() {
  loadFiles().catch(error => {
    console.error('刷新文件列表失败:', error);
    emit('error', error.message || '刷新文件列表失败');
  });
}

// 处理拖拽事件
function handleDragOver(event) {
  event.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave(event) {
  event.preventDefault();
  isDragOver.value = false;
}

async function handleFileDrop(event) {
  event.preventDefault();
  isDragOver.value = false;
  
  if (!deviceConnected.value) {
    message.warning('设备未连接，无法上传文件');
    return;
  }
  
  const files = event.dataTransfer.files;
  if (files.length === 0) return;
  
  // 循环处理每个文件
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    message.loading(`正在上传文件: ${file.name}`, 0);
    
    try {
      const result = await filesStore.uploadFile(file.path, (progress) => {
        // 进度回调函数，可以用于更新UI
        console.log(`上传进度: ${file.name} - ${progress}%`);
      });
      
      if (result.success) {
        message.success(`上传成功: ${file.name}`);
      } else {
        message.error(`上传失败: ${file.name} - ${result.error || '未知错误'}`);
      }
    } catch (error) {
      message.error(`上传时出错: ${file.name} - ${error.message}`);
    }
  }
}

// 监听路径变化
watch(currentPath, (newPath) => {
  emit('path-change', newPath);
});

// 监听错误消息
watch(() => filesStore.errorMessage, (newError) => {
  if (newError) {
    emit('error', newError);
  }
});
</script>

<style lang="scss" scoped>
.file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
}

.explorer-breadcrumb {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e8e8e8;
}

.explorer-actions {
  display: flex;
  gap: 8px;
}

.explorer-content {
  flex: 1;
  position: relative;
  padding: 16px;
  overflow: auto;
  background: white;
  
  &.drag-over {
    background-color: rgba(24, 144, 255, 0.05);
  }
}

.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 200px;
}

.empty-container p {
  margin-top: 16px;
  color: #8c8c8c;
}

.files-container {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 10;
  color: #1890ff;
  
  p {
    margin-top: 16px;
    font-size: 16px;
  }
}
</style> 