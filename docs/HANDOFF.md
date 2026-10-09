# 交接说明（2026-10-09）

给接手的 Claude 会话看。先读完这份，再读 `AGENTS.md`、`docs/DESIGN.md`、`docs/PLAN.md`。
上一个会话跑在云端容器里，访问不了小红书，也连不上用户的 Chrome，所以把小红书调研交给你。

## 1. 项目、分支和发布

- 仓库：`sheissolazy/rebirth-before-the-end`。React 19 + Vite 8 + TypeScript + Tailwind v4 + Vitest，纯静态，PWA 离线可玩，部署在 GitHub Pages。
- 三个分支各有一个网址，存档互不影响：

| 分支 | 网址 | 存档前缀 | 现状 |
|---|---|---|---|
| `main` | https://sheissolazy.github.io/rebirth-before-the-end/ | `rbte` | 稳定版，停在部署脚本那次提交 |
| `dev` | https://sheissolazy.github.io/rebirth-before-the-end/dev/ | `rbte-dev` | **用户正在测这个，不要动** |
| `next` | https://sheissolazy.github.io/rebirth-before-the-end/next/ | `rbte-next` | 最新改动都在这里，比 `dev` 多 7 个提交 |

- **测试规则：用户说她在测哪个网址，就改另一个。** 现在她测 `/dev/`，所以新改动进 `next`。她说换着测时，再按她说的把一个分支拷到另一个。
- 部署：`github-pages` 环境只允许 `main` 部署。推到 `next` 或 `dev` 时，`.github/workflows/trigger-deploy.yml` 会去触发 `main` 上的 `deploy.yml`，它一次构建三个分支。推完等部署跑完再告诉用户。
- Git 身份必须用 `sheissolazy` / `27716237+sheissolazy@users.noreply.github.com`。用她的 gmail 会显示成另一个 GitHub 账号，她不想要。
- 每次提交前的验证：

```bash
npm run build                       # tsc + vite build
npx vitest run                      # 26 个引擎测试 + 内容校验
npx tsx scripts/sim.ts              # 200 局机器人，看 survivedYear
npx tsx scripts/trace.ts sim-2      # 逐周追踪一局，找死因
(npx vite preview --port 4173 --strictPort > /dev/null 2>&1 &) ; sleep 3; node scripts/e2e.mjs
fuser -k 4173/tcp                   # 关预览；别用 pkill -f，会把自己的命令也杀掉
```

## 2. 文字版现状（`next` 分支）

- 玩法骨架：序章 4 周囤货赚钱，末日后按周推进，每月一张危机卡，四档稀有度 普通/优良/稀有/传说（白/绿/蓝/金），三属性 体力/头脑/魅力，掷骰检定。
- 已有系统：精力、突发选择、开局特质、父母队友、网购（下周到、可全额退款、放不下进快递站）、四种基地和各自模块、食物和水按份计、保质期和冷藏、伙伴派工、5 位男主、好感跨档只靠剧情事件、势力交易、状态（低调/禁足/被盯上/军区看护）、撤回和重开、重生点商店。
- `next` 比 `dev` 多的 7 个提交：麻烦卡末日消失、别墅和自建房按"越贵越好"重定、出租屋客厅通铺、势力汇率、网购退款和快递站、好感跨档只靠剧情、状态系统让弹窗后果真的生效、同类物品堆叠、江边打水、人物稀有度决定属性上限和成长速度、掉落表按地点按现实、水的产出和消耗重算、伙伴页列出在基地的男主。
- 最近一次 200 局机器人模拟：一年存活率 88%。

## 3. 用户反复强调的原则

- **逻辑和真实感第一。** 弹窗和选项说了什么后果，引擎里就必须真的发生。比如"一个月不能交易"，交易按钮和交易事件就要真的消失。
- **越贵越好。** 同一维度上贵的东西不能比便宜的差。颜色就是能力：稀有度越高越强，男主成长比普通人快。
- **每个操作都要有反馈和引导。** 告诉玩家变了什么、为什么。日记必须和真实状态一致。
- **按真实世界来。** 超市出吃的，加油站出油和零食，水要算得过来账。
- **先查证再回答。** 技术问题先搜索验证，不确定就直说不确定。
- 先做中文，文案用 `LocalizedText { zh, en? }`。

