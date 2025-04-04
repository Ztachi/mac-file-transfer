/*
 * @Author: ztachi(legendryztachi@gmail.com)
 * @Date: 2025-03-04 00:21:51
 * @LastEditors: ztachi(legendryztachi@gmail.com)
 * @LastEditTime: 2025-03-04 00:24:00
 * @FilePath: /mac-file-transfer/src/main.js
 * @Description: Vue 应用程序入口文件
 */
import { createApp } from 'vue';
import App from './App.vue';
import pinia from './store';
import './assets/css/main.css';

const app = createApp(App);

app.use(pinia);
app.mount('#app');