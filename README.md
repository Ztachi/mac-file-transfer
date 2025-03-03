# Switch MTP Transfer for Mac

一款专为macOS设计的Nintendo Switch文件传输应用程序，让您轻松管理和传输Switch游戏机中的截图、视频和其他文件。

## 功能特点

- 自动检测连接的Nintendo Switch设备
- 浏览Switch设备上的文件和文件夹
- 轻松传输文件到Switch或从Switch提取文件
- 直观的用户界面，优雅的文件管理体验
- 专为macOS系统优化设计

## 技术栈

该应用使用以下技术构建：

- **Electron**: 跨平台桌面应用框架
- **Vue 3**: 用于构建用户界面的JavaScript框架
- **Vite**: 现代前端构建工具
- **TailwindCSS**: 实用工具优先的CSS框架
- **Sass**: CSS预处理器
- **Child Process**: 用于与系统级MTP工具交互

## 安装

### 前提条件

- macOS 10.14或更高版本
- Node.js 14.0或更高版本
- npm或yarn包管理器

### 安装步骤

1. 克隆仓库
   ```bash
   git clone https://github.com/yourusername/mac-file-transfer.git
   cd mac-file-transfer
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 开发模式启动
   ```bash
   npm run dev
   ```

4. 构建应用
   ```bash
   npm run build
   ```

## 使用说明

1. 启动应用程序
2. 将Nintendo Switch通过USB连接到Mac，并在Switch上启用MTP模式
   - 在Switch主界面进入设置 > 数据管理 > 管理软件/截图和视频 > 复制到电脑
3. 点击应用中的"检测设备"按钮
4. 连接成功后，您可以浏览设备文件并管理传输

## 开发指南

### 项目结构

```
mac-file-transfer/
├── main.js           # Electron主进程
├── src/
│   ├── main.js       # Vue应用入口
│   ├── App.vue       # 主Vue组件
│   ├── assets/       # 静态资源
│   └── services/     # 服务层
│       └── mtpService.js  # MTP通信服务
├── index.html        # HTML入口
├── vite.config.js    # Vite配置
└── package.json      # 项目配置
```

### MTP通信实现

由于macOS原生不支持MTP协议，该应用使用以下方式实现通信：

- 使用`system_profiler`命令检测连接的USB设备
- 分析输出信息识别Nintendo Switch设备
- 使用系统命令或第三方工具实现文件传输

### 调试技巧

开发过程中的常见调试方法：

1. 检查Electron主进程日志
   ```bash
   npm run dev
   ```

2. 使用终端命令检查USB设备连接
   ```bash
   system_profiler SPUSBDataType
   ```

3. 使用Electron开发者工具调试渲染进程

## 注意事项

- macOS对MTP协议支持有限，可能需要安装额外的驱动或工具
- 某些操作可能需要管理员权限
- 应用仍在开发中，部分功能可能不完整
- 传输大文件时请保持Switch和Mac的稳定连接

## 贡献

欢迎通过Pull Request或Issues提交改进建议！

## 许可

[MIT License](LICENSE)