## 4. 还没拍板的旧问题

- 霰弹枪要不要弹药机制。
- 猫有没有独立作用。
- 使用空间异能要不要加暴露。
- 辞职和被裁的赔偿逻辑要反过来：被裁才拿赔偿。

## 5. 新方向：从文字卡牌升级到 2.5D（只讨论，还没写代码）

**用户的想法，按时间顺序：**
1. 不满足于文字游戏，想要饥荒那样的感觉。
2. 改为参考《生存日志》（Survival Log，Midnight Workshop 开发，莉莉丝发行，Steam app 4164790）。
3. 不是单人存活：女主最多带 2 个队友共同生活，也从末日前开始。
4. 真 3D 会晕，2.5D 可以。

**《生存日志》已查到的特点**（来自搜索摘要，没打开原页面）：重生预知末日、灾前在超市/工具店/农贸市场囤货、自己设计安全屋并逐层扩建、灾后管水粮电和精神状态、柴油/手摇/太阳能供电、救邻居、用无人机和幸存者交易。Steam 标签写的是 2.5D 和第三人称，开发者披露部分 2D 美术由 AI 生成。

**上一个会话的分析和建议：**
- 视角两种：斜 45° 俯视（像饥荒、模拟人生）和侧面剖面（像《这是我的战争》、辐射避难所）。建议斜 45°。两种都是固定镜头，不会转。样张见 `docs/prototypes/safehouse-styles.html`，用浏览器打开；它全部由代码绘制，没有图片文件。用户也有这页的在线版本：https://claude.ai/artifact/9KG2xuY4rD4sEgpNpxVinj
- 技术：建议在现有 Vite + TypeScript 项目里加 Phaser 4，菜单和对话继续用 React 叠在上面，PWA 和部署不变。2026-10-09 查 npm，phaser 是 4.2.1。Godot 4 网页导出也支持离线 PWA，但等于全部重写，而且 C# 项目不能导出网页。
- 能复用：物品、稀有度、掉落表、人物、男主剧情、势力、危机、状态的数据，存档和部署。要重写：周回合和掷骰变成实时钟点（可暂停、可倍速），基地模块列表变成在房间网格里摆家具，地点列表以后变成能走进去的场景。
- 三人小队：每个人像模拟人生一样有饥饿、口渴、困倦、情绪和作息。建议男主和爸妈抢这 2 个名额，没住进来的人留在各自的地方，上门去找。现在的人口上限和伙伴派工去掉。
- 美术：Claude 不能直接生成图片，只能写代码来画。三条路：代码画的几何扁平风、用户用生图工具出图再由 Claude 接进游戏、素材包（例如 Kenney 的 CC0 包）。Blender 建模再渲染成 2.5D 图是第四条路，还没调研。

**等用户拍板的 4 件事：**
1. 视角选斜 45° 还是侧面剖面。
2. 两个队友名额谁能占，爸妈算不算。
3. 加不加精神值。`AGENTS.md` 铁律 6 写的是"没有心态值"，要加就先改规则。
4. 美术先用代码画，还是用生图工具。

**拍板后的第一步：** 新开一个分支做原型，部署到单独网址，要在 `deploy.yml` 里加一个路径和存档前缀，不能影响 `/dev/` 和 `/next/`。原型内容是：出租屋一层，三个人能点选指挥吃喝睡和摆家具，带倍速的时钟，再加一晚丧尸撞门，搜刮结果接回现有的结算。

## 6. 交给你的任务：小红书调研

- 用户要你学习小红书上大约 60 个"用最新 Claude 模型做游戏"的帖子。她举的例子是一篇用 Unity 和 Blender MCP 做小型钓鱼游戏的帖子。
- 用 Claude in Chrome，她的 Chrome 已经登录小红书。按 xhs-video 技能的步骤：在 xiaohongshu.com 上搜索，读帖子和评论，视频用它的脚本批量转文字。**只用小红书，不要换别的平台。**
- 产出写到 `docs/research/xhs-ai-gamedev.md`：
  - 每个帖子一行：标题、作者、链接、日期、做了什么游戏、用了什么工具和 MCP、美术从哪来、花了多久、踩了什么坑。
  - 再归纳：常见工作流、美术方案、做不到的地方，以及对我们这个 2.5D 三人小队末日游戏的启示。
