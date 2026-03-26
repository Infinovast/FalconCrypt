# FalconCrypt Web

FalconCrypt Web 是 FalconCrypt 的前端独立版本，采用“Web 原生 UI 为主 + Canvas 动效为辅”的路线。

目标是保留原有文字冒险核心规则，同时提供更现代的 UI 表达、可演进的动效层，以及更低门槛的前端协作开发体验。

## 1. 技术方案

- 框架: React 18 + TypeScript
- 构建: Vite 5
- UI: 原生 React 组件 + CSS（非第三方 UI 库）
- 动效层: HTML5 Canvas（当前使用纯 2D API）
- 状态层: 自定义 `GameState`（位于 `src/game/state.ts`）

为什么是这套方案：

- UI 面板开发效率高，易做复杂状态展示
- Canvas 可以独立演进，不会绑死在某个游戏引擎
- 适合先快速迁移玩法，再逐步引入 PixiJS 或更完整渲染层

## 2. 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

### 生产构建

```bash
npm run build
```

### 本地预览构建产物

```bash
npm run preview
```

## 3. 当前项目文件架构

```text
web/
├─ dist/                        # 构建产物（可删除后重新 build）
│  ├─ index.html
│  └─ assets/
├─ src/
│  ├─ components/
│  │  └─ GameCanvas.tsx         # Canvas 动效层（像素风动态背景）
│  ├─ game/
│  │  ├─ constants.ts           # 玩法常量（楼层、角色、房间、权重等）
│  │  ├─ state.ts               # 核心规则与状态管理（GameState）
│  │  └─ types.ts               # 领域类型定义（Player/Dungeon/Combat）
│  ├─ App.tsx                   # 页面主容器、阶段流转、交互入口
│  ├─ main.tsx                  # React 挂载入口
│  └─ styles.css                # 全局样式与布局
├─ index.html                   # Vite HTML 入口
├─ package.json                 # 脚本与依赖
├─ package-lock.json            # 锁定依赖版本
├─ tsconfig.json                # TS 编译配置
├─ tsconfig.tsbuildinfo         # TS 增量构建缓存
└─ vite.config.ts               # Vite 配置
```

## 4. 模块职责说明

### 4.1 `src/App.tsx`

负责“前端表现层 + 流程编排”。

- 管理当前阶段 `stage`（menu / character / explore / combat）
- 调用 `gameState` 完成流程推进
- 组合 UI 面板和 Canvas 组件
- 通过 `tick` 触发刷新（当前原型方案）

建议后续演进：

- 将 `stage` 迁移到状态机或 reducer
- 把按钮动作抽离到 `actions/`，减少组件体积

### 4.2 `src/game/state.ts`

负责“规则层 + 状态层”。

主要能力：

- 初始化与重置
- 随机角色候选生成
- 角色确认与属性注入
- 地图生成（带权重）
- 进入房间 / 推进房间
- 开始战斗 / 玩家攻击
- 房间结算（食物恢复、饥饿损失、升级）
- 日志维护

注意：当前是原型版本，使用可变 `snapshot`。后续若状态复杂度增加，建议引入不可变更新策略。

### 4.3 `src/components/GameCanvas.tsx`

负责“视觉动效层”。

- 输入: `dangerLevel`
- 输出: 动态背景、粒子、中心结晶
- 使用 `requestAnimationFrame` 驱动

后续替换路径：

- 保留组件接口不变，内部替换为 PixiJS
- 或新增 `BattleCanvas` / `MapCanvas` 细分场景画布

### 4.4 `src/styles.css`

负责视觉基调与响应式布局：

- 双栏面板布局（左侧场景 + 右侧数据）
- 像素风画布样式（`image-rendering: pixelated`）
- 移动端单列降级

## 5. 运行流程（当前版本）

1. 菜单阶段：点击“开始冒险”
2. 角色阶段：从 3 名随机角色中选择
3. 探索阶段：进入房间，触发事件或战斗
4. 战斗阶段：普通攻击，判定胜负
5. 战斗胜利后返回探索，失败后回到菜单

## 6. 数据模型概览

- `PlayerState`: 角色属性（HP/金币/防御/食物/技能/等级）
- `DungeonState`: 地图与当前层房间进度
- `CombatState`: 当前战斗目标与战斗属性
- `GameSnapshot`: 聚合快照 + 日志

说明：地图结构当前为 `Record<string, RoomTuple>`，key 格式是 `"floor-room"`（例如 `"2-4"`）。

## 7. 与旧 Python 版本的关系

- 本目录是 Web 独立项目，可单独开发与部署
- 玩法规则由 Python 迁移到 TypeScript（进行中）
- 迁移策略是“先对齐核心玩法，再补齐细节事件”

建议迁移优先级：

1. 事件系统（`chest_event`、`trap_event` 等）完整实现
2. 战斗系统细化（技能、卷轴、状态效果）
3. 地图可视化与房间信息显隐策略
4. 结算与成长体系平衡

## 8. 开发规范建议

### 8.1 目录与命名

- 组件文件: PascalCase（如 `GameCanvas.tsx`）
- 逻辑文件: camelCase / 小写语义（如 `state.ts`）
- 类型放到 `src/game/types.ts`，避免散落

### 8.2 代码约束

- TypeScript `strict` 已开启，保持无类型错误
- 禁止在 React 组件中写过重规则逻辑
- 规则逻辑尽量放在 `src/game/` 下

### 8.3 状态变更原则

- UI 层只触发动作，不直接散改数据
- 优先通过 `gameState` 暴露的方法变更状态
- 日志写入统一通过 `addLog`

## 9. 后续重构路线图（建议）

### 阶段 A: 稳定规则层

- 把所有房间事件迁移完成
- 增加战斗异常分支覆盖（逃跑、特殊技能）
- 完成最小可玩循环

### 阶段 B: 可维护架构

- 引入状态机（如 XState）管理阶段流转
- 引入测试（Vitest）覆盖 `GameState` 关键路径
- 拆分 App 为页面容器 + 面板组件

### 阶段 C: 表现升级

- Canvas 升级为 PixiJS（可选）
- 增加像素角色动画和技能特效
- 增加音效与视觉反馈

## 10. 常见问题

### Q1: 为什么会有 `dist/` 和 `tsconfig.tsbuildinfo`？

- `dist/` 是构建产物。
- `tsconfig.tsbuildinfo` 是 TS 增量构建缓存文件。

### Q2: 这个项目是否必须保留 Python 版本？

不必须。Web 版本已可独立运行。若后续完全切换到 Web，可将 Python 版本标记为 legacy。

### Q3: 什么时候引入后端？

当前是纯前端单机玩法，不依赖后端。只有在需要存档同步、排行榜、账号体系时才需要后端。

## 11. 维护者备注

如果你是新加入开发者，建议先阅读顺序：

1. `src/App.tsx`
2. `src/game/state.ts`
3. `src/game/constants.ts`
4. `src/components/GameCanvas.tsx`
5. `src/styles.css`

完成上述阅读后，再开始功能开发，能最快理解当前项目脉络。
