# Blender 工具

2.5D 原型的模型都由脚本生成，可重复执行，不手工改 .blend 文件。

## 生成小别墅组件
```bash
blender --background --factory-startup --python tools/blender/build_villa_kit.py -- \
  --out public/models/villa_kit.glb --preview /tmp/villa_preview.png
```
- 输出 `public/models/villa_kit.glb`：每个组件是一个具名节点（`wall_1m`、`wall_window_1m`、`wall_door_1m`、`door_1m`、`floor_1x1`、`grass_1x1`、`fence_1m`、`gate_1m`、`crate`、`bed`、`table`、`chair`）。
- 所有组件按 1 米网格，原点在格子底面中心，墙高 2.6 米、厚 0.2 米。
- 材质名是 `pal_<颜色键>`，游戏里会按名字换成同色的卡通材质。调色板在脚本顶部的 `PALETTE`。
- `--preview` 会用固定 45° 正交镜头渲染一张小样，方便不开浏览器检查画面。

## Blender MCP（交互式）
- 已装 `mcp-for-blender` 插件（Blender 5.2 用户插件目录），Claude Code 用户级 MCP 配置名为 `blender`，已关闭遥测。
- 打开 Blender 后插件会自动在 `localhost:9876` 启动服务；新开的 Claude 会话里就能用 Blender MCP 工具。
- 注意：这个服务能在 Blender 里执行任意 Python，只在本机用，动手前先保存工程。
