# 重生末日之前

女生重生回末日前一年，靠前世记忆囤货、求生、谈恋爱的卡牌叙事策略游戏。机制致敬《苏丹的游戏》：每月一张必须限期顶住的危机卡、地图放卡、属性=骰子数的检定、多线结局。

- 机制设计：[docs/DESIGN.md](docs/DESIGN.md)
- 开发计划与分工：[docs/PLAN.md](docs/PLAN.md)
- AI 协作规则：[AGENTS.md](AGENTS.md)

## 开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 类型检查 + 打包
npm test           # vitest
```

React 19 + Vite + TypeScript + Tailwind v4。纯静态，push 到 `main` 自动部署 GitHub Pages（仓库 Settings → Pages → Source 选 GitHub Actions）。
