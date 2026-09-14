# AGENTS.md — 给 Codex（以及任何 AI 协作者）的项目说明

这是一个卡牌叙事策略游戏《重生末日之前》：女主重生到丧尸末日前 4 周，囤货、建基地、打丧尸、种田、谈恋爱。机制文档 `docs/DESIGN.md`，计划与分工 `docs/PLAN.md`，任务在 `docs/tasks/`。

## 技术栈
React 19 + Vite + TypeScript + Tailwind v4 + Vitest。纯静态，部署 GitHub Pages，必须在手机（~400px 宽）上可玩。

## 命令
```bash
npm install
npm run dev        # 本地玩
npm run build      # tsc -b && vite build（提交前必须通过）
npm test           # 引擎单测 + 内容校验（提交前必须通过）
npm run sim 500    # 机器人跑 500 局，看通关率和死亡分布
node scripts/e2e.mjs   # 无头浏览器走一周（先 npm run build && npx vite preview --port 4173）
```

## 现状（给新来的协作者）
- 引擎 `src/engine/impl/` 已完成并有测试；UI `src/ui/` 有一套朴素但能玩通的版本；内容 `src/content/` 有 45 个事件、40+ 张卡、20 张危机卡、3 条男主线各 4 段。
- Codex 当前任务：`docs/tasks/T-002.md`（视觉优化）、T-003/004/005（内容扩充）。

## 铁律
1. **接口契约在 `src/engine/types.ts` 和 `src/engine/api.ts`。** UI 只读 `GameState`，只通过 `GameEngine` 方法改状态。需要改契约：先改 `docs/DESIGN.md` 对应小节，再改类型，并在提交信息里写 `contract:` 前缀。
2. **不要在 `src/ui/` 里写游戏规则**（检定、结算、好感计算都在引擎）。UI 发现规则缺失就在 `docs/tasks/` 开一个任务给 Claude。
3. **所有玩家可见文字**：内容文案用 `LocalizedText { zh, en? }`，UI 字符串用 `src/i18n/zh.ts` + `t('key')`。不要在 JSX 里写死中文。
4. **内容文件是纯数据**，不含逻辑；id 命名：事件 `ev_<地点>_<slug>`（男主线 `ev_<npc>_<序号>`），物资 `supply_<slug>`，装备 `equip_<slug>`，晶核 `core_<rarity>`，技能 `skill_<owner>_<slug>`，危机 `crisis_<kind>_<rarity>`，模块 `<baseType缩写>_<slug>`。
5. **稀有度四档**统一叫 普通(common,白) / 优良(fine,绿) / 稀有(rare,蓝) / 传说(legendary,金)。**不要**出现"石/铜/银/金"。
6. **没有心态值。** 人物只有 三属性(体力/头脑/魅力) + 健康/忠诚/好感。别加新数值，需要就开任务讨论。
7. `tsconfig` 开了 `erasableSyntaxOnly`：不要用 `enum`、参数属性（`constructor(public x)`）、namespace。
8. 提交前 `npm run build && npm test` 必须通过。一个任务一个分支 `codex/T-xxx-slug`，PR 到 `main`。
9. 完成任务后把 `docs/tasks/T-xxx.md` 顶部状态改成 `done`，并在 `docs/PLAN.md` 任务表里勾掉。

## 视觉方向（Codex 主导，这里只给约束）
- 移动优先，深色为主，末日日记感；卡牌四档稀有度颜色：白 / 绿 / 蓝 / 金。
- 首版用 emoji 当卡面图标（`icon` 字段），之后可换图片。
- 地图页是主界面：地点按 `LocationDef.pos` 摆放，点开地点出事件列表，点开事件出卡槽面板（拖拽或点选放卡）。
- 地图分两层：序章城市地图 / 末日后"基地内 + 外出"。
- 顶部常驻：时间（序章倒数 / 末日后年月周）、存款或晶核、健康、暴露、基地防御、本月危机进度条（"需要 X 分 / 现有 Y 分"）。

## 目录
见 `docs/PLAN.md` 的"目录约定"。
