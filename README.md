# Beaconfall / 信标绝境 / ビーコンフォール

A lightweight first-person 3D survival shooter built with Three.js + Vite.

一个基于 Three.js + Vite 的轻量第一人称 3D 生存射击游戏。

Three.js + Vite で作られた、軽量な一人称 3D サバイバルシューティングです。

## 中文说明

### 玩法概览

- 第一人称射击，`W/A/S/D` 移动，`Space` 跳跃，鼠标左键射击
- 双关卡结构
- 第一关：荒野防线（可战斗胜利，也可灯塔和平撤离）
- 第二关：熔岩平台（可战斗胜利，也可灯塔和平撤离）
- 50 秒昼夜循环（进入第二关时会重置到夜晚）
- 夜间手电筒电量机制（夜耗电、昼回充）
- 命中反馈：金色命中光圈
- 敌人：克苏鲁风肉球体，持续追击玩家

### 胜负条件

- 击败 `20` 个敌人立即胜利
- 或存活 `90` 秒胜利
- 或抵达当前关卡灯塔和平撤离胜利
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

---

## English

### Gameplay

- First-person shooter controls: `W/A/S/D` move, `Space` jump, left mouse to shoot
- Two-stage progression
- Stage 1: Frontier Field (combat win or pacifist lighthouse extraction)
- Stage 2: Lava Platforms (combat win or pacifist lighthouse extraction)
- 50-second day/night cycle (resets to night when entering stage 2)
- Flashlight battery system (drains at night, recharges in daylight)
- Hit feedback uses a golden hit ring effect
- Eldritch enemies continuously chase the player

### Win / Lose Conditions

- Win by defeating `20` enemies
- Or win by surviving for `90` seconds
- Or win by reaching the lighthouse extraction point in the current stage
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

---

## 日本語

### ゲーム概要

- 一人称シューティング操作: `W/A/S/D` 移動、`Space` ジャンプ、左クリックで射撃
- 2ステージ構成
- 第1ステージ: 荒野防衛線（戦闘勝利または灯台への平和撤退）
- 第2ステージ: 溶岩プラットフォーム（戦闘勝利または灯台への平和撤退）
- 50秒の昼夜サイクル（第2ステージ開始時に夜へリセット）
- 懐中電灯バッテリー（夜に消耗、昼に回復）
- ヒット時は金色リングでフィードバック
- 異形の敵が継続してプレイヤーを追跡

### 勝敗条件

- 敵を `20` 体倒すと勝利
- または `90` 秒生存で勝利
- または現在ステージの灯台到達で平和勝利
- HP が `0` で敗北

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
