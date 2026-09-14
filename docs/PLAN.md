# 《重生末日之前》开发计划

> 给 Codex 和 Claude 共同看的执行计划。机制见 [DESIGN.md](./DESIGN.md)，协作规则见根目录 [AGENTS.md](../AGENTS.md)。
> 当前目标：**先把第 1 年做成可玩版本**。

## 分工

| 谁 | 负责 | 不碰 |
|---|---|---|
| **Codex**（先上） | `src/ui/` 全部界面与视觉、`src/content/` 批量内容填充、样式动效、移动端适配 | `src/engine/types.ts` 的接口形状、`src/engine/impl/` |
| **Claude**（后上） | `src/engine/impl/` 引擎实现与单元测试、平衡模拟脚本、代码评审、逻辑优化 | `src/ui/` 的视觉决策 |
| **你** | 拍板、把任务 ID 分给 Codex、验收 | |

接口契约：`src/engine/types.ts` + `src/engine/api.ts`。**UI 只读 `GameState`、只调 `GameEngine` 的方法**。引擎实现没到位之前，UI 用 `src/engine/mock.ts`（Codex 自己写一个返回固定状态的 mock engine，T-002）。

## 里程碑

| 阶段 | 内容 | 谁 | 验收 |
|---|---|---|---|
| **M0 契约** ✅ | 设计文档、类型契约、i18n 骨架、样例内容、脚手架 | Claude | `npm run build && npm test` 通过 |
| **M1 UI 骨架** | 地图 / 事件弹窗 / 卡槽放卡 / 仓库 / 人物 / 危机面板 / 周结算 / 日记，全部对 mock engine | Codex | 用 mock 数据能把一周的操作流走完 |
| **M2 引擎** | `GameEngine` 全部方法 + 检定 + 危机结算 + 过期 + 通胀 + 好感 + 结局；seeded RNG；单测 | Claude | `npm test` 全绿；命令行模拟能跑完 48 周 |
| **M3 内容** | 80 事件 / 40 物资 / 16 危机 / 3 条恋爱线 / 6 结局 / 12 条记忆文案 | Codex（主）+ Claude（审） | 内容校验脚本通过；能从 1 月玩到 12 月 |
| **M4 手感与平衡** | 自动跑 1000 局调数值；存档；多周目；过场；音效占位 | Claude（平衡）+ Codex（表现） | 通关率 30~50%，三条恋爱线都能走到底 |
| **M5 发布** | GitHub Pages + PWA；5 人试玩 | 两人 | 手机能玩 |
| **之后** | 第 2~10 年逐年加系统 | | |

## 任务清单（`docs/tasks/`）

| ID | 标题 | 谁 | 状态 |
|---|---|---|---|
| T-001 | 项目脚手架与契约 | Claude | ✅ 完成 |
| T-002 | UI 骨架 + mock engine | Codex | 待领 |
| T-003 | 40 种物资卡 + 16 张危机卡内容 | Codex | 待领 |
| T-004 | 80 个事件内容（按地点分文件） | Codex | 待领 |
| T-005 | 3 条恋爱线各 8 个事件 | Codex | 待领 |
| T-006 | 引擎实现 + 单测 | Claude | 待 T-002 后 |
| T-007 | 内容校验脚本（id 引用、条件合法、每月事件数量） | Claude | 待 T-003/004 后 |
| T-008 | 平衡模拟器（自动策略跑 N 局） | Claude | 待 T-006 后 |
| T-009 | 存档 / 多周目 / 记忆碎片 | Claude | 待 T-006 后 |
| T-010 | GitHub Pages 部署 + PWA | Codex | 待 M1 后 |

## 目录约定

```
src/
  engine/
    types.ts      契约（改前先改 DESIGN.md）
    api.ts        GameEngine 接口 + 时间工具
    mock.ts       UI 开发用假引擎（Codex 写）
    impl/         真引擎（Claude 写）
  content/
    locations.ts  npcs.ts  memories.ts  cards.ts  endings.ts
    events/       按地点分文件：home.ts office.ts supermarket.ts ...
    index.ts      组装 ContentPack
  ui/             页面与组件（Codex）
  i18n/           zh.ts（en.ts 之后加）
  save/           localStorage 存档
docs/
  DESIGN.md  PLAN.md  tasks/T-xxx.md
```
