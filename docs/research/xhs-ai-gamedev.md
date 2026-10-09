# 小红书调研：别人怎么用最新 AI 做游戏（2026-10-08）

> 调研人：囤囤（Claude Code 本地会话）。只用小红书，通过 Claude in Chrome 读帖子正文和评论。视频先用 xhs-video 脚本转文字；大多数游戏视频只有配乐没有解说，所以又用 ffmpeg 从每个视频均匀截 12 帧拼成一张图来看画面。
> 搜索词：Opus 5.5 做游戏 / Opus 5.5 有点疯狂 / Unity MCP / Blender MCP / Claude Code 做游戏 / Claude 独立游戏 / AI 做 2.5D 游戏 / Claude 钓鱼游戏。
> 一共收集了 285 篇候选帖，挑出 81 篇相关的读了正文和评论；52 个视频做了转文字和截帧。下表列出其中 78 篇。
> 链接说明：小红书的帖子直链要带一次性令牌，过期后会 404，所以下表链接都是"按标题搜索"，点开就能找到原帖。
> 帖子里的说法未必准确，搬运和夸张标题很多，下表的"坑/亮点"一栏会标出来。少数关键事实用网页搜索核实过，单独注明。

---

## 0. 五句话结论

1. **没有人是"一句话出游戏"。** 做出像样东西的人都是：先写清楚开发方案（目标、验收标准、禁止事项）→ AI 分块实现 → 人试玩 → 截图圈出问题丢回去 → 迭代几十到上百轮。爆火的"一个 prompt 做出 3A"，原作者其实先聊了 15 轮写成技术方案，又发了 100 多条指令。
2. **主流分工是"AI 当总导演，各工具各干一件事"。** Claude 或 Codex 写代码、调度工具；游戏跑在引擎或 three.js 里；单个 3D 资产交给 Tripo、Meshy、Hyper3D 这类 3D 生成工具；Blender MCP 负责清理和拼装；概念图和 2D 素材交给生图模型。
3. **美术是最大的短板。** Claude 不能直接出图。纯代码画只适合几何、低多边形或简笔风格。画面精致的作品，美术都来自外部生图、3D 生成或者现成素材包。
4. **引擎怎么选，评论区分歧很大。** Unity 的 MCP 最成熟，但网页包很重。Godot + MCP 被好几个人评为"和 AI 配合最好"。纯代码方案（three.js / Phaser / Babylon.js）放在网页上最轻；有一条 66 赞的热评说"编辑器反而降低 AI 效率，我转向纯代码引擎了"。
5. **常见的坑：** 额度烧得凶（有一片海花了 $1874，也有人一周额度用到 50%～100%）；搬运和 AI 视频冒充"游戏"；AI 对画面好不好看判断不准；生成的模型面数和贴图达不到游戏标准；音效、音乐模型的商用授权。

---

## 1. 逐帖记录

日期按 2026-10-08 换算（"5 天前"记为 10-03）。

### 1A. 用户点名的钓鱼游戏，以及其他高完成度 3D 作品

