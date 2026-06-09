# FalconCrypt Web

FalconCrypt Web 是 FalconCrypt 的前端独立版本，采用“Web 原生 UI 为主 + Canvas 动效为辅”的路线。

目标是保留原有文字冒险核心规则，同时提供更现代的 UI 表达、丰富的动效反馈，以及更低门槛的前端协作开发体验。当前版本已经实现了完整的地牢探险、多职业角色、丰富的随机事件和道具卷轴系统。

## 1. 技术方案

- 框架: React 18 + TypeScript
- 构建: Vite 5
- UI: 原生 React 组件 + 纯 CSS 响应式布局（非第三方 UI 库）
- 动效层: HTML5 Canvas（纯 2D API 像素风渲染）+ CSS 动画（资源预测、震动、进度条等）
- 状态层: 基于 TypeScript 类的可变状态容器 `GameState`（位于 `src/game/state.ts`）

为什么是这套方案：

- UI 面板开发效率高，适合构建文字冒险游戏复杂的信息密度展示
- Canvas 独立演进作为氛围烘托层，能够很好地表达像素风的结晶动效、天气粒子
- 通过 React 的声明式 UI，可以很方便地加入“资源变更预测”、“伤害飘字”等现代 Roguelike 的视觉体验

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

### 运行测试

```bash
npm run test
```

### 生产构建与预览

```bash
npm run build
npm run preview
```

## 3. 当前项目文件架构

```text
.
├─ dist/                        # 构建产物（可删除后重新 build）
├─ docs/
│  └─ guide.md                  # 游戏功能概要与核心玩法文档
├─ src/
│  ├─ animations/               # 动画与特效逻辑模块
│  │  ├─ combatAnimation.ts     # 针对战斗动画（震动、受伤特效等）
│  │  └─ roomAnimation.ts       # 针对页面转场、进入房间相关的过场特效
│  ├─ components/
│  │  └─ GameCanvas.tsx         # Canvas 动效层（基于传入事件渲染像素风动态背景）
│  ├─ game/
│  │  ├─ constants.ts           # 玩法常量（楼层、角色、房间权重、经济与伤害数值等）
│  │  ├─ state.ts               # 核心规则与状态管理（GameState，处理所有的探险/战斗逻辑）
│  │  ├─ state.spec.ts          # 核心逻辑单元自动化测试
│  │  └─ types.ts               # 领域类型定义（Player/Dungeon/Combat/RoomEvent 等定义）
│  ├─ App.tsx                   # 页面主容器、状态驱动的 React 组件渲染、资源消费预测 UI 与交互入口
│  ├─ main.tsx                  # React 挂载入口
│  └─ styles.css                # 全局样式与布局（包含所有的 CSS 动画与像素风格变量）
├─ index.html                   # Vite HTML 入口
├─ package.json                 # 脚本与依赖
├─ package-lock.json            # 锁定依赖版本
├─ tsconfig.json                # TS 编译配置
└─ vite.config.ts               # Vite 配置
```

## 4. 模块职责说明

### 4.1 `src/App.tsx`

负责“前端表现层 + 流程编排 + UI 反馈”。

- 管理当前游戏阶段 `stage`（menu / character / explore / event / combat）
- 调用 `gameState` 完成流程推进
- 组合左侧（地图、画布面板、操作按钮与操作记录）和右侧（各项状态与资源）的双栏 UI
- 提供极具现代感的**资源获取/消耗预测**反馈（当鼠标悬停按钮时，预测生命、金币、属性的变化区间）

建议后续演进：

- 将 `stage` 迁移到状态机或 Reducer
- 将冗长复杂的 UI 组件进一步拆分为独立面板（如：日志面板、地图面板、资源栈面板）

### 4.2 `src/game/state.ts` (GameState)

负责“规则层 + 状态层”。

主要能力：

- 游戏初始化、角色选择及特殊职业被动初始化
- 地牢地图生成（带有连线逻辑与随机分支算法）
- 房间推进以及丰富的非战斗事件解析（商店、宝箱、矿洞、篝火、铸锻间、雕像、陷阱、分叉口等）
- 战斗循环处理（普通攻击、暴击、技能、卷轴等）
- 结算与状态机记录（食物恢复、饥饿扣血、经验升级等）
- 系统、战斗、资源变更的细粒度日志分发

注意：当前使用原型版本可变 `snapshot`。这种方式修改简便，通过外层 `refresh` 驱动 React 重渲染。若状态复杂度进一步增加，建议引入不可变更新（如 Zustand 或 Immer）。

### 4.3 `src/components/GameCanvas.tsx` & `src/animations`

负责“视觉动效层”。

