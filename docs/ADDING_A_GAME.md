# 添加一个新游戏

## 目录和命名

- 每个可独立运行的游戏放在 `apps/<game-slug>/`，使用小写英文与短横线，例如 `apps/moon-orchard/`。
- 游戏的 npm `name` 必须唯一，建议与目录名一致。
- 页面、角色名、关卡名可以使用中文；程序目录和资源文件名使用简洁英文。
- 素材放在游戏自己的 `public/assets/`；记录来源、许可或生成提示词到该游戏的 `ASSETS.md`。
- 不复制其他游戏的 `node_modules/`、`dist/` 或锁文件。

## 创建项目

示例：在根目录创建一个 Vite + TypeScript 游戏骨架。

```sh
npm create vite@latest apps/moon-orchard -- --template vanilla-ts
npm install
npm install phaser@3 --workspace=moon-orchard
```

模板初始化需要联网。在 `apps/moon-orchard/package.json` 中设置 `private: true`，确认 `name` 为 `moon-orchard`，并按该游戏需要完善 `dev`、`build`、`preview` 和 `test` 脚本。

这是浏览器游戏的常见起点；不要求未来每个游戏都使用 Phaser。

## 工作区约定

根目录已配置 `"workspaces": ["apps/*"]`，新建的直接子目录会自动纳入工作区。统一在根目录执行安装命令，维护唯一的根 `package-lock.json`。

```sh
npm run dev --workspace=moon-orchard
npm run test --workspace=moon-orchard
npm run build --workspace=moon-orchard
```

同时启动多个游戏时使用不同端口，例如：

```sh
npm run dev --workspace=moon-orchard -- --port 5174
```

要更换根目录默认启动的游戏，修改根 `package.json` 的 `dev` 和 `preview` 脚本。全部游戏测试与构建使用 `--workspaces --if-present`，有对应脚本的游戏会被执行；游戏需要验证时应主动提供测试脚本。

## 每个游戏应包含

1. 可独立运行的源码和配置。
2. README：玩法、操作、启动、构建和部署路径。
3. ASSETS.md：图片、字体、音乐等来源；AI 生成素材附最终提示词。
4. 对关卡可达性、核心规则或存档等关键行为的测试。
5. 若部署到子目录，设置 Vite `base: './'`，并使用相对素材路径。

## 完成后

- 在根 README 的游戏目录中加入名称、目录、简介和技术栈。
- 在游戏 README 记录当前完成内容与尚未验证的事项。
- 运行 `npm test` 和 `npm run build`，再用浏览器试玩。
- 提交源码、原始素材和根锁文件，不提交依赖和构建产物。
- 各游戏分别部署自己的 `dist/`。如以后需要统一游戏大厅，可新增独立工作区。