| # | 帖子 | 作者 | 日期 | 做了什么 | 工具 / MCP | 美术来源 | 用时 / 花费 | 坑 / 亮点 |
|---|---|---|---|---|---|---|---|---|
| 1 | [Opus 5.5 有点疯狂](https://www.xiaohongshu.com/search_result?keyword=Opus%205.5%20%E6%9C%89%E7%82%B9%E7%96%AF%E7%8B%82) | 庄先生 | 09-27 | **用户提到的那篇**：小型钓鱼游戏 | Unity + Blender MCP + Opus 5.5（最大设置） | 作者在 iPad 画角色草图，再找专业作品当配色参考，由 Claude 合成 | 3 天 | 评论说是从 X 搬运的。截帧看：固定的高角度俯视，3D 卡通低多边形，有岸边甩竿、鱼篓 1/8、鱼的长度重量卡片 |
| 2 | [Opus 5.5 每周使用率 100% 的样子](https://www.xiaohongshu.com/search_result?keyword=Opus%205.5%20%E6%AF%8F%E5%91%A8%E4%BD%BF%E7%94%A8%E7%8E%87%20100%25%20%E7%9A%84%E6%A0%B7%E5%AD%90)（无标题） | 庄先生 | 10-03 | 同一款钓鱼游戏的海岛、码头、小木屋、夜钓 | 作者称所有模型和动画都用 Blender MCP 做 | 同上 | Opus 周额度用到 100% | Steam 名 *I Just Wanted to Fish*，计划 2026 Q4 发售。评论质疑海浪用了现成库、整体像 UE5 风格化模板 |
| 3 | [花费4周时间，用AI制作的3D钓鱼小游戏](https://www.xiaohongshu.com/search_result?keyword=%E8%8A%B1%E8%B4%B94%E5%91%A8%E6%97%B6%E9%97%B4%EF%BC%8C%E7%94%A8AI%E5%88%B6%E4%BD%9C%E7%9A%843D%E9%92%93%E9%B1%BC%E5%B0%8F%E6%B8%B8%E6%88%8F) | Major G.Yuri | 09-05 | 3D 港口钓鱼 + 海图航行 | Claude Code + Godot（有 MCP）；Blender MCP + Tripo 3D | 图和纹理用 ChatGPT | 4 周，约 $300 | 原作者是 X 上的 @hakimieigbal。截帧里能看到游戏内的 DEV 调试面板，可以切时钟、画质、天气 |
| 4 | [给足预算做游戏！GPT6.1Sol能反杀Opus5.5吗](https://www.xiaohongshu.com/search_result?keyword=%E7%BB%99%E8%B6%B3%E9%A2%84%E7%AE%97%E5%81%9A%E6%B8%B8%E6%88%8F%EF%BC%81GPT6.1Sol%E8%83%BD%E5%8F%8D%E6%9D%80Opus5.5%E5%90%97) | 进化中的阿陈 | 10-04 | Opus 5.5 和 GPT-6.1 Sol 各给 $200，比做立方体重力射击和 F1 赛车 | Blender Python 脚本、Tripo（敌人）、Mixamo（动画）、Godot | 规则要求纯脚本建模 | Opus 用 1 个 agent 1.7 小时拼出街区，Sol 用 14 个 agent 跑了 13 小时 | **Opus 先做 85 个模块化零件，再像积木一样拼**；Sol 做的是一体成型的死模型，后期改不动。结论：便宜模型堆再多 agent 也追不上 |
| 5 | [一句话做不出好游戏！教你用 AI 搭建场景](https://www.xiaohongshu.com/search_result?keyword=%E4%B8%80%E5%8F%A5%E8%AF%9D%E5%81%9A%E4%B8%8D%E5%87%BA%E5%A5%BD%E6%B8%B8%E6%88%8F%EF%BC%81%E6%95%99%E4%BD%A0%E7%94%A8%20AI%20%E6%90%AD%E5%BB%BA%E5%9C%BA%E6%99%AF) | 进化中的阿陈 | 10-07 | 可交互的水上村落 | Tripo P2.0 + Opus 5.5 + GPT-6 Astra（画参考图）+ Godot | 先画三视图，再交给 Tripo 出 3D | Tripo 约 4160 点 | ★**5 条规矩**（见 §3.2）。同一套组件可以一键切成斜 45° 等距视角，人走进屋时屋顶自动隐藏 |
| 6 | [一个人4小时，用Claude搓了个游戏出来](https://www.xiaohongshu.com/search_result?keyword=%E4%B8%80%E4%B8%AA%E4%BA%BA4%E5%B0%8F%E6%97%B6%EF%BC%8C%E7%94%A8Claude%E6%90%93%E4%BA%86%E4%B8%AA%E6%B8%B8%E6%88%8F%E5%87%BA%E6%9D%A5) | 清露晨流间 | 10-08 | 3D 动作关卡 | Claude Code + UE5 + Blender 5.1 + Meshy MCP | Meshy 生成，Opus 导进 Blender 清理 | 4 小时，Max 周额度的 19% | 步骤：先让 Opus 想 5 个创意 → 告诉它你的显卡 → 每次只加一个功能 |
| 7 | [Opus 开发一个六边形岛屿建造游戏](https://www.xiaohongshu.com/search_result?keyword=Opus%20%E5%BC%80%E5%8F%91%E4%B8%80%E4%B8%AA%E5%85%AD%E8%BE%B9%E5%BD%A2%E5%B2%9B%E5%B1%BF%E5%BB%BA%E9%80%A0%E6%B8%B8%E6%88%8F) | 阳阳 | 10-08 | 六边形岛屿建造，底部有地形卡牌 | Opus 5.5 | GPT 出图 + Blender；山、林、石头是程序生成的 | — | ★截帧：斜俯视的 3D 小岛 + 底部手牌 + 左上角目标清单 + 昼夜和灯塔。**和我们"卡牌 + 2.5D"的组合最像** |
| 8 | [Opus 5.5 做的海岛，居然能开船出海](https://www.xiaohongshu.com/search_result?keyword=Opus%205.5%20%E5%81%9A%E7%9A%84%E6%B5%B7%E5%B2%9B%EF%BC%8C%E5%B1%85%E7%84%B6%E8%83%BD%E5%BC%80%E8%88%B9%E5%87%BA%E6%B5%B7) | 倒带协议 | 09-25 | 能逛的海岛：码头昼夜、开船、水下有鲸鱼 | Opus 5.5（原作者 @dangreenheck） | — | 8 小时，token 折合 $1874，另用了 $200 周计划的 59% | **贵**。好看，但只是能逛的原型 |
| 9 | [我目前见过Opus 5.5最好的作品](https://www.xiaohongshu.com/search_result?keyword=%E6%88%91%E7%9B%AE%E5%89%8D%E8%A7%81%E8%BF%87Opus%205.5%E6%9C%80%E5%A5%BD%E7%9A%84%E4%BD%9C%E5%93%81) | 我是个智能体 | 09-24 | 同上，那片 $1874 的海 | | | | |
| 10 | [有人用 Opus 5.5 在浏览器里复刻了蜘蛛侠](https://www.xiaohongshu.com/search_result?keyword=%E6%9C%89%E4%BA%BA%E7%94%A8%20Opus%205.5%20%E5%9C%A8%E6%B5%8F%E8%A7%88%E5%99%A8%E9%87%8C%E5%A4%8D%E5%88%BB%E4%BA%86%E8%9C%98%E8%9B%9B%E4%BE%A0) | 清露晨流间 | 09-27 | 浏览器里跑的蜘蛛侠，开源（spiderbench） | Opus 5.5 medium 档 + Blender + three.js | AI 生图做贴图 | 迭代了 3 版 | 作者自己说只是模型能力测试，不是在做游戏 |
| 11 | [用Opus 5.5做出了浏览器版蜘蛛侠](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Opus%205.5%E5%81%9A%E5%87%BA%E4%BA%86%E6%B5%8F%E8%A7%88%E5%99%A8%E7%89%88%E8%9C%98%E8%9B%9B%E4%BE%A0) | CyberNotes | 10-07 | 同上 | 城市和角色由 Claude 通过 Blender 生成 | | | |
| 12 | [我做了大宋GTA](https://www.xiaohongshu.com/search_result?keyword=%E6%88%91%E5%81%9A%E4%BA%86%E5%A4%A7%E5%AE%8BGTA) | Get到了桦 | 09-29 | 照着清明上河图做的开放世界 | Opus 5.5 + Blender + Unity 6 URP | 原画只有正面，AI 补出四视图，再进 Blender 建模 | — | 目标平台 Steam Deck。截帧里那段"原卷 → 参考 → 叠合 → 入城"的流程很清楚 |
| 13 | [用Opus5.5做了一款小小梦魇风格的微恐游戏](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Opus5.5%E5%81%9A%E4%BA%86%E4%B8%80%E6%AC%BE%E5%B0%8F%E5%B0%8F%E6%A2%A6%E9%AD%87%E9%A3%8E%E6%A0%BC%E7%9A%84%E5%BE%AE%E6%81%90%E6%B8%B8%E6%88%8F) | YJ | 09-28 | 微恐 3D | HTML + Three.js | 代码 | 5 小时额度用了约 50% | 评论吐槽"前摇太长" |
| 14 | [用Opus 5.5手搓游戏：斯普拉遁](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Opus%205.5%E6%89%8B%E6%90%93%E6%B8%B8%E6%88%8F%EF%BC%9A%E6%96%AF%E6%99%AE%E6%8B%89%E9%81%81) | 好物仔 | 09-25 | 喷射战士克隆（搬运 Jayden 的作品） | Opus 5.5，部署在 Vercel | | | 支持手柄，821 赞 |
| 15 | [让opus5.5参考茶杯头做的小游戏](https://www.xiaohongshu.com/search_result?keyword=%E8%AE%A9opus5.5%E5%8F%82%E8%80%83%E8%8C%B6%E6%9D%AF%E5%A4%B4%E5%81%9A%E7%9A%84%E5%B0%8F%E6%B8%B8%E6%88%8F) | KuKu | 10-01 | 2D 复古马戏团横版 boss 战 | Opus 5.5 | **用 image2.5 生图**（作者说代码画不到这么精细） | 约 10 小时，Pro 周额度的一半 | 宣传视频也是 Opus 录制、剪辑的 |
| 16 | [Opus 5.5 太强了，甚至宣传片比游戏先做出来](https://www.xiaohongshu.com/search_result?keyword=Opus%205.5%20%E5%A4%AA%E5%BC%BA%E4%BA%86%EF%BC%8C%E7%94%9A%E8%87%B3%E5%AE%A3%E4%BC%A0%E7%89%87%E6%AF%94%E6%B8%B8%E6%88%8F%E5%85%88%E5%81%9A%E5%87%BA%E6%9D%A5) | 政政猫 | 09-26 | 恐怖题材游戏 + 宣传片 | 纯 Claude 渲染，没有用 MCP | | 宣传片不到 5 小时额度的 2%；游戏不到 5 小时 | |
| 17 | [OP game](https://www.xiaohongshu.com/search_result?keyword=OP%20game) | FrankLee | 09-28 | three.js 动作 RPG，达到"能上 Steam 抢先体验"的水平 | Opus 调用 Gemini API 生图、配乐 | Gemini | 额外买了两次额度 | skill 都是自己写的。作者自己卡在第一个 boss |
| 18 | [opus5.5 2小时 紫禁城](https://www.xiaohongshu.com/search_result?keyword=opus5.5%202%E5%B0%8F%E6%97%B6%20%E7%B4%AB%E7%A6%81%E5%9F%8E) | 反向弯曲 | 10-07 | 紫禁城场景 | Opus | 专门搭了一套 ComfyUI 流程出参考图 | 2 小时 | 作者说细化很费事 |
| 19 | [opus只花了2小时做的游戏](https://www.xiaohongshu.com/search_result?keyword=opus%E5%8F%AA%E8%8A%B1%E4%BA%862%E5%B0%8F%E6%97%B6%E5%81%9A%E7%9A%84%E6%B8%B8%E6%88%8F) | yukki | 09-28 | 打字背单词，可以切昼夜、天气、季节 | Opus medium 档 | | 2 小时，周额度的 15% | |
| 20 | [自己做游戏玩 OPUS5.5](https://www.xiaohongshu.com/search_result?keyword=%E8%87%AA%E5%B7%B1%E5%81%9A%E6%B8%B8%E6%88%8F%E7%8E%A9%20OPUS5.5) | 硬核KK | 10-08 | 横版动作 + 先导片 | Opus 5.5 | 美术是自己做的 | 先导片 3 小时，第一关 6 小时 | |
| 21 | [Opus5.5三句话生成的游戏](https://www.xiaohongshu.com/search_result?keyword=Opus5.5%E4%B8%89%E5%8F%A5%E8%AF%9D%E7%94%9F%E6%88%90%E7%9A%84%E6%B8%B8%E6%88%8F) | 最牛美化包 | 10-08 | 3D 场景 | Opus | 让它自己去找人物素材和动作捕捉数据 | | 场景用的是别人现成的提示词 |
| 22 | [用Opus 5.5重做了之前用Fable做的游戏](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Opus%205.5%E9%87%8D%E5%81%9A%E4%BA%86%E4%B9%8B%E5%89%8D%E7%94%A8Fable%E5%81%9A%E7%9A%84%E6%B8%B8%E6%88%8F) | 鲨鱼恶魔哒 | 09-27 | 重做旧游戏 | Opus 5.5 | 美术直接用代码画，"多做几个风格让我选" | | 作者觉得 Opus 很会用代码画画 |
| 23 | [Opus 5.5 做游戏，确实把我看馋了](https://www.xiaohongshu.com/search_result?keyword=Opus%205.5%20%E5%81%9A%E6%B8%B8%E6%88%8F%EF%BC%8C%E7%A1%AE%E5%AE%9E%E6%8A%8A%E6%88%91%E7%9C%8B%E9%A6%8B%E4%BA%86) | 老Y折腾记 | 09-27 | 观感帖 | | | | 热评：直接生成整个场景细看很粗，只能单个资产做好再拼 |
| 24 | [一句话生成3D游戏场景 Opus5.5也强太多了](https://www.xiaohongshu.com/search_result?keyword=%E4%B8%80%E5%8F%A5%E8%AF%9D%E7%94%9F%E6%88%903D%E6%B8%B8%E6%88%8F%E5%9C%BA%E6%99%AF%20Opus5.5%E4%B9%9F%E5%BC%BA%E5%A4%AA%E5%A4%9A%E4%BA%86) | 老刘用AI做游戏 | 09-29 | 雨夜便利店微缩场景，对比 GPT-6 Sol | Opus 5.5 | | | 评论：斑马线方向全错 |
| 25 | [Claude 5.5 和 GPT-6 游戏差别不只在画面](https://www.xiaohongshu.com/search_result?keyword=Claude%205.5%20%E5%92%8C%20GPT-6%20%E6%B8%B8%E6%88%8F%E5%B7%AE%E5%88%AB%E4%B8%8D%E5%8F%AA%E5%9C%A8%E7%94%BB%E9%9D%A2) | 倒带协议 | 09-22 | 两个模型的录屏对比 | | | | Opus 偏电影感、镜头好看；GPT 的界面信息更完整、更像能直接玩 |
| 26 | [其实宝可梦就应该这样战斗](https://www.xiaohongshu.com/search_result?keyword=%E5%85%B6%E5%AE%9E%E5%AE%9D%E5%8F%AF%E6%A2%A6%E5%B0%B1%E5%BA%94%E8%AF%A5%E8%BF%99%E6%A0%B7%E6%88%98%E6%96%97) | Edward.D.叮叮叮小作坊 | 09-25 | 宝可梦式战斗 | | | | 搬运自 X @nagk01 |
| 27 | [刚发布的Claude Opus 5.5 一句话能做游戏](https://www.xiaohongshu.com/search_result?keyword=%E5%88%9A%E5%8F%91%E5%B8%83%E7%9A%84Claude%20Opus%205.5%20%E4%B8%80%E5%8F%A5%E8%AF%9D%E8%83%BD%E5%81%9A%E6%B8%B8%E6%88%8F) | Growmax AI | 09-23 | 写实山路漂移 | | | | 提到 Anthropic 官方做过单提示词游戏测试 |
| 28 | [Opus 5.5一句提示词直出3A大作](https://www.xiaohongshu.com/search_result?keyword=Opus%205.5%E4%B8%80%E5%8F%A5%E6%8F%90%E7%A4%BA%E8%AF%8D%E7%9B%B4%E5%87%BA3A%E5%A4%A7%E4%BD%9C) | 冰毛豆 | 10-04 | sakura fantasy（GitHub） | | | 周额度不到 40% | 标题夸张 |
| 29 | [当年用 Unity 折腾一天，Opus5.5一小时搞定](https://www.xiaohongshu.com/search_result?keyword=%E5%BD%93%E5%B9%B4%E7%94%A8%20Unity%20%E6%8A%98%E8%85%BE%E4%B8%80%E5%A4%A9%EF%BC%8COpus5.5%E4%B8%80%E5%B0%8F%E6%97%B6%E6%90%9E%E5%AE%9A) | 兔儿小爷 | 09-24 | 感想帖 | | 截图 + 提示词 | | |
| 30 | [像素游戏vlog 生活奇旅 EP01](https://www.xiaohongshu.com/search_result?keyword=%E5%83%8F%E7%B4%A0%E6%B8%B8%E6%88%8Fvlog%20%E7%94%9F%E6%B4%BB%E5%A5%87%E6%97%85%20EP01) | 回神的谟可 | 10-08 | 像素横版浮岛生活 | GPT-6 + Opus 5.5 | | | 生成音乐，灵感来自 Brian Eno |

### 1B. 同题材：末世、生存、小队

| # | 帖子 | 作者 | 日期 | 做了什么 | 工具 | 美术 | 用时 | 坑 / 亮点 |
|---|---|---|---|---|---|---|---|---|
| 31 | [用Claude Fable5，1小时做了款3D末世小游戏](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Claude%20Fable5%EF%BC%8C1%E5%B0%8F%E6%97%B6%E5%81%9A%E4%BA%86%E6%AC%BE3D%E6%9C%AB%E4%B8%96%E5%B0%8F%E6%B8%B8%E6%88%8F) | Mok2049 | 07-11 | ★**乐高风城市尸潮生存**：招募不同职业的幸存者组成小队，捡武器升级，打砖块巨像 boss，守住撤离点等直升机 | Claude Fable 5 | 代码画的积木风 | 1 小时 | 斜俯视。说明"末世 + 小队 + 俯视"这种原型一个小时就能出，**我们的差异化得靠系统深度，不能靠画面** |
| 32 | [Claude Code + Unity MCP 能做出游戏](https://www.xiaohongshu.com/search_result?keyword=Claude%20Code%20%2B%20Unity%20MCP%20%E8%83%BD%E5%81%9A%E5%87%BA%E6%B8%B8%E6%88%8F) | 神龟数字前沿 | 07-05 | 第一人称生存 demo | Claude Code + Unity MCP | 很多来自 Unity Asset Store 的现成包 | | 作者自己说不是"从零生成" |

### 1C. 2.5D、HD-2D、剖面房间（和我们的视角最相关）

| # | 帖子 | 作者 | 日期 | 做了什么 | 工具 | 美术 | 用时 | 坑 / 亮点 |
|---|---|---|---|---|---|---|---|---|
| 33 | [零基础，纯用AI做出的HD2D游戏长啥样](https://www.xiaohongshu.com/search_result?keyword=%E9%9B%B6%E5%9F%BA%E7%A1%80%EF%BC%8C%E7%BA%AF%E7%94%A8AI%E5%81%9A%E5%87%BA%E7%9A%84HD2D%E6%B8%B8%E6%88%8F%E9%95%BF%E5%95%A5%E6%A0%B7) | 二二的石头 | 06-15 | HD-2D 都市怪谈幸存者 | Codex + Godot MCP + Computer Use MCP（**先试了 UE5，太复杂，和 AI 配合差，放弃**） | 场景：GPT 出构图 → 把物件拆开平铺成一张图 → Tripo 出模型 → 减面、像素化。角色：GPT 出静态图 → 即梦 Seedance 生成视频 → 拆帧去背 → 序列帧，再让 AI 生成法线贴图 | 2 周 | ★最完整的 2.5D 流程，细节见 §3.3。UI 用 Figma MCP。音效用 Adobe Firefly，BGM 用 MiniMax |
| 34 | [AI开发游戏，真有网上吹的那么厉害吗](https://www.xiaohongshu.com/search_result?keyword=AI%E5%BC%80%E5%8F%91%E6%B8%B8%E6%88%8F%EF%BC%8C%E7%9C%9F%E6%9C%89%E7%BD%91%E4%B8%8A%E5%90%B9%E7%9A%84%E9%82%A3%E4%B9%88%E5%8E%89%E5%AE%B3%E5%90%97) | 原力总督 | 09-18 | 2.5D 像素叙事游戏《茙凛》，已打包成 EXE | GPT / Codex + Godot | 一张精灵图 85 帧 | 1 个月，3D 场景改了 70 轮 | AI 实现功能很强，但"看画面很瞎"（说背包边缘有毛刺，它直接把包拆了）。评论批评精灵图分辨率太高、颜色太杂。截帧结尾有一个**像素小人 + 3D 剖面房间** |
| 35 | [Astra做的2.5D小家](https://www.xiaohongshu.com/search_result?keyword=Astra%E5%81%9A%E7%9A%842.5D%E5%B0%8F%E5%AE%B6) | 泡泡 | 09-11 | 等距视角的剖面小屋，点家具跳转到不同功能 | GPT-6 Astra | 生成一整张图，再叠可点击的热区 | 5 小时额度的 30%～40% | ★**剖面房间的样子**（截图见 §6）。但它是一张静态图，家具不能挪 |
| 36 | [GPT6+Unity，一小时开发俯视角游戏demo](https://www.xiaohongshu.com/search_result?keyword=GPT6%2BUnity%EF%BC%8C%E4%B8%80%E5%B0%8F%E6%97%B6%E5%BC%80%E5%8F%91%E4%BF%AF%E8%A7%86%E8%A7%92%E6%B8%B8%E6%88%8Fdemo) | 云龙的AI实践笔记 | 09-13 | 2.5D 俯视幸存者 like，有三选一升级卡 | Codex 官方 Unity 插件 | image2.5 生图 | 1.5 小时，$200 周额度的 3%～4% | 让 Codex 自己装了 Unity |
| 37 | [image2生成2.5D游戏场景](https://www.xiaohongshu.com/search_result?keyword=image2%E7%94%9F%E6%88%902.5D%E6%B8%B8%E6%88%8F%E5%9C%BA%E6%99%AF) | 星空AI | 09-01 | 2.5D 场景图 | image2 | | | 只有图 |
| 38 | [GPT6花了三个小时制作的游戏](https://www.xiaohongshu.com/search_result?keyword=GPT6%E8%8A%B1%E4%BA%86%E4%B8%89%E4%B8%AA%E5%B0%8F%E6%97%B6%E5%88%B6%E4%BD%9C%E7%9A%84%E6%B8%B8%E6%88%8F) | 七喜爱吃肉 | 09-06 | 2.5D 仙侠 | GPT-6 | AI 图和视频 | 约 $25 | 截帧看更像 AI 视频拼出来的。评论说画面幼稚 |

### 1D. 工具链：Unity MCP

| # | 帖子 | 作者 | 日期 | 要点 |
|---|---|---|---|---|
| 39 | [Unity + Codex 配置MCP server](https://www.xiaohongshu.com/search_result?keyword=Unity%20%2B%20Codex%20%E9%85%8D%E7%BD%AEMCP%20server) | Frank游戏开发日志 | 07-14 | 安装流程；推荐在 itch.io 上筛可商用素材 |
| 40 | [AI 已经开始自己操作 Unity 了](https://www.xiaohongshu.com/search_result?keyword=AI%20%E5%B7%B2%E7%BB%8F%E5%BC%80%E5%A7%8B%E8%87%AA%E5%B7%B1%E6%93%8D%E4%BD%9C%20Unity%20%E4%BA%86) | 风口的居 | 09-27 | 介绍：能搭场景、写 C#、加物理、做 UI、跑测试 |
| 41 | [Codex开发游戏，别忘了给引擎装上MCP](https://www.xiaohongshu.com/search_result?keyword=Codex%E5%BC%80%E5%8F%91%E6%B8%B8%E6%88%8F%EF%BC%8C%E5%88%AB%E5%BF%98%E4%BA%86%E7%BB%99%E5%BC%95%E6%93%8E%E8%A3%85%E4%B8%8AMCP) | 乐伯做游戏 | 09-07 | 不装 MCP 时，AI 会写一堆编辑器脚本当胶水层，项目越来越难扩展；装了以后能形成"修改 → 编译 → 检查 → 验证"的闭环。用的是 Coplay（GitHub 上星最多的社区 Unity MCP）。**只打开当前任务需要的工具，省上下文** |
| 42 | [unity mcp使用感受](https://www.xiaohongshu.com/search_result?keyword=unity%20mcp%E4%BD%BF%E7%94%A8%E6%84%9F%E5%8F%97) | 反向弯曲 | 2025-04 | "目前只是个玩具"：会陷入死循环烧钱，物件一多就定位不准，换材质经常失败。花了约 $10 |
| 43 | [使用AI操作Unity来开发游戏](https://www.xiaohongshu.com/search_result?keyword=%E4%BD%BF%E7%94%A8AI%E6%93%8D%E4%BD%9CUnity%E6%9D%A5%E5%BC%80%E5%8F%91%E6%B8%B8%E6%88%8F) | OSCAR_奥斯卡 | 2025-03 | justinpbarnett/unity-mcp 安装教程 |
| 44 | [初次尝试用AI+MCP搭建UI界面](https://www.xiaohongshu.com/search_result?keyword=%E5%88%9D%E6%AC%A1%E5%B0%9D%E8%AF%95%E7%94%A8AI%2BMCP%E6%90%AD%E5%BB%BAUI%E7%95%8C%E9%9D%A2) | SYF大好人 | 04-03 | IvanMurzak/Unity-MCP，两句话搭出两个界面 |
| 45 | [AI开始接管游戏引擎了](https://www.xiaohongshu.com/search_result?keyword=AI%E5%BC%80%E5%A7%8B%E6%8E%A5%E7%AE%A1%E6%B8%B8%E6%88%8F%E5%BC%95%E6%93%8E%E4%BA%86) | 鼹鼠方块 | 05-24 | ★引擎对比：Unity 进展最快；UE 难在蓝图依赖；**Godot 更适合做原型**；Roblox 已内置 MCP。短期最容易落地的是原型、灰盒、工具、测试。热评 66 赞："编辑器反而降低 AI 效率，我已转向纯代码引擎" |
| 46 | [Unity MCP实现AI自己做游戏](https://www.xiaohongshu.com/search_result?keyword=Unity%20MCP%E5%AE%9E%E7%8E%B0AI%E8%87%AA%E5%B7%B1%E5%81%9A%E6%B8%B8%E6%88%8F) | 同济子豪兄 | 2025-07 | "效果还比较简陋，只能做小 demo" |
| 47 | [两句话让Unity自己做一个游戏](https://www.xiaohongshu.com/search_result?keyword=%E4%B8%A4%E5%8F%A5%E8%AF%9D%E8%AE%A9Unity%E8%87%AA%E5%B7%B1%E5%81%9A%E4%B8%80%E4%B8%AA%E6%B8%B8%E6%88%8F) | 犯困电吹风 | 04-27 | Unity 内置的 AI Assistant 可以接 Claude Code，作者觉得 Claude Code 更好用；用 agent 搭场景效率低 |
| 48 | [Unity和谷歌发布游戏版Codex](https://www.xiaohongshu.com/search_result?keyword=Unity%E5%92%8C%E8%B0%B7%E6%AD%8C%E5%8F%91%E5%B8%83%E6%B8%B8%E6%88%8F%E7%89%88Codex) | 阿博粒 | 10-07 | 新闻：引擎厂商开始自带 AI 助手 |
| 49 | [2026 AI游戏MCP工具链实战指南](https://www.xiaohongshu.com/search_result?keyword=2026%20AI%E6%B8%B8%E6%88%8FMCP%E5%B7%A5%E5%85%B7%E9%93%BE%E5%AE%9E%E6%88%98%E6%8C%87%E5%8D%97) | 枫起时花落 | 08-30 | 图文清单 |

### 1E. 工具链：Blender MCP 和 3D 生成

| # | 帖子 | 作者 | 日期 | 要点 |
|---|---|---|---|---|
| 50 | [让 AI 直接操作 Blender 新手图解教程](https://www.xiaohongshu.com/search_result?keyword=%E8%AE%A9%20AI%20%E7%9B%B4%E6%8E%A5%E6%93%8D%E4%BD%9C%20Blender%20%E6%96%B0%E6%89%8B%E5%9B%BE%E8%A7%A3%E6%95%99%E7%A8%8B) | MiRoo | 09-08 | 1011 赞。热评：直接让 Codex 自己装、自己连就行 |
| 51 | [Blender MCP 接入 Codex 实测](https://www.xiaohongshu.com/search_result?keyword=Blender%20MCP%20%E6%8E%A5%E5%85%A5%20Codex%20%E5%AE%9E%E6%B5%8B) | 芒果罐头 | 09-08 | ahujasid/blender-mcp：`uvx blender-mcp`，Blender 插件默认端口 9876；一次实测用了约 6% 周额度。评论说复刻效果一般 |
| 52 | [Blender MCP 跑通了，Codex 真能操作建模](https://www.xiaohongshu.com/search_result?keyword=Blender%20MCP%20%E8%B7%91%E9%80%9A%E4%BA%86%EF%BC%8CCodex%20%E7%9C%9F%E8%83%BD%E6%93%8D%E4%BD%9C%E5%BB%BA%E6%A8%A1) | RenderLee | 09-09 | 踩过的坑：找不到 uvx 要写完整路径；插件启用后还得手动 Start；改完配置要彻底重启；只保留一个客户端连接；**动手前先备份 .blend 文件** |
| 53 | [一句话让AI建模-Blender MCP实测](https://www.xiaohongshu.com/search_result?keyword=%E4%B8%80%E5%8F%A5%E8%AF%9D%E8%AE%A9AI%E5%BB%BA%E6%A8%A1-Blender%20MCP%E5%AE%9E%E6%B5%8B) | 串串不吃串 | 08-18 | 视频教程（GitHub 约 26K 星） |
| 54 | [使用AI自然语言建模!Blender+MCP保姆级教程](https://www.xiaohongshu.com/search_result?keyword=%E4%BD%BF%E7%94%A8AI%E8%87%AA%E7%84%B6%E8%AF%AD%E8%A8%80%E5%BB%BA%E6%A8%A1%21Blender%2BMCP%E4%BF%9D%E5%A7%86%E7%BA%A7%E6%95%99%E7%A8%8B) | 青龙 | 09-15 | 评论：用 AI 省事，但还是要手工调 |
| 55 | [GPT6+HYPER3D MCP+BLENDER全自动场景制作](https://www.xiaohongshu.com/search_result?keyword=GPT6%2BHYPER3D%20MCP%2BBLENDER%E5%85%A8%E8%87%AA%E5%8A%A8%E5%9C%BA%E6%99%AF%E5%88%B6%E4%BD%9C) | TBOY | 09-15 | 原画切块 → Hyper3D 逐个生成 → Blender 拼装渲染。一小时约 $10～15。评论：**面数、贴图、材质达不到游戏标准** |
| 56 | [Astra+Blender 肝了40小时](https://www.xiaohongshu.com/search_result?keyword=Astra%2BBlender%20%E8%82%9D%E4%BA%8640%E5%B0%8F%E6%97%B6) | 半自动灵感 | 09-13 | 让 AI 调几何节点，做程序化植物，花了周额度的 50% |
| 57 | [第一次用AI跑完整套3D流程，一些想法](https://www.xiaohongshu.com/search_result?keyword=%E7%AC%AC%E4%B8%80%E6%AC%A1%E7%94%A8AI%E8%B7%91%E5%AE%8C%E6%95%B4%E5%A5%973D%E6%B5%81%E7%A8%8B%EF%BC%8C%E4%B8%80%E4%BA%9B%E6%83%B3%E6%B3%95) | 1uckinky | 09-07 | 先用 AI 快速做概念简模，再用 Tripo 做资产替换；最费时的拼装和绑骨被 AI 拿走了，人负责拆分思路和审美 |
| 58 | [手把手教你，用GPT6搓一个3D小岛个人主页](https://www.xiaohongshu.com/search_result?keyword=%E6%89%8B%E6%8A%8A%E6%89%8B%E6%95%99%E4%BD%A0%EF%BC%8C%E7%94%A8GPT6%E6%90%93%E4%B8%80%E4%B8%AA3D%E5%B0%8F%E5%B2%9B%E4%B8%AA%E4%BA%BA%E4%B8%BB%E9%A1%B5) | Rico有三猫 | 09-13 | 5552 赞。一张精美效果图直接转 3D 会糊成一坨；**复杂场景要拆开单独建模，再拼起来** |
| 59 | [我用Codex做了个3D游戏奥德赛厨房](https://www.xiaohongshu.com/search_result?keyword=%E6%88%91%E7%94%A8Codex%E5%81%9A%E4%BA%86%E4%B8%AA3D%E6%B8%B8%E6%88%8F%E5%A5%A5%E5%BE%B7%E8%B5%9B%E5%8E%A8%E6%88%BF) | Rico有三猫 | 09-16 | 先让 Codex 整理开发提示词 → AI 出人物、道具、UI 图 → Codex 调 Tripo CLI 批量转 3D → 有问题就截图圈出来丢回去。约一周 $100 Pro 额度 |
| 60 | [教程｜用Codex 做 3D 场景](https://www.xiaohongshu.com/search_result?keyword=%E6%95%99%E7%A8%8B%EF%BD%9C%E7%94%A8Codex%20%E5%81%9A%203D%20%E5%9C%BA%E6%99%AF) | 海星 | — | 爱丽丝仙境 Web3D：风格化比写实更适合网页性能；先搭大结构再贴图，精细物件用 Tripo P2.0 出干净拓扑的 GLB。★**让 AI 做一个摆放编辑器（移动、旋转、缩放、保存布局），不要用语言描述"放在哪"** |
| 61 | [教你用Claude 构建3A游戏](https://www.xiaohongshu.com/search_result?keyword=%E6%95%99%E4%BD%A0%E7%94%A8Claude%20%E6%9E%84%E5%BB%BA3A%E6%B8%B8%E6%88%8F) | Michael-001 | 06-25 | 英文搬运：Unreal MCP + Cesium 拉入 Google Earth 数据 + 后台无界面运行 Blender。外国评论："看起来和其他 slop 游戏一样" |

### 1F. 方法、技能和工作室框架

| # | 帖子 | 作者 | 日期 | 要点 |
|---|---|---|---|---|
| 62 | [Claude Code=整个游戏工作室](https://www.xiaohongshu.com/search_result?keyword=Claude%20Code%3D%E6%95%B4%E4%B8%AA%E6%B8%B8%E6%88%8F%E5%B7%A5%E4%BD%9C%E5%AE%A4) | 秦楚zoro | 04-21 | 2154 赞，介绍 Claude Code Game Studios |
| 63 | [大神开源了Claude Code游戏开发工作室](https://www.xiaohongshu.com/search_result?keyword=%E5%A4%A7%E7%A5%9E%E5%BC%80%E6%BA%90%E4%BA%86Claude%20Code%E6%B8%B8%E6%88%8F%E5%BC%80%E5%8F%91%E5%B7%A5%E4%BD%9C%E5%AE%A4) | 程序员少北晨 | 04-17 | 2451 赞。评论："opus 的 token 烧起来没底" |
| 64 | [Claude Code开游戏厂](https://www.xiaohongshu.com/search_result?keyword=Claude%20Code%E5%BC%80%E6%B8%B8%E6%88%8F%E5%8E%82) | 前端AI探索 | 03-25 | 评论："token 焚化炉"；"Plan 还没写完，Max 20 就用完了" |
| 65 | [GitHub爆火一人游戏公司，48个AI任你差遣](https://www.xiaohongshu.com/search_result?keyword=GitHub%E7%88%86%E7%81%AB%E4%B8%80%E4%BA%BA%E6%B8%B8%E6%88%8F%E5%85%AC%E5%8F%B8%EF%BC%8C48%E4%B8%AAAI%E4%BB%BB%E4%BD%A0%E5%B7%AE%E9%81%A3) | 量子位 | 03-26 | 评论："agent 像大厂员工，每个部门不停耗 token，产出一堆看着专业的文字，进度一点不推" |
| 66 | [用Claude Code造了一个游戏调参器，我悟了](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Claude%20Code%E9%80%A0%E4%BA%86%E4%B8%80%E4%B8%AA%E6%B8%B8%E6%88%8F%E8%B0%83%E5%8F%82%E5%99%A8%EF%BC%8C%E6%88%91%E6%82%9F%E4%BA%86) | 玉言有智 | 08-03 | ★**不要让 AI 猜数值，让它做调参器**：46 个参数做成滑杆，改了立即生效，一键导出 TypeScript。架构是 config 可变对象 + zustand 写回 + 一个直接改 THREE 对象的"桥"。还写了自测 |
| 67 | [音效小白，怎么给自己的游戏做完 70 个音效](https://www.xiaohongshu.com/search_result?keyword=%E9%9F%B3%E6%95%88%E5%B0%8F%E7%99%BD%EF%BC%8C%E6%80%8E%E4%B9%88%E7%BB%99%E8%87%AA%E5%B7%B1%E7%9A%84%E6%B8%B8%E6%88%8F%E5%81%9A%E5%AE%8C%2070%20%E4%B8%AA%E9%9F%B3%E6%95%88) | alannnC | 08-19 | 先让 AI 列出 70 个需要声音的时刻和描述 → 去免费商用库找（只有约 1/4 能用）→ 本地 ComfyUI 跑 Stable Audio 3，每条出 3 个候选。**AudioGen、AudioLDM 2、Tango 2 都是非商用授权** |
| 68 | [AI做游戏：15天拿下2.5万美元](https://www.xiaohongshu.com/search_result?keyword=AI%E5%81%9A%E6%B8%B8%E6%88%8F%EF%BC%9A15%E5%A4%A9%E6%8B%BF%E4%B8%8B2.5%E4%B8%87%E7%BE%8E%E5%85%83) | Neko芙 | — | 卡皮巴拉送外卖网页游戏，拿了 Web Jam 冠军（规则要求 ≥90% 代码由 AI 写）。同时开 2～3 个 Claude Code 会话；GPT、Grok、Tripo3D、Suno、ElevenLabs 出素材；188 次提交，2.7 万行。地形、镜头、手感还得自己上手调。另外介绍了几款网页游戏靠卖游戏内广告位赚钱 |
| 69 | [一个Prompt做出AAA游戏？我去查了原作者](https://www.xiaohongshu.com/search_result?keyword=%E4%B8%80%E4%B8%AAPrompt%E5%81%9A%E5%87%BAAAA%E6%B8%B8%E6%88%8F%EF%BC%9F%E6%88%91%E5%8E%BB%E6%9F%A5%E4%BA%86%E5%8E%9F%E4%BD%9C%E8%80%85) | 幺拗扒 x LONG | 08-18 | ★SNOWFLOW 雪地 demo（Babylon.js + WebGPU）：9 小时、400 万 token。先聊 15 轮写成 Implementation Brief（视觉目标、技术限制、性能要求、验收标准），再用 100 多条指令迭代 |
| 70 | [用Claude最强模型做出我梦想中的游戏](https://www.xiaohongshu.com/search_result?keyword=%E7%94%A8Claude%E6%9C%80%E5%BC%BA%E6%A8%A1%E5%9E%8B%E5%81%9A%E5%87%BA%E6%88%91%E6%A2%A6%E6%83%B3%E4%B8%AD%E7%9A%84%E6%B8%B8%E6%88%8F) | 陈小爷 | 07-03 | **先做 2D 版验证设定，再用 three.js 做 3D 版**；单个 HTML，在网页版 Claude 里完成 |
| 71 | [Claude最新模型做游戏已达next level](https://www.xiaohongshu.com/search_result?keyword=Claude%E6%9C%80%E6%96%B0%E6%A8%A1%E5%9E%8B%E5%81%9A%E6%B8%B8%E6%88%8F%E5%B7%B2%E8%BE%BEnext%20level) | 陈小爷 | 06-11 | 兔子开放世界，提示词里加了"Three.js"和"开放世界"。热评：难的是角色要有自己的风格、要有玩法支撑 |
| 72 | [从夯到拉，锐评 8 个热门游戏制作 Skill](https://www.xiaohongshu.com/search_result?keyword=%E4%BB%8E%E5%A4%AF%E5%88%B0%E6%8B%89%EF%BC%8C%E9%94%90%E8%AF%84%208%20%E4%B8%AA%E7%83%AD%E9%97%A8%E6%B8%B8%E6%88%8F%E5%88%B6%E4%BD%9C%20Skill) | 运营人小禾 | 08-11 | 评价最高的是 godot-gdscript-patterns 和 develop-web-game（"做一点、试玩、观察、再调"的纪律）；**phaser-gamedev 很适合 2D 网页游戏**；game-ui-design 专治"像程序员作业" |
| 73 | [Codex 做游戏 Skill 排行榜](https://www.xiaohongshu.com/search_result?keyword=Codex%20%E5%81%9A%E6%B8%B8%E6%88%8F%20Skill%20%E6%8E%92%E8%A1%8C%E6%A6%9C) | 西洲 | 09-01 | 10 个 skill 按安装量排行。评论："skill 作用减弱了，直接上大模型就挺好" |
| 74 | [Codex做游戏Skill排行榜](https://www.xiaohongshu.com/search_result?keyword=Codex%E5%81%9A%E6%B8%B8%E6%88%8FSkill%E6%8E%92%E8%A1%8C%E6%A6%9C) | 小龙 | 10-03 | 推荐组合：develop-web-game + game-engine + game-feel |
| 75 | [盘点Claude Opus 5带火的一人+AI造游戏玩法](https://www.xiaohongshu.com/search_result?keyword=%E7%9B%98%E7%82%B9Claude%20Opus%205%E5%B8%A6%E7%81%AB%E7%9A%84%E4%B8%80%E4%BA%BA%2BAI%E9%80%A0%E6%B8%B8%E6%88%8F%E7%8E%A9%E6%B3%95) | 阿博粒 | 07-30 | 盘点帖 |
| 76 | [GPT-6 花了4小时，自己做出了一款3D游戏](https://www.xiaohongshu.com/search_result?keyword=GPT-6%20%E8%8A%B1%E4%BA%864%E5%B0%8F%E6%97%B6%EF%BC%8C%E8%87%AA%E5%B7%B1%E5%81%9A%E5%87%BA%E4%BA%86%E4%B8%80%E6%AC%BE3D%E6%B8%B8%E6%88%8F) | 斯塔克AI | 09-08 | UE + Mixamo + Blender MCP 生成皇城。评论："这叫开放世界 demo，不是 3A" |
| 77 | [新手友好用AI打造互动游戏demo](https://www.xiaohongshu.com/search_result?keyword=%E6%96%B0%E6%89%8B%E5%8F%8B%E5%A5%BD%E7%94%A8AI%E6%89%93%E9%80%A0%E4%BA%92%E5%8A%A8%E6%B8%B8%E6%88%8Fdemo) | 嘉润 Lynn | 05-18 | ⚠️ 其实是 AI 图片和视频拼的"游戏画面"，不能玩 |
| 78 | [AI教程分享｜用AI自制游戏demo](https://www.xiaohongshu.com/search_result?keyword=AI%E6%95%99%E7%A8%8B%E5%88%86%E4%BA%AB%EF%BD%9C%E7%94%A8AI%E8%87%AA%E5%88%B6%E6%B8%B8%E6%88%8Fdemo) | 在野AI | 05-07 | ⚠️ 5961 赞，但截帧看是视频模型生成的"游戏预告"，不是真游戏 |

---

## 2. 常见工作流

按出现频率从高到低：

1. **先写方案，再动手。** 用自然语言把想法聊成一份开发文档，写清目标、验收标准、禁止事项（#33 #59 #69）。HD-2D 那位还专门给 agent 写了一份 MD，禁止它做临时占位方案。
2. **AI 总导演 + 专用工具流水线。** Claude Code 或 Codex 负责写代码和调度。3D 资产交给 Tripo、Meshy、Hyper3D，Blender MCP 负责清理、拼装、绑骨，引擎（Godot / Unity / UE）或 three.js 负责运行（#3 #5 #6 #12 #33 #59）。
3. **模块化 + 统一网格。** 先做小组件，再在固定网格上拼起来；整栋房子一次生成基本都翻车（#4 #5 #57 #58）。
4. **一次只加一个功能，试玩，截图圈问题，再改。** 大家反复提到"修了 70 轮""100 多条指令"（#6 #34 #59 #69）。
5. **为自己造工具。** 调参器（#66）、摆放编辑器（#60）、游戏内 DEV 面板（#3）、Figma 转 Godot 的工具（#33）。共同思路是：**把模糊的语言换成可以量化的手柄。**
6. **多会话并行。** 同时开 2～3 个 Claude Code 会话做不同功能（#68）。反过来，48 个 agent 的"工作室"框架评价普遍很差，被叫作"token 焚化炉"（#62～65）。
7. **先 2D 后 3D。** 先用简单版本验证玩法，再上画面（#70）。

## 3. 美术方案

### 3.1 五条路线

| 路线 | 例子 | 好处 | 问题 |
|---|---|---|---|
| 代码直接画（three.js 几何体或 Canvas） | #13 #16 #22 #31 #71 | 不花钱、不涉及版权、改起来快、Claude 最擅长 | 只适合低多边形、积木、简笔风格；细看粗糙 |
| 生图模型出 2D 素材 | #15 image2.5，#17 Gemini，#36 | 精致，风格可控 | 同一角色、同一视角很难保持一致；需要抠图、切图 |
| 生图 → 3D 生成（Tripo / Meshy / Hyper3D） | #3 #5 #33 #57 #59 | 资产精细，可以批量 | 要花钱（点数）；面数和贴图需要处理；要先画好三视图 |
| Blender MCP 用代码建模、拼装 | #1 #2 #4 #12 | 能编辑，模块化 | 复杂结构和贴图吃力，要人工调 |
| 现成素材包（Asset Store / itch.io / Kenney） | #32 #39，以及 #33 的建议 | 稳定、便宜 | 风格是别人的，要注意授权 |

### 3.2 阿陈的 5 条模块化规矩（#5，最实用）

1. **画三视图**：纯文字描述和平面图都会让 3D 生成翻车，三视图才稳。
2. **每个组件定好真实尺寸**：统一网格（墙宽 2 米、高 2.4 米），再让 AI 写一个对齐脚本自动吸附。
3. **写清楚不要什么**：比如屋顶从下往上看也不能有破洞。
4. **放一个人形角色进去实测**：动画改成原地播放防止滑步；门太矮时只改网格基准，全村等比例放大。
5. **共用贴图图集**：23 套材质合并成 2 套，画面更清楚，性能也更好。

### 3.3 HD-2D 那位的角色流程（#33）

GPT 出静态角色图 → 写提示词交给即梦 Seedance 生成动作视频 → 拆帧、去背 → 序列帧导入 → 让 AI 生成对应的法线贴图，让 2D 角色也能吃到 3D 光照。射击角色把身体和手分开做，方便换武器。

## 4. 做不到、容易翻车的地方

- **视觉判断**：AI 实现功能很强，但看不出画面哪里不好（#34）；斑马线方向全错（#24）。人必须当美术总监。
- **一次生成整个复杂场景**：糊成一坨（#58 #23）。
- **生成资产的质量**：面数、贴图达不到游戏标准（#55）；角色缺少自己的风格（#71）。
- **手感和数值**：靠嘴调永远调不准（#66）；地形、镜头、手感还得人试玩（#68）。
- **额度和费用**：一片海 $1874（#8）；钓鱼游戏一周额度 100%（#2）；几何节点 50%（#56）。
- **工具本身不稳**：Unity MCP 会死循环烧钱、物件多了定位不准（#42）；UE 对 AI 太复杂（#33）。
- **授权**：大部分音效模型是非商用授权（#67）；"清明上河图会不会有版权问题"之类的评论（#12）。
- **信息噪音**：大量搬运（#1 #14 #26）、夸张标题（"3A"）、AI 视频冒充游戏（#77 #78）。

---

## 5. 对《重生末日之前》2.5D 三人小队的启示

### 5.1 视角（第 5 节第 1 件事）

调研里和我们气质最接近的画面有两类：

- **斜俯视的 3D 卡通**：钓鱼游戏 #1 #2、六边形岛 #7、末世乐高 #31。都是固定相机，不会晕。
- **剖面房间**：2.5D 小家 #35、《茙凛》结尾的房间 #34、阿陈的"进屋屋顶自动隐藏" #5。

**建议：斜 45° 固定视角 + 人进屋时屋顶和前墙自动隐藏。** 这样同时拿到"饥荒那种外面的世界"和"剖面看家里"，不用二选一。阿陈已经证明这在模块化组件上是一个开关就能实现的事。

### 5.2 技术路线：新冒出来的一个选项

上一个会话建议在现有 Vite 项目里加 Phaser 4（2D 引擎）。调研之后，我想多摆一个选项出来：

| | A. Phaser 4 等距 2D | B. three.js 真 3D + 固定斜 45° 正交相机 |
|---|---|---|
| 画面 | 像 2.5D 小家 #35：每件家具是一张等距图 | 像钓鱼游戏 #1：真模型，真光影 |
| 美术来源 | 等距图必须角度一致，生图很难做到；可以用 Blender 固定角度渲染来保证 | 代码低多边形占位 → Tripo / Blender 资产替换，正是调研里最主流的流程 |
| 昼夜、灯光、丧尸夜袭氛围 | 要预先画好或者叠图层 | 引擎自带，改一个数值就行 |
| 进屋隐藏屋顶 | 每个房间都要准备两套图 | 直接隐藏几个网格 |
| 手机性能 | 最省 | 低多边形 + 共用贴图图集，手机能跑，但要控制面数 |
| 现成技能 | 有 phaser4-gamedev skill（已核实，见下） | three.js 在帖子里出现最多（#10 #13 #17 #70 #71） |
| 和现有项目 | 都能留在 Vite + TS + React 里，PWA 和部署不变 | 同左 |

两条路都不用换引擎，也不影响网页离线玩。**我个人倾向 B**，理由有两个：一是调研里 AI 最擅长的正是"写代码 + 拼装 3D 资产"；二是丧尸撞门的夜晚、昼夜和灯光，正是我们最想要的氛围。但这是大方向，请你拍板。

**不建议 Unity 和 UE**：Unity 网页包太重，手机上跑不好；UE 被试过的人评价为和 AI 配合差（#33）。Godot 和 AI 配合口碑好，但等于整个项目重写（上一个会话也这么判断）。

### 5.3 美术（第 5 节第 4 件事）

建议分三步走：

1. **原型阶段**：代码画低多边形占位（零成本）。先把"三个人在出租屋里吃喝睡 + 一晚丧尸撞门"跑通。
2. **定风格**：你用 Midjourney 出概念图和家具三视图（你有会员）。
3. **正式资产**：三视图交给 Tripo 出模型（要买点数），Blender MCP 统一网格、减面、合并贴图图集。阿陈那套 5 条规矩直接照搬。

### 5.4 可以马上借鉴、和视角无关的做法

- **每个功能先写 Implementation Brief**（目标、验收、禁止事项）。我们的 DESIGN.md 已经有这个底子。
- **做一个调参器面板**（#66）：滑杆调手感、倍速、光照，一键导出成 TypeScript 常量。它和我们 React + TS 的架构完全一致。
- **摆放编辑器（#60）本身就是玩法**：我们的"在房间网格里摆家具"正好就是这个编辑器，开发工具和玩家功能可以一套代码两用。
- **统一网格**：出租屋按 1 米格子设计，墙、门、家具都吸附在格子上。以后换别墅、自建房，只换组件。
- **不要上 48 个 agent 的工作室框架**：口碑是烧 token、不推进度。我们现在"一个会话 + 设计文档 + 测试"的方式更对。
- **音效**：先让 AI 列出需要声音的时刻清单 → 免费商用库 → 不够再用 Stable Audio 3 生成（它的社区授权在年营收 100 万美元以下可以商用）。生成前先确认授权。
- **差异化**：#31 说明"末世 + 小队 + 俯视"一小时就能出原型，画面不是壁垒。我们真正的护城河是重生预知、囤货、男主剧情、势力这些系统，2.5D 要服务它们，别把精力全耗在画面上。

### 5.5 关键事实核实（网页搜索，非小红书）

- phaser-gamedev skill 确实存在，作者是 GitHub 用户 chongdashu（在 phaserjs-tinyswords、phaserjs-oakwoods 等仓库里）。他另外在 vibejam-starter-pack 仓库里发布了 **phaser4-gamedev**。以上信息来自第三方技能目录，没有直接打开仓库验证。来源：[vibeindex](https://www.vibeindex.ai/skills/chongdashu/phaserjs-oakwoods/phaser-gamedev)、[claudemarketplaces](https://claudemarketplaces.com/skills/chongdashu/phaserjs-tinyswords)。
- Claude Code Game Studios 的主仓库是 Donchitos/Claude-Code-Game-Studios，有 Godot 4、Unity、UE5 三套 agent。有书评指出所有角色挤在同一个上下文里，所谓"独立审查"其实是同一个模型换提示词。来源：[Substack 书评](https://gameproductionalchemist.substack.com/p/claude-code-game-studios-49-agents)、[tomevault](https://tomevault.io/tome/Donchitos/Claude-Code-Game-Studios)。

---

## 6. 附：截帧看到的画面（文字描述，原图不进仓库）

- 钓鱼游戏 #1：高角度固定俯视，沙滩、浅水、礁石，低多边形卡通，斗笠渔夫。UI 很少：左下角是鱼饵，底部是按键提示。
- 六边形岛 #7：斜俯视的海上小岛，底部 2～3 张地形卡，左上角目标清单，有日落和灯塔光束。
- 末世乐高 #31：俯视城市街区，积木小人，绿色撤离圈和直升机标志。
- 2.5D 小家 #35：等距剖面，一室一厅：床、书桌、冰箱、沙发、书架、窗外月亮，暖色台灯。
- 阿陈的水上村落 #5：Godot 里的茅草屋、栈道、灯笼，最后切成斜 45° 等距视角。

这些截帧和视频文字稿都在本地临时目录里，分析完就清理掉，不提交到仓库。

---

## 7. 补充：用户新收藏的 4 篇（2026-10-08）

| 帖子 | 作者 | 日期 | 内容 | 描述和评论里的要点 |
|---|---|---|---|---|
| 游戏创作者的天塌了，一个人做游戏，也能有 AI 团队分工协助 | 青青 | 10-07 | Claude Code Game Studios 介绍：49 个 agent、74 个技能、12 个钩子、13 条编码规则、39 个模板，GitHub 约 2.5 万星 | 评论："AI 视频爆款很多，AI 游戏还一个爆款都没有"；"真烧 token，每月 200 刀不够"；"Claude Code 本身就能做，美术和凭空建模弱" |
| Opus5.5与Three.js | 林林 | 09-22 | 清澈溪流：透明的水、河底光斑、长苔藓的石头，全部用代码实现（原作者 hayashimon1） | 评论："技术美术不存在了"；有人照着做了能游泳的版本，"场景复刻没那么逼真" |
| 分享18：Opus5.5做3D网页最强 | skill大王王王王 | 09-24 | 樱花河谷坐船游，能切换雨雾、夕阳、夜景，有船灯和萤火 | 作者给了在线地址；评论质疑"一定迭代了无数次、用了很多 3D 素材"。**已核实**：网页源码注释写明用 three.js，石头、蕨类、树皮等贴图和扫描模型来自 Poly Haven（CC0），地形、树、寺庙、水、天空、粒子全部是代码在加载时生成。代码里用了 21 个自定义着色器、21 处实例化网格、指数雾、CubeCamera 反射 |
| 游戏上线第三天，目前收入还在爬坡中（图文） | 保罗哈迪 | 09-27 | 花 1500 元，用 GPT-6 + DeepSeek 做了像素风《网吧经营模拟器》，9 月 25 日在 TapTap 上线，评分 8.6，第三天预估广告收益 84 元 | Codex 接 TapTap 制造的 MCP 来做；前三天有推流补贴，之后就少了；作者说"不收费就不用版号"（未核实） |

**对我们的启示：**
1. **氛围要靠"昼夜 + 天气"系统。** 樱花河谷最打动人的就是雨雾、夕阳、夜里亮灯、萤火这些变化。我们的"一天 = 一周"和危机卡（暴雨、极寒、高温、尸潮夜）正好可以用同一套天气和光照预设来表现。建议放进 P2 时钟里一起做，手机上要控制开销。
2. **代码生成 + 少量免费素材，能做出很高的完成度。** Poly Haven（CC0）可以加进我们的免费素材来源。不过它是写实贴图，和低多边形卡通风不搭，只适合挑着用。
3. **水和江边**：溪流那篇说明水面、光斑这类效果用代码就能做。以后"江边打水"可以做成一个好看的地点。
4. **48/49 agent 工作室**：维持之前的判断，不整套搬，但可以借它的设计文档模板、测试清单和按目录生效的编码规则。
5. **《网吧经营模拟器》**：俯视的室内经营（往空位上添加设备、顾客、口碑）和我们屋里 45° 的经营玩法很像；也说明做出来容易，赚钱难，分发渠道要提前想。
