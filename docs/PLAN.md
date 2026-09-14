# 《重生末日之前》开发计划

> 给 Codex 和 Claude 共同看的执行计划。机制见 [DESIGN.md](./DESIGN.md)，协作规则见根目录 [AGENTS.md](../AGENTS.md)。
> 当前目标：**先把「序章 4 周 + 末日第 1 年」做成可玩版本**（设计稿 v0.3）。

## 分工

| 谁 | 负责 | 不碰 |
|---|---|---|
| **Codex**（先上） | `src/ui/` 全部界面与视觉、`src/content/` 批量内容填充、样式动效、移动端适配 | `src/engine/types.ts` 的接口形状、`src/engine/impl/` |
| **Claude**（后上） | `src/engine/impl/` 引擎实现与单元测试、平衡模拟脚本、代码评审、逻辑优化 | `src/ui/` 的视觉决策 |
| **你** | 拍板、把任务 ID 分给 Codex、验收 | |

接口契约：`src/engine/types.ts` + `src/engine/api.ts`。**UI 只读 `GameState`、只调 `GameEngine` 的方法**。引擎已实现在 `src/engine/impl/`，UI 通过 `src/ui/store.ts` 的 `engine` 单例调用。

常用命令：`npm run dev` 本地玩；`npm test` 单测 + 内容校验；`npm run sim 500` 机器人跑 500 局看通关率；`node scripts/e2e.mjs` 无头浏览器走一遍流程（需先 `npm run build && npx vite preview --port 4173`）。

## 里程碑

| 阶段 | 内容 | 谁 | 验收 |
|---|---|---|---|
| **M0 契约** ✅ | 设计文档、类型契约、i18n 骨架、样例内容、脚手架 | Claude | `npm run build && npm test` 通过 |
| **M1 引擎** ✅ | `GameEngine` 全部方法：事件抽牌、检定、危机结算、过期、生产、派工、掉落、随机幸存者、忠诚、好感、建造、交易、异能、暴露、结局、重生点；seeded RNG；单测；模拟器 | Claude | `npm test` 全绿；`npm run sim` 能跑完 52 回合 |
| **M2 朴素可玩 UI** ✅ | 开局 / 地图 / 事件放卡 / 基地 / 仓库与商店 / 人物与派工 / 日记 / 周结算 / 结局 / 重生点商店 / 存档 / PWA，对真引擎 | Claude | 浏览器 e2e 脚本走通一周 |
| **M3 UI 视觉优化** | 在真引擎和真内容上重做视觉：地图布局、卡面、拖拽放卡、动效、移动端手感 | Codex | 手机上顺手；不改引擎 |
| **M4 内容** | 事件扩到 120 / 男主线每人 10 / 物资 50 / 装备 20 / 文案润色 | Codex（主）+ Claude（审） | `npm test` 内容校验通过 |
| **M5 平衡** | `npm run sim` 跑 1000 局调数值；多周目手感 | Claude | 认真玩的通关率 40~60%，三条男主线都能走到底 |
| **M6 发布** | GitHub Pages 上线；5 人试玩；Tauri 桌面包（可选） | 两人 | 手机能玩 |
| **之后** | 第 2~10 年逐年加系统 | | |

## 任务清单（`docs/tasks/`）

| ID | 标题 | 谁 | 状态 |
|---|---|---|---|
| T-001 | 项目脚手架与契约 | Claude | ✅ |
| T-006 | 引擎实现 + 单测 + 模拟器 | Claude | ✅ |
| T-007 | 内容校验（`src/content/content.test.ts`） | Claude | ✅ |
| T-009 | 存档 / 重生点商店 / PWA | Claude | ✅ |
| T-011 | 朴素可玩 UI（`src/ui/`） | Claude | ✅ |
| **T-002** | **UI 视觉优化**（在 T-011 基础上重做视觉，不改引擎） | Codex | 待领 |
| T-003 | 物资扩到 50 / 装备 20 / 词缀 8 / 危机文案润色 | Codex | 待领 |
| T-004 | 事件扩到 120（现有 45）+ 掉落表补全 + 幸存者特质 15 | Codex | 待领 |
| T-005 | 男主线每人扩到 10（现有顾沉 4 / 沈砚 4 / 谢临 4 / 江野 2 / 阿寂 1） | Codex | 待领 |
| T-008 | 平衡调数值（当前机器人通关率约 16%） | Claude | 待 T-004 后 |
| T-010 | GitHub Pages 上线检查 + Tauri 桌面包 | Codex | 待 M3 后 |

## 目录约定

```
src/
  engine/
    types.ts      契约（改前先改 DESIGN.md）
    api.ts        GameEngine 接口 + 时间工具
    impl/         真引擎（Claude 写）：rng / content / helpers / conditions / effects / events / crisis / week / engine / sim
  content/
    locations.ts npcs.ts memories.ts cards.ts bases.ts factions.ts pets.ts powers.ts endings.ts
    events/       按地点分文件：home.ts office.ts ... story_guchen.ts ...
    index.ts      组装 ContentPack
  ui/             页面与组件（Claude 写了朴素版，Codex 做视觉）
  i18n/           zh.ts（en.ts 之后加）
  save/           localStorage 存档
docs/
  DESIGN.md  PLAN.md  tasks/T-xxx.md
```