- 结合 `requestAnimationFrame` 驱动纯 Canvas 粒子动效（如中心结晶体呼吸、危险等级氛围颜色等）。
- 通过从 `App.tsx` 传递的 `triggerKey`，触发战斗伤害的屏幕震动、资源变化的粒子脉冲（`combatAnimation` / `roomAnimation`）。
- 保持接口黑盒化，可随时重构内部渲染引擎。

- 房间和动画的对应关系如下：

    | 房间名 | 事件类型 | 进房形态 |
    | --- | --- | --- |
    | 怪物 | monster_event | beam |
    | 宝箱 | chest_event | diamond |
    | 陷阱 | trap_event | beam |
    | 商人 | shop_event | shop_forge |
    | 篝火 | bonfire_event | branch_bonfire |
    | 铸锻 | forge_event | shop_forge |
    | 雕像 | statue_event | halo |
    | 矿洞 | mine_event | diamond |
    | BOSS | boss_event | boss_sigil |
    | 分叉口 | branch_event | branch_bonfire |

### 4.4 `src/styles.css`

负责视觉基调与响应式布局：

- 基于 CSS Grid 与 Flexbox 的双栏信息流布局
- 像素风画布样式适配（`image-rendering: pixelated`）
- 各类复杂的 UI 动效（`consume-pulse`, `delta-up`, `btn-exit-fall` 等提示资源变化或场景切换）
- 移动端单列优雅降级

## 5. 核心游戏循环

1. **菜单阶段 (menu)**：点击开始冒险，展示开场特效。
2. **角色阶段 (character)**：系统随机抽取 3 名职业，玩家预览属性与技能后确定角色。
3. **探索阶段 (explore)**：按照地图楼层前行，可以预览未来的路线分支或房间类型。
4. **事件阶段 (event)**：进入特殊功能房间（如与商人交易买卖、开启宝箱、在营地烹饪/打磨武器、雕像祈祷等），部分事件可能导致进入战斗。
5. **战斗阶段 (combat)**：遭遇怪物或 Boss，运用普通攻击、暴击、职业技能和魔法卷轴进行战斗。
6. **结算返回**：战斗胜利或离开房间后进行通用结算（食物消耗/饥饿扣血，经验计算，升级等），随后可进入下一房间。击败深层 Boss 即宣告胜利。

## 6. 开发规范建议

### 6.1 目录与命名

- React 组件文件: PascalCase（如 `GameCanvas.tsx`）
- 逻辑脚本文件: camelCase / 小写语义（如 `state.ts`, `combatAnimation.ts`）
- TypeScript 类型定义归拢到 `src/game/types.ts`，避免散落

### 6.2 代码约束

- TypeScript `strict` 模式已开启，新提交须保持 0 类型错误
- 尽量避免在 React 渲染函数中堆砌过重的领域业务逻辑
- 游戏规则与数值逻辑优先内聚在 `src/game/` 目录下

### 6.3 状态变更原则

- 表现层（UI）只通过触发 Action/Method 更新状态，不应直接修改 `snapshot` 对象内部字段
- 通过 `gameState.addLog` 统一写入系统日志及战斗/资源日志记录，便于 UI 侧按类别分组呈现

## 7. 后续重构与演进路线图（建议）

### 阶段 B: 架构解耦与维护性优化（当前推荐）

- [ ] **组件化拆分**：当前 `App.tsx` 承担了过多组件渲染与交互绑定，建议切分为 `SidebarPanel`, `MapPanel`, `ActionBoard`, `LogViewer` 等。
- [ ] **状态重构**：引入状态机（如 XState）或者精简版 Context / Reducer，梳理 `stage`（阶段流转）使得组件之间的边界更加清晰。
- [ ] **完善测试**：扩大 Vitest 在核心路径（如房间结算、复杂事件奖励）的测试覆盖率。

### 阶段 C: 视觉与表现升级

- [ ] 将纯 Canvas 原生粒子替换为功能更强大的 PixiJS（按需可选）。
- [ ] 增加游戏音效（BGM / 按键 / 受击 / 获得金币等反馈声音）。
- [ ] 拓展更多职业像素角色形象、独立动画。

## 8. 维护者备注

如果你是新加入项目的开发者，建议按以下顺序阅读源码：

1. `src/game/constants.ts` (了解游戏的世界观设定、数值边界与奖励权重)
2. `src/game/types.ts` (了解核心领域模型数据结构)
3. `src/game/state.ts` (了解事件流转、地图生成算法和战斗判定)
4. `src/App.tsx` (了解前端是如何挂载并展示上述数据的)
5. `src/styles.css` & `src/animations/` (了解资源变化反馈和特效实现的原理)

阅读完成后再动手开发新功能模块或重构组件，能够事半功倍。
