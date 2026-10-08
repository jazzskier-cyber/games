# Jazzskier Games · 原创小游戏合集

一个持续生长的中文浏览器游戏仓库。每个游戏独立放在 `apps/` 下，可以单独开发、测试、构建和部署；使用 npm workspaces 统一管理依赖。

维护者：**jazzskier-cyber** · jazzskier@gmail.com

## 游戏目录

| 游戏 | 简介 | 目录 | 技术 |
| --- | --- | --- | --- |
| **云上花园 · Cloud Garden** | 背着花园的旅行兽，在 21 关云岛中收集阳光。原创绘本风美术，中文界面，键盘与触摸操作。 | [apps/cloud-garden](apps/cloud-garden) | TypeScript、Vite、Phaser 3 |

### 云上花园

![云上花园的绘本背景](apps/cloud-garden/public/assets/cloud-garden.png)

- 21 关完整难度顺序：`EEMMEMHEMMEHEMMHEHMEM`，E 简单、M 中等、H 困难。
- 「记忆小花」检查点：花苞在到达时绽放，跌落后回到最近的小花平台。
- 支持旅程地图、自由选关、下一关，以及本机保存通关进度和每关最佳成绩。
- 第一关保留宽平台和渐进教学；后续关卡加入更小的平台、快速绒球和高空侧风。
- [游戏说明与控制方式](apps/cloud-garden/README.md) · [美术与 AI 生成记录](apps/cloud-garden/ASSETS.md)

## 快速开始

推荐 Node.js 24 和 npm（根目录 `.nvmrc` 已配置）。最低支持 Node.js 22.12。

在仓库根目录运行：

```sh
npm ci
npm run dev
```

打开终端显示的地址，默认为 `http://127.0.0.1:5173/`。默认启动「云上花园」。游戏运行不需要账号、数据库或 AI API 密钥。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 开发默认游戏：云上花园 |
| `npm test` | 运行全部游戏的测试 |
| `npm run build` | 检查类型并构建全部游戏 |
| `npm run preview` | 预览云上花园的生产构建 |
| `npm run dev --workspace=cloud-garden` | 按名称启动指定游戏 |
| `npm run build --workspace=cloud-garden` | 只构建指定游戏 |
| `npm run test --workspace=cloud-garden` | 只测试指定游戏 |

## 仓库结构

```text
games/
├── apps/
│   └── cloud-garden/
│       ├── src/                # 场景、物理、关卡数据与界面
│       ├── public/assets/      # 游戏专属图片，随构建发布
│       ├── tests/              # 碰撞、通关与存档测试
│       ├── README.md           # 游戏说明
│       ├── ASSETS.md           # 素材来源与生成提示词
│       ├── package.json       # 游戏独立依赖与脚本
│       └── vite.config.ts
├── docs/
│   └── ADDING_A_GAME.md        # 新增游戏的约定和步骤
├── package.json               # 工作区与统一命令
├── package-lock.json          # 全仓库唯一 npm 锁文件
├── .gitignore
└── README.md
```

每个游戏拥有自己的素材、说明与构建产物，互不混放。只有出现实际复用需求时，再引入共享代码包。

## 添加下一个游戏

在 `apps/<game-slug>/` 下创建独立项目，在其 `package.json` 中设置唯一的 `name`，提供 `dev`、`build`、`test` 等脚本。然后在仓库根目录运行 `npm install`，再把游戏加入上方目录。

详细步骤见 [新增游戏指南](docs/ADDING_A_GAME.md)。

## 测试与发布

```sh
npm test
npm run build
```

云上花园目前包含 52 项自动测试，覆盖全部 21 关在 30fps 和 60fps 下正常输入通关、难度顺序、检查点、碰撞和存档。界面、音效和手机触摸手感仍需实际浏览器试玩。

各游戏分别输出到自己的 `dist/`，例如 `apps/cloud-garden/dist/`。静态托管时，只上传相应游戏的 `dist/`；不要把源码目录当作发布目录。云上花园使用相对资源路径，支持子目录部署。

GitHub 保存源码并不等于已部署游戏；本仓库未自动开启 GitHub Pages，也未自动提交到游戏平台。

## 创作与素材

代码、美术与游戏设计采用 AI 辅助创作。素材来源和提示词记录在各游戏的 `ASSETS.md`，角色和背景保存在项目内。没有使用参考游戏的角色、精灵图、音乐或关卡布局。

仓库尚未指定开源许可证。
