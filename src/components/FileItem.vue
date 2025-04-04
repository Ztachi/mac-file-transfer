<template>
  <div 
    class="file-item"
    :class="{ 'file-item-selected': isSelected }"
    @click="handleClick"
    @dblclick="handleDoubleClick"
  >
    <a-tooltip :title="item.name">
      <div class="file-icon">
        <folder-outlined v-if="item.type === 'folder'" style="font-size: 48px; color: #1890ff;" />
        <file-outlined v-else style="font-size: 48px; color: #8c8c8c;" />
      </div>
      <div class="file-name">{{ item.name }}</div>
    </a-tooltip>
  </div>
</template>

<script setup>
import { FolderOutlined, FileOutlined } from '@ant-design/icons-vue';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['item-click', 'item-double-click']);

function handleClick() {
  emit('item-click', props.item);
}

function handleDoubleClick() {
  emit('item-double-click', props.item);
}
</script>

<style lang="scss" scoped>
.file-item {
  display: inline-block;
  width: 100px;
  height: 100px;
  margin: 10px;
  text-align: center;
  vertical-align: top;
  cursor: pointer;
  border-radius: 4px;
  padding: 8px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
  
  &-selected {
    background-color: rgba(24, 144, 255, 0.1);
  }
  
  .file-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 56px;
  }
  
  .file-name {
    font-size: 12px;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style> 