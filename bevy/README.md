# Beaconfall (Bevy PC Prototype)

这个目录是用 **Bevy 0.18.1** 实现的 PC 版复刻原型。

## 已实现内容

- 第一人称 PC 操作：
  - `W/A/S/D` 移动
  - `Space` 跳跃
  - 鼠标移动视角（左键锁定）
  - `Esc` 释放鼠标
  - `R` 重开
- 8 关流程与计时（FIELD -> PRISM）
- 敌人刷怪、追击、近战伤害
- 鼠标点击射击（命中判定）
- 关卡目标与 HUD 文本
- 关卡机制复刻（简化版）：
  - L1/L2 灯塔撤离
  - L2 熔岩区域伤害
  - L3 失血 + 血包刷新
  - L4 阴影区域判定
  - L5 色咒（触怪染色，触同色柱解咒并满血）
  - L6/L7 三色圆环 + 灯塔目标
  - L7/L8 暗潮移动伤害区
  - L8 灯塔激活后结晶击杀计数

## 运行

```bash
cd /home/openclaw/simple-3d-shooter/bevy
cargo run
```

如果你在无图形环境（例如无 `DISPLAY`/`WAYLAND_DISPLAY`）运行，会无法开窗。

如果你在 Wayland 会话里运行，请不要使用 `env -u WAYLAND_DISPLAY cargo run`。
那会强制走 X11 路径，在部分系统上可能出现
`corrupted size vs. prev_size while consolidating` 之类的底层崩溃。

## 说明

这个版本是“可玩优先”的原型，重点是把原 Three.js 玩法迁移到 Bevy 的 PC 本地运行路径。
视觉表现（模型、特效、音频）和部分高级机制目前做了简化，但核心循环和关卡节奏已经对齐。
UI 已内置中文字体资源（`assets/fonts/NotoSansCJK-Regular.ttc`），避免中文显示为豆腐块。
