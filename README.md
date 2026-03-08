# Beaconfall / 信标绝境 / ビーコンフォール

A lightweight first-person 3D survival shooter built with Three.js + Vite.

一个基于 Three.js + Vite 的轻量第一人称 3D 生存射击游戏。

Three.js + Vite で作られた、軽量な一人称 3D サバイバルシューティングです。

## 中文说明

### 关卡结构（五关）

1. 荒野防线：常规战斗，支持灯塔和平撤离。
2. 熔岩平台：移动平台 + 岩浆伤害，支持灯塔和平撤离。
3. 失血平原：固定白昼，玩家持续失血；需捡血包维持生命，地面会留下血迹；拾取血包会出现粉色泡泡。
4. 烈日柱阵：固定白昼 + 巨大太阳；地图由高大白柱组成，玩家在阴影下才不会持续掉血。
5. 色相试炼：固定白昼；敌人与柱子带有颜色属性，玩家被彩色怪触碰后会染色并持续失血，需触碰同色柱恢复满血并解除状态。

### 核心玩法

- 第一人称射击，`W/A/S/D` 移动，`Space` 跳跃，鼠标左键射击
- 命中反馈：金色命中光圈
- 敌人持续追击玩家
- 回合制生存目标 + 关卡推进

### 胜负条件

- 击败 `20` 个敌人立即胜利
- 或存活 `90` 秒胜利
- 第一、二关可通过抵达灯塔和平撤离获胜
- 生命值降为 `0` 则失败

### 运行环境

- Node.js 18+
- npm 9+

### 安装与启动

```bash
cd /home/openclaw/simple-3d-shooter
npm install
npm run start
```

默认地址：`http://localhost:4173`

### 构建

```bash
npm run build
```

### 部署到 GitHub Pages

本仓库已包含自动部署工作流。你只需要：

1. 在 GitHub 仓库页面进入 `Settings -> Pages`。
2. 在 `Build and deployment` 中将 `Source` 设为 `GitHub Actions`。
3. 推送到 `master` 分支后，Actions 会自动构建并部署。

部署地址：

- `https://bombless.github.io/simple-3d-shooter/`

---

## English

### Stage Structure (5 Stages)

1. Frontier Field: standard combat stage with pacifist lighthouse extraction.
2. Lava Platforms: moving platforms + lava hazard, also supports lighthouse extraction.
3. Bleed Plains: fixed daylight; the player constantly loses HP and must collect health packs. Blood trails appear on the ground, and collecting a pack triggers pink bubbles on screen.
4. Sun Pillars: fixed daylight with a giant sun. The map contains only tall white pillars; the player must stay in pillar shadows to avoid HP drain.
5. Chroma Trial: fixed daylight. Enemies and pillars have color states; touching a colored enemy curses the player with that color and causes constant HP drain until the matching pillar is touched, which fully restores HP.

### Core Gameplay

- First-person controls: `W/A/S/D` move, `Space` jump, left mouse to shoot
- Golden hit ring feedback on successful hits
- Enemies continuously chase the player
- Round-based survival goals with stage progression

### Win / Lose Conditions

- Win by defeating `20` enemies
- Or win by surviving for `90` seconds
- Stages 1 and 2 also allow pacifist lighthouse extraction wins
- Lose when HP reaches `0`

### Requirements

- Node.js 18+
- npm 9+

### Install & Run

```bash
cd /home/openclaw/simple-3d-shooter
npm install
npm run start
```

Default URL: `http://localhost:4173`

### Build

```bash
npm run build
```

### Deploy to GitHub Pages

This repository now includes an automatic Pages workflow.

1. Open `Settings -> Pages` in your GitHub repository.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Push to the `master` branch; GitHub Actions will build and deploy automatically.

Deployment URL:

- `https://bombless.github.io/simple-3d-shooter/`

---

## 日本語

### ステージ構成（全5ステージ）

1. 荒野防衛線：通常戦闘ステージ。灯台への平和撤退ルートあり。
2. 溶岩プラットフォーム：移動足場 + 溶岩ダメージ。こちらも灯台撤退可能。
3. 出血平原：固定の昼。プレイヤーは継続的にHPが減少し、回復パック回収が必要。地面に血痕が残り、回収時はピンク色バブルが表示。
4. 烈日柱陣：固定の昼 + 巨大な太陽。高い白柱のみの地形で、柱の影にいる間だけ継続ダメージを回避可能。
5. 色相試練：固定の昼。敵と柱に色属性があり、色付きの敵に触れるとプレイヤーが同色状態になって継続ダメージを受ける。対応する同色の柱に触れると全回復して解除される。

### 基本プレイ

- 一人称操作：`W/A/S/D` 移動、`Space` ジャンプ、左クリックで射撃
- 命中時は金色リングでフィードバック
- 敵は常にプレイヤーを追跡
- ラウンド制の生存目標 + ステージ進行

### 勝敗条件

- 敵を `20` 体倒すと勝利
- または `90` 秒生存で勝利
- 第1・第2ステージは灯台への平和撤退でも勝利
- HP が `0` になると敗北

### 動作環境

- Node.js 18+
- npm 9+

### インストールと起動

```bash
cd /home/openclaw/simple-3d-shooter
npm install
npm run start
```

既定 URL: `http://localhost:4173`

### ビルド

```bash
npm run build
```

### GitHub Pages へのデプロイ

このリポジトリには自動デプロイ用ワークフローが含まれています。

1. GitHub リポジトリの `Settings -> Pages` を開く。
2. `Build and deployment` の `Source` を `GitHub Actions` に設定する。
3. `master` ブランチへ push すると、自動でビルド・デプロイされる。

公開 URL:

- `https://bombless.github.io/simple-3d-shooter/`