- 写完和用户接着讨论第 5 节那 4 件事。

## 7. 上一个会话没做的事

- 小红书调研没做，原因见开头。
- 其它平台的调研按用户要求停掉了，没有留下结果。

## 8. 2026-10-08 本地会话（囤囤）进展

- 小红书调研已完成：`docs/research/xhs-ai-gamedev.md`（共 78 篇）。
- 2.5D 方向的讨论结论写在 `docs/DESIGN-2.5D.md`：three.js；屋里固定 45°、屋外像海岛钓鱼游戏那样跟拍；"家"是一层层的地盘；第一版只做小别墅；美术只用代码 + Blender + 免费素材；卡牌换成日记、地图、对话框。
- 还有 11 个问题等用户回答，见 `DESIGN-2.5D.md` §2。前 5 题答完后，开 `proto-2.5d` 分支做原型。

## 9. 2026-10-09 夜里（囤囤一个人做）：2.5D 原型做到能玩

- 分支 `proto-2.5d` → https://sheissolazy.github.io/rebirth-before-the-end/proto/ 。每一步做了什么、为什么、怎么验证的，按时间记在 `docs/DEVLOG.md`（开头有"早上先看这里"的总结和"下一步"）。
- 代码地图（`src/world/`）：
  - `life.ts` 时钟/需求/自主决策（纯函数）· `residents.ts` 一家人（Actor、Household：任务、出门、访客、丧尸夜调度、种田、空间、存货、男主送东西 `giveCare`/`courierTick`、借人给顾沉 `lent`、生死 `die`/`over`、钉板 `trap`、弩 `crossbow`/`equipCrossbow`、男主住下来 `jiangyeHome`/`shenyanHome`、困难模式 `hard`、末日降临 `onDoomsday`）· `walker.ts` 走路
  - `people.ts` MakeHuman 人物加载 + 代码摆骨骼（PoseDriver）+ **衣服贴图修改 `WARDROBE`**（盖掉 MakeHuman 标志、换上衣颜色、改发色）
  - `siege.ts` 丧尸夜的逻辑（防线、守位、武器、燃烧瓶、钉板 `TRAP`、危机夜大块头、街上遇袭）· `siegeView.ts` 丧尸夜的画面（模型、特效、血条、铁门/大门）
  - `visitors.ts` 来敲门的人（`VISITORS` 表）+ 送东西的男主（`Courier`）· `expedition.ts` 地图出门 · `scavenge.ts` 街上搜东西 · `weather.ts` 下雨 · `daylight.ts` 昼夜 · `sound.ts` 合成音效和音乐 · `bubbles.ts` 想法泡泡 · `save.ts` 自动存档 + 第几世 / 重生点 / 开局加成（`currentLife`、`awardRebirthPoints`、`PERK_DEFS`、`applyPerks`）
  - `World.ts` 把以上接到 three.js 场景、镜头、输入、HUD 数据 · `WorldView.tsx` / `DiaryPanel.tsx` / `MapPanel.tsx` 界面
- 3D 里的台词和数据尽量直接读文字版 `src/content/`（memories、locations、npcs、events），没在 3D 里另写一套世界观。
- 测试：`npx vitest run src/world`（110 个，含不渲染跑 10 天 / 30 天的长跑测试）。改了逻辑先跑这个。
- 人物：`tools/blender/make_people.py` 用 MakeHuman 生成（`blender --background --factory-startup --python tools/blender/make_people.py -- x.zip <out> 名字...`；资源包已经装进 MPFB，zip 路径随便填）。现在有 13 个：女主、爸妈、王阿姨、陌生人、两个幸存者、江野、沈砚、顾沉、谢临、两种丧尸。
- 面板藏着时看画面：`tools/preview/devserve.py`（静态文件 + 收截图）+ `tools/preview/shot.js`（页面里的 `__ff` 快进、`__shot` 离屏截图），详见 `~/Documents/MyGames/KNOWLEDGE.md`"面板藏着也能看画面"。
- 预览面板读不了 `~/Documents`：用 `VITE_SAVE_PREFIX=rbte-proto npx vite build --outDir <scratchpad>/proto-dist` 再用 python http.server 看；页面带 `?debug` 时可以在控制台用 `window.__world`。
- 还没做、等用户拍板的见 `docs/DEVLOG.md` 文末"下一步"。
