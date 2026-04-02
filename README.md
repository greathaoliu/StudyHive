# StudyHive

面向大学生的 AI 课程资料聚合器。自动搜索、下载和管理来自多个平台的学习资源。

**Created by 皓同学开发**

## 功能特性

- **培养方案解析** — 上传培养方案 PDF，AI 自动提取课程、知识点，并生成常见别名
- **多源智能搜索** — AI 在 csdiy.wiki、hackway.org、MOOC 平台（Coursera、Bilibili、学堂在线）等渠道搜索资料
- **GitHub 仓库扫描** — 自动扫描课程仓库（如 zju-icicles）中的 PDF，精确到子文件夹级别的来源链接
- **课程别名** — 为课程添加自定义搜索关键词（如"数学分析"加上"微积分""Calculus"），扩大搜索范围
- **视频嵌入播放** — Bilibili、YouTube 视频内嵌播放，其他平台跳转浏览器
- **AI 对话助手** — 流式聊天，自动触发搜索，补全资料
- **资料管理** — 收藏、归档、批量下载、幻觉清理、链接有效性验证
- **搜索模式** — 聚焦模式（仅限已启用信息源）或发散模式（AI 广泛搜索）
- **开发者日志** — 完整展示 AI 搜索流程的分类日志，全程透明

## 技术栈

- **Electron** + **React 19** + **TypeScript**
- **Zustand** 状态管理
- **Tailwind CSS 4** + **DaisyUI 5** UI 框架
- **electron-vite** 构建工具
- **pdfjs-dist** PDF 文本提取
- **Turborepo** monorepo 架构

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式运行
pnpm dev:desktop

# 生产构建
pnpm build:desktop
```

## 配置说明

1. 进入 **设置 > AI 配置**，填入 API Key（支持 OpenAI 兼容接口和 Anthropic API）
2. 进入 **设置 > 信息源**，启用/禁用资料来源，添加 GitHub 仓库
3. 在侧栏上传培养方案 PDF，自动提取课程列表
4. 点击课程旁的搜索图标，开始搜集资料

## 项目结构

```
apps/
  desktop/              # Electron 桌面应用
    src/
      main/             # 主进程（IPC 处理、GitHub 扫描、AI 调用）
      preload/          # 预加载桥接
      renderer/         # React 前端
        modules/        # UI 组件（侧栏、资料列表、内容面板、聊天）
        pages/          # 路由页面（设置、收藏、搜索）
        store/          # Zustand 状态管理（课程、资料、聊天、日志）
packages/
  types/                # 共享 TypeScript 类型
```

## 开源协议

MIT License — 详见 [LICENSE](LICENSE)。
