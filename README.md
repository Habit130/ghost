# Boo Dash / 阿飘冲刺

幽灵主题的网页街机得分攻击小游戏:操控一只可爱新手幽灵,在古宅中借「附身冲刺」穿梭宿主刷分,躲避巡逻驱魔人。单场景无尽,单局 1–2 分钟。

技术栈:TypeScript + Vite + Phaser(v4)。

- 玩法概念:[概念票 #2](https://github.com/Habit130/ghost/issues/2)
- 技术选型:[引擎选型研究](docs/research/engine-selection.md)(票 #3)
- 开发地图:[wayfinder 地图 #1](https://github.com/Habit130/ghost/issues/1)

## 本地开发

需要 Node ≥ 22(仓库在 Node 24 下开发)。

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
```

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器(热更新) |
| `npm run build` | 类型检查 + 生产构建(输出 dist/) |
| `npm run preview` | 预览生产构建 |
| `npm run typecheck` | 仅类型检查 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest 单测 |
| `npm run format` | Prettier 格式化 |

## 开发流程

- **GitHub Flow**:从最新 `main` 切功能分支,Conventional Commits,PR 目标 `main`,合并由仓库所有者完成
- CI:每个 PR 跑 typecheck + lint + test + build
- 领域词汇见 [CONTEXT.md](CONTEXT.md);代码注释与提交信息用英文,与用户的沟通用中文

## 目录结构

```
src/
  core/   纯逻辑(计分等),不依赖 Phaser —— 确定性游戏核心的种子
  game/   Phaser 场景与渲染层
```

## 状态

脚手架已就绪,游戏循环待实现(见地图 #1 的未决票)。
