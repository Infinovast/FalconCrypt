# FalconCrypt

**简体中文** | [English](README_en.md)

FalconCrypt 是一款在浏览器中运行的单人文字地牢冒险游戏，结合轻度 Roguelike 玩法、React 界面与 Canvas 像素动效。选择职业，在随机房间中管理生命、护甲、食物和金币，逐层挑战 Boss，寻找鹰魂结晶。

本仓库的 `main` 分支维护 Web 版本；早期 Python 终端版本保留在 [`legacy` 分支](https://github.com/Infinovast/FalconCrypt/tree/legacy)。

## 目录

- [游戏特色](#游戏特色)
- [快速开始](#快速开始)
- [开发命令](#开发命令)
- [构建与部署](#构建与部署)
- [项目结构](#项目结构)
- [参与贡献](#参与贡献)
- [许可证](#许可证)

## 游戏特色

- **随机地牢**：共 4 层，每层依次有 4 / 5 / 6 / 7 个房间，包含分叉路线、地图侦察和关底 Boss。
- **五种职业**：术士、圣骑士、盗贼、祭司和刺客，每局随机提供 4 名候选角色，各有独特技能或被动能力。
- **房间事件**：战斗、宝箱、陷阱、商人、篝火、铸锻、雕像与矿洞，围绕资源分配做出选择。
- **战斗与成长**：普通攻击、暴击、职业技能、四类卷轴，以及经验升级和护甲强化。
- **交互反馈**：资源收益与消耗预览、分类日志、危险程度提示，以及房间与战斗动效。
- **响应式界面**：桌面双栏与窄屏单栏布局。

游戏逻辑完全在浏览器中运行，无需后端服务。当前游戏界面为中文，尚未实现存档；刷新页面会重置本局进度。

玩法流程：开始冒险 → 选择职业 → 探索房间 → 处理事件或战斗 → 资源结算与升级 → 挑战最终 Boss。

详细规则见[玩法指南](docs/guide.md)。指南保留了跨平台规则约定，部分数值可能与 Web 版本不同；当前行为以 [`constants.ts`](src/game/constants.ts)、[`state.ts`](src/game/state.ts) 和[测试](src/game/state.spec.ts)为准。

## 快速开始

### 环境要求

- Node.js 22 LTS（22.12 或更高的 22.x 版本）或 24 LTS。
- npm（随 Node.js 安装）。
- 支持 ES2020 和 Canvas 2D 的现代浏览器。

### 安装与启动

```bash
git clone --branch main https://github.com/Infinovast/FalconCrypt.git
cd FalconCrypt
npm ci
npm run dev
```

默认访问 <http://localhost:5173>，实际地址以终端输出为准。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按锁文件安装依赖 |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm test` | 运行 GameState 单元测试 |
| `npm run test:watch` | 以监听模式运行测试 |
| `npm run build` | 执行 TypeScript 检查并构建到 `dist/` |
| `npm run preview` | 本地预览已有的生产构建 |
| `npm run deploy` | 构建并部署到 Cloudflare Pages 项目 `fc` |

开发调试时，可按 `Ctrl+Shift+Alt+D` 切换开发者面板，调整资源或下一房间类型。

## 构建与部署

### 静态托管

```bash
npm run build
npm run preview
```

将生成的 `dist/` 目录部署到静态托管服务即可。托管平台使用构建命令 `npm run build`，输出目录为 `dist`。若部署到子路径，需要在 [`vite.config.ts`](vite.config.ts) 中设置对应的 `base`。

### Cloudflare Pages

项目已将 Wrangler 列为开发依赖。先登录 Cloudflare，再构建并部署到你自己的 Pages 项目：

```bash
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name your-project-name
```

将 `your-project-name` 替换为你的项目名称。现有 `npm run deploy` 脚本将项目名固定为 `fc`；使用该快捷命令前，请在 [`package.json`](package.json) 中改为自己的项目名称。

## 项目结构

技术栈：React 18、TypeScript、Vite 5、Vitest、原生 CSS 与 Canvas 2D。

```text
.
├── docs/guide.md              # 玩法指南与跨平台规则约定
├── src/
│   ├── animations/            # 房间过场、战斗与资源动效
│   ├── components/            # 操作面板、状态栏、资源组件与画布
│   ├── game/
│   │   ├── constants.ts       # 职业、房间、数值与提示文案
│   │   ├── state.ts           # GameState：地图、事件与战斗规则
│   │   ├── state.spec.ts      # 游戏规则单元测试
│   │   ├── types.ts           # 领域类型
│   │   └── uiHelpers.ts       # 资源预览、日志与危险程度计算
│   ├── App.tsx               # 游戏阶段与界面交互编排
│   ├── main.tsx              # React 入口
│   └── styles.css            # 全局样式、响应式布局与 CSS 动画
├── index.html                # Vite 页面入口
├── package.json              # 依赖与开发命令
├── package-lock.json         # 依赖锁文件
├── tsconfig.json             # TypeScript 配置
└── vite.config.ts            # Vite 配置
```

`GameState` 管理可变的 `snapshot`，由 `App.tsx` 在调用规则方法后触发界面刷新。玩法逻辑放在 `src/game/`，表现组件放在 `src/components/`，Canvas 动效由 `src/animations/` 和 `GameCanvas.tsx` 负责。`node_modules/`、`dist/` 和 `.wrangler/` 为本地产物，已加入忽略规则。

## 参与贡献

欢迎通过 [Issues](https://github.com/Infinovast/FalconCrypt/issues) 反馈问题或讨论功能，也可以向 `main` 分支提交 Pull Request。

1. 从 `main` 创建工作分支，保持一次修改聚焦一个问题。
2. 修改玩法时，同步更新相关测试和文档；修改 README 时保持[中英文版本](README_en.md)一致。
3. 提交前运行 `npm test` 和 `npm run build`。
4. 提交消息使用简短前缀，例如 `feat: 添加房间事件`、`fix: 修复战斗结算`、`docs: 更新玩法说明`。也可使用 `refactor:`、`test:`、`build:` 或 `chore:`。

反馈 Bug 时，请附上复现步骤、浏览器版本、相关楼层与房间、角色及资源状态，以及截图或日志。

## 许可证

本项目采用 [MIT 许可证](LICENSE)，版权所有 © 2026 [Harold Chiu（Infinovast）](https://github.com/Infinovast)。
