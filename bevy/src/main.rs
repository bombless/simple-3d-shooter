use std::f32::consts::PI;

use bevy::{
    input::mouse::AccumulatedMouseMotion,
    prelude::*,
    text::LineBreak,
    window::{CursorGrabMode, CursorOptions, PrimaryWindow, WindowResolution},
};
use rand::Rng;

const PLAYER_MAX_HP: f32 = 100.0;
const PLAYER_HEIGHT: f32 = 1.7;
const PLAYER_RADIUS: f32 = 0.36;
const PLAYER_MOVE_SPEED: f32 = 10.0;
const PLAYER_GRAVITY: f32 = 28.0;
const PLAYER_JUMP_SPEED: f32 = 10.5;
const WORLD_CLAMP: f32 = 31.5;

const ENEMY_SPAWN_INTERVAL_SECONDS: f32 = 1.4;
const ENEMY_MAX_ACTIVE_COUNT: usize = 14;
const ENEMY_TOUCH_DAMAGE: f32 = 9.0;

const LAVA_DAMAGE_PER_SECOND: f32 = 8.0 / 0.34;
const BLEED_DAMAGE_PER_SECOND: f32 = 3.2;
const SHADOW_DAMAGE_PER_SECOND: f32 = 6.4;
const COLOR_CURSE_DAMAGE_PER_SECOND: f32 = 8.2;
const DARK_TIDE_DAMAGE_PER_SECOND: f32 = 4.2;
const DAY_BEACON_CRYSTALIZE_INTERVAL_SECONDS: f32 = 0.55;
const SOLAR_RING_TARGET_COUNT: usize = 3;

const LIGHTHOUSE_POS: Vec3 = Vec3::new(25.0, 0.0, 25.0);
const LIGHTHOUSE_TRIGGER_RADIUS: f32 = 2.8;

const SUN_DIR_SHADOW_LEVEL: Vec3 = Vec3::new(-0.64, -1.0, -0.24);

#[derive(Clone, Copy, PartialEq, Eq)]
enum LevelKind {
    Field,
    Lava,
    Bleed,
    Shadow,
    Chroma,
    Eclipse,
    Rift,
    Prism,
}

#[derive(Clone, Copy)]
struct LevelDef {
    id: &'static str,
    label: &'static str,
    name: &'static str,
    round_time: f32,
    enemy_goal: u32,
    kind: LevelKind,
}

const LEVELS: [LevelDef; 8] = [
    LevelDef {
        id: "grass",
        label: "FIELD",
        name: "第一关：荒野防线",
        round_time: 90.0,
        enemy_goal: 20,
        kind: LevelKind::Field,
    },
    LevelDef {
        id: "lava",
        label: "LAVA",
        name: "第二关：熔岩平台",
        round_time: 90.0,
        enemy_goal: 20,
        kind: LevelKind::Lava,
    },
    LevelDef {
        id: "bleed",
        label: "BLEED",
        name: "第三关：失血平原",
        round_time: 90.0,
        enemy_goal: 20,
        kind: LevelKind::Bleed,
    },
    LevelDef {
        id: "shadow",
        label: "SHADOW",
        name: "第四关：烈日柱阵",
        round_time: 90.0,
        enemy_goal: 20,
        kind: LevelKind::Shadow,
    },
    LevelDef {
        id: "color",
        label: "CHROMA",
        name: "第五关：色相试炼",
        round_time: 90.0,
        enemy_goal: 20,
        kind: LevelKind::Chroma,
    },
    LevelDef {
        id: "eclipse",
        label: "ECLIPSE",
        name: "第六关：日蚀回响",
        round_time: 180.0,
        enemy_goal: 20,
        kind: LevelKind::Eclipse,
    },
    LevelDef {
        id: "rift",
        label: "RIFT",
        name: "第七关：裂隙潮汐",
        round_time: 180.0,
        enemy_goal: 20,
        kind: LevelKind::Rift,
    },
    LevelDef {
        id: "prism",
        label: "PRISM",
        name: "第八关：棱镜灯塔",
        round_time: 180.0,
        enemy_goal: 20,
        kind: LevelKind::Prism,
    },
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EnemyColor {
    Blue,
    Red,
    Green,
    Black,
    Orange,
    Yellow,
}

impl EnemyColor {
    const ALL: [Self; 6] = [
        Self::Blue,
        Self::Red,
        Self::Green,
        Self::Black,
        Self::Orange,
        Self::Yellow,
    ];

    fn index(self) -> usize {
        match self {
            Self::Blue => 0,
            Self::Red => 1,
            Self::Green => 2,
            Self::Black => 3,
            Self::Orange => 4,
            Self::Yellow => 5,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Blue => "蓝",
            Self::Red => "红",
            Self::Green => "绿",
            Self::Black => "黑",
            Self::Orange => "橙",
            Self::Yellow => "黄",
        }
    }

    fn color(self) -> Color {
        match self {
            Self::Blue => Color::srgb(0.184, 0.486, 0.961),
            Self::Red => Color::srgb(0.914, 0.263, 0.263),
            Self::Green => Color::srgb(0.243, 0.812, 0.447),
            Self::Black => Color::srgb(0.098, 0.106, 0.129),
            Self::Orange => Color::srgb(0.945, 0.541, 0.176),
            Self::Yellow => Color::srgb(0.906, 0.843, 0.227),
        }
    }
}
const ENEMY_COLOR_COUNT: usize = EnemyColor::ALL.len();

#[derive(Clone, Copy, PartialEq, Eq)]
enum RoundMode {
    Playing,
    LevelCleared,
    Lost,
    CampaignWon,
}

#[derive(Resource)]
struct GameProgress {
    level_index: usize,
    hp: f32,
    total_score: u32,
    level_kills: u32,
    time_left: f32,
    spawn_timer: f32,
    mode: RoundMode,
    message: String,
    curse_color: Option<EnemyColor>,
    collected_rings: [bool; ENEMY_COLOR_COUNT],
    spawned_rings: [bool; ENEMY_COLOR_COUNT],
    prism_crystal_kills: u32,
    lighthouse_activated: bool,
    day_beacon_active: bool,
    day_beacon_accumulator: f32,
    next_level_index: Option<usize>,
    rift_angle: f32,
}

impl Default for GameProgress {
    fn default() -> Self {
        Self {
            level_index: 0,
            hp: PLAYER_MAX_HP,
            total_score: 0,
            level_kills: 0,
            time_left: LEVELS[0].round_time,
            spawn_timer: 0.0,
            mode: RoundMode::Playing,
            message: String::from("点击鼠标锁定视角并开始。"),
            curse_color: None,
            collected_rings: [false; ENEMY_COLOR_COUNT],
            spawned_rings: [false; ENEMY_COLOR_COUNT],
            prism_crystal_kills: 0,
            lighthouse_activated: false,
            day_beacon_active: false,
            day_beacon_accumulator: 0.0,
            next_level_index: None,
            rift_angle: 0.0,
        }
    }
}

#[derive(Resource, Default)]
struct PendingLevelLoad(Option<usize>);

#[derive(Component)]
struct Player {
    velocity_y: f32,
    on_ground: bool,
    yaw: f32,
    pitch: f32,
}

#[derive(Component)]
struct MainCamera;

#[derive(Component)]
struct HudText;

#[derive(Component)]
struct MessageText;

#[derive(Component)]
struct Crosshair;

#[derive(Component)]
struct VictoryOverlay;

#[derive(Component)]
struct VictoryOverlayTitle;

#[derive(Component)]
struct VictoryOverlayHint;

#[derive(Component)]
struct LevelEntity;

#[derive(Component)]
struct Enemy {
    speed: f32,
    color: Option<EnemyColor>,
    touch_cooldown: f32,
}

#[derive(Component)]
struct LighthouseZone;

#[derive(Component)]
struct Obstacle {
    radius: f32,
}

#[derive(Component)]
struct ShadowZone {
    radius: f32,
}

#[derive(Component)]
struct ColorPillar {
    color: EnemyColor,
    radius: f32,
}

#[derive(Component)]
struct RingPickup {
    color: EnemyColor,
}

#[derive(Component)]
struct HealthPack {
    active: bool,
    respawn_timer: f32,
}

#[derive(Component)]
struct DarkTideZone {
    radius: f32,
}

fn main() {
    let has_display = std::env::var_os("WAYLAND_DISPLAY").is_some()
        || std::env::var_os("WAYLAND_SOCKET").is_some()
        || std::env::var_os("DISPLAY").is_some();
    if !has_display {
        eprintln!(
            "未检测到图形会话（DISPLAY / WAYLAND_DISPLAY / WAYLAND_SOCKET）。\n请在桌面会话中运行 cargo run。"
        );
        return;
    }

    App::new()
        .insert_resource(ClearColor(Color::srgb(0.07, 0.09, 0.13)))
        .insert_resource(GameProgress::default())
        .insert_resource(PendingLevelLoad(Some(0)))
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Beaconfall Bevy (PC)".to_string(),
                resolution: WindowResolution::new(1600, 900),
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(
            Update,
            (
                capture_mouse,
                update_crosshair_visibility,
                confirm_next_level_input,
                restart_input,
                apply_level_load,
                mouse_look,
                player_move,
                enemy_spawner,
                enemy_update,
                shooting,
                pickups_and_objectives,
                day_beacon_ritual,
                hazards,
                level_progression,
                update_victory_overlay,
                update_hud,
            ),
        )
        .run();
}

fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    let ui_font = asset_server.load("fonts/NotoSansCJK-Regular.ttc");

    commands.spawn((
        Camera3d::default(),
        Transform::from_xyz(0.0, PLAYER_HEIGHT, 18.0)
            .looking_at(Vec3::new(0.0, PLAYER_HEIGHT, 0.0), Vec3::Y),
        Player {
            velocity_y: 0.0,
            on_ground: true,
            yaw: 0.0,
            pitch: 0.0,
        },
        MainCamera,
    ));

    commands.spawn((
        DirectionalLight {
            illuminance: 11000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_xyz(40.0, 60.0, 25.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));

    commands.spawn((
        Text::new(""),
        TextFont {
            font: ui_font.clone(),
            font_size: 22.0,
            ..default()
        },
        TextColor(Color::WHITE),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(12.0),
            left: Val::Px(12.0),
            ..default()
        },
        HudText,
    ));

    commands.spawn((
        Text::new(""),
        TextFont {
            font: ui_font.clone(),
            font_size: 24.0,
            ..default()
        },
        TextLayout::new(Justify::Left, LineBreak::WordOrCharacter),
        TextColor(Color::srgb(1.0, 0.93, 0.55)),
        Node {
            position_type: PositionType::Absolute,
            bottom: Val::Px(22.0),
            left: Val::Px(12.0),
            right: Val::Px(12.0),
            ..default()
        },
        MessageText,
    ));

    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: Val::Percent(50.0),
                top: Val::Percent(50.0),
                width: Val::Px(0.0),
                height: Val::Px(0.0),
                ..default()
            },
            ZIndex(30),
            Visibility::Hidden,
            Crosshair,
        ))
        .with_children(|parent| {
            parent.spawn((
                Node {
                    position_type: PositionType::Absolute,
                    left: Val::Px(-8.0),
                    top: Val::Px(-1.0),
                    width: Val::Px(16.0),
                    height: Val::Px(2.0),
                    ..default()
                },
                BackgroundColor(Color::srgba(1.0, 1.0, 1.0, 0.95)),
            ));
            parent.spawn((
                Node {
                    position_type: PositionType::Absolute,
                    left: Val::Px(-1.0),
                    top: Val::Px(-8.0),
                    width: Val::Px(2.0),
                    height: Val::Px(16.0),
                    ..default()
                },
                BackgroundColor(Color::srgba(1.0, 1.0, 1.0, 0.95)),
            ));
            parent.spawn((
                Node {
                    position_type: PositionType::Absolute,
                    left: Val::Px(-1.5),
                    top: Val::Px(-1.5),
                    width: Val::Px(3.0),
                    height: Val::Px(3.0),
                    ..default()
                },
                BackgroundColor(Color::srgba(1.0, 1.0, 1.0, 1.0)),
            ));
        });

    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                width: Val::Percent(100.0),
                height: Val::Percent(100.0),
                left: Val::Px(0.0),
                top: Val::Px(0.0),
                align_items: AlignItems::Center,
                justify_content: JustifyContent::Center,
                ..default()
            },
            BackgroundColor(Color::srgba(0.02, 0.03, 0.05, 0.86)),
            ZIndex(100),
            Visibility::Hidden,
            VictoryOverlay,
        ))
        .with_children(|parent| {
            parent
                .spawn((
                    Node {
                        width: Val::Percent(84.0),
                        max_width: Val::Px(920.0),
                        padding: UiRect::axes(Val::Px(26.0), Val::Px(20.0)),
                        border: UiRect::all(Val::Px(2.0)),
                        border_radius: BorderRadius::all(Val::Px(12.0)),
                        flex_direction: FlexDirection::Column,
                        align_items: AlignItems::Center,
                        row_gap: Val::Px(14.0),
                        ..default()
                    },
                    BackgroundColor(Color::srgba(0.08, 0.10, 0.14, 0.95)),
                    BorderColor::all(Color::srgb(0.92, 0.77, 0.38)),
                ))
                .with_children(|card| {
                    card.spawn((
                        Text::new("关卡胜利"),
                        TextFont {
                            font: ui_font.clone(),
                            font_size: 54.0,
                            ..default()
                        },
                        TextLayout::new(Justify::Center, LineBreak::WordOrCharacter),
                        TextColor(Color::srgb(1.0, 0.95, 0.72)),
                        VictoryOverlayTitle,
                    ));
                    card.spawn((
                        Text::new(""),
                        TextFont {
                            font: ui_font.clone(),
                            font_size: 30.0,
                            ..default()
                        },
                        TextLayout::new(Justify::Center, LineBreak::WordOrCharacter),
                        TextColor(Color::WHITE),
                        VictoryOverlayHint,
                    ));
                });
        });
}

fn capture_mouse(
    mouse: Res<ButtonInput<MouseButton>>,
    keys: Res<ButtonInput<KeyCode>>,
    mut cursor_q: Query<&mut CursorOptions, With<PrimaryWindow>>,
) {
    let Ok(mut cursor) = cursor_q.single_mut() else {
        return;
    };

    if mouse.just_pressed(MouseButton::Left) {
        cursor.grab_mode = CursorGrabMode::Locked;
        cursor.visible = false;
    }

    if keys.just_pressed(KeyCode::Escape) {
        cursor.grab_mode = CursorGrabMode::None;
        cursor.visible = true;
    }
}

fn update_crosshair_visibility(
    progress: Res<GameProgress>,
    cursor_q: Query<&CursorOptions, With<PrimaryWindow>>,
    mut crosshair_q: Query<&mut Visibility, With<Crosshair>>,
) {
    let Ok(cursor) = cursor_q.single() else {
        return;
    };

    let should_show = progress.mode == RoundMode::Playing && cursor.grab_mode == CursorGrabMode::Locked;
    let visibility = if should_show {
        Visibility::Visible
    } else {
        Visibility::Hidden
    };

    for mut crosshair_visibility in &mut crosshair_q {
        *crosshair_visibility = visibility;
    }
}

fn restart_input(
    keys: Res<ButtonInput<KeyCode>>,
    mut progress: ResMut<GameProgress>,
    mut pending_level: ResMut<PendingLevelLoad>,
) {
    if !keys.just_pressed(KeyCode::KeyR) {
        return;
    }

    match progress.mode {
        RoundMode::Playing => {
            pending_level.0 = Some(progress.level_index);
        }
        RoundMode::LevelCleared => {
            progress.next_level_index = None;
            pending_level.0 = Some(progress.level_index);
        }
        RoundMode::Lost | RoundMode::CampaignWon => {
            progress.total_score = 0;
            pending_level.0 = Some(0);
        }
    }
}

fn confirm_next_level_input(
    keys: Res<ButtonInput<KeyCode>>,
    mut progress: ResMut<GameProgress>,
    mut pending_level: ResMut<PendingLevelLoad>,
) {
    if progress.mode != RoundMode::LevelCleared {
        return;
    }

    if !(keys.just_pressed(KeyCode::Enter)
        || keys.just_pressed(KeyCode::NumpadEnter)
        || keys.just_pressed(KeyCode::KeyN))
    {
        return;
    }

    let Some(next) = progress.next_level_index.take() else {
        return;
    };
    pending_level.0 = Some(next);
}

fn apply_level_load(
    mut commands: Commands,
    mut pending_level: ResMut<PendingLevelLoad>,
    mut progress: ResMut<GameProgress>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut player_q: Query<(&mut Transform, &mut Player), With<MainCamera>>,
    level_entities: Query<Entity, With<LevelEntity>>,
) {
    let Some(next_level_index) = pending_level.0.take() else {
        return;
    };

    for entity in &level_entities {
        commands.entity(entity).despawn();
    }

    progress.level_index = next_level_index;
    progress.mode = RoundMode::Playing;
    progress.hp = PLAYER_MAX_HP;
    progress.level_kills = 0;
    progress.time_left = LEVELS[next_level_index].round_time;
    progress.spawn_timer = 0.0;
    progress.curse_color = None;
    progress.collected_rings = [false; ENEMY_COLOR_COUNT];
    progress.spawned_rings = [false; ENEMY_COLOR_COUNT];
    progress.prism_crystal_kills = 0;
    progress.lighthouse_activated = false;
    progress.day_beacon_active = false;
    progress.day_beacon_accumulator = 0.0;
    progress.next_level_index = None;
    progress.rift_angle = 0.0;
    progress.message = format!(
        "{} | {} | {}",
        LEVELS[next_level_index].label, LEVELS[next_level_index].name, objective_hint(&progress)
    );

    let Ok((mut player_tf, mut player)) = player_q.single_mut() else {
        return;
    };
    player_tf.translation = Vec3::new(0.0, PLAYER_HEIGHT, 18.0);
    player_tf.rotation = Quat::IDENTITY;
    player.yaw = 0.0;
    player.pitch = 0.0;
    player.velocity_y = 0.0;
    player.on_ground = true;

    spawn_base_arena(&mut commands, &mut meshes, &mut materials, &progress);
    spawn_lighthouse(&mut commands, &mut meshes, &mut materials);

    match LEVELS[progress.level_index].kind {
        LevelKind::Field => {
            spawn_obstacle_ring(&mut commands, &mut meshes, &mut materials, 10.0, 6, Color::srgb(0.35, 0.41, 0.35));
        }
        LevelKind::Lava => {
            spawn_obstacle_ring(&mut commands, &mut meshes, &mut materials, 12.0, 7, Color::srgb(0.50, 0.31, 0.24));
            spawn_lava_marker(&mut commands, &mut meshes, &mut materials);
        }
        LevelKind::Bleed => {
            spawn_obstacle_ring(&mut commands, &mut meshes, &mut materials, 11.0, 6, Color::srgb(0.38, 0.33, 0.33));
            spawn_health_packs(&mut commands, &mut meshes, &mut materials);
        }
        LevelKind::Shadow => {
            spawn_shadow_level(&mut commands, &mut meshes, &mut materials);
        }
        LevelKind::Chroma => {
            spawn_chroma_pillars(&mut commands, &mut meshes, &mut materials);
        }
        LevelKind::Eclipse => {
            spawn_chroma_pillars(&mut commands, &mut meshes, &mut materials);
            spawn_obstacle_ring(&mut commands, &mut meshes, &mut materials, 15.0, 8, Color::srgb(0.24, 0.31, 0.43));
        }
        LevelKind::Rift => {
            spawn_chroma_pillars(&mut commands, &mut meshes, &mut materials);
            spawn_obstacle_ring(&mut commands, &mut meshes, &mut materials, 16.0, 9, Color::srgb(0.18, 0.20, 0.35));
            spawn_dark_tide_zone(&mut commands, &mut meshes, &mut materials, Vec3::new(0.0, 0.02, 0.0));
        }
        LevelKind::Prism => {
            spawn_chroma_pillars(&mut commands, &mut meshes, &mut materials);
            spawn_obstacle_ring(&mut commands, &mut meshes, &mut materials, 17.0, 10, Color::srgb(0.22, 0.22, 0.46));
            spawn_dark_tide_zone(&mut commands, &mut meshes, &mut materials, Vec3::new(0.0, 0.02, 0.0));
        }
    }
}

fn spawn_base_arena(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    progress: &GameProgress,
) {
    let ground_color = match LEVELS[progress.level_index].kind {
        LevelKind::Field => Color::srgb(0.26, 0.36, 0.22),
        LevelKind::Lava => Color::srgb(0.33, 0.24, 0.18),
        LevelKind::Bleed => Color::srgb(0.30, 0.23, 0.23),
        LevelKind::Shadow => Color::srgb(0.91, 0.91, 0.91),
        LevelKind::Chroma => Color::srgb(0.84, 0.85, 0.88),
        LevelKind::Eclipse => Color::srgb(0.28, 0.29, 0.38),
        LevelKind::Rift => Color::srgb(0.17, 0.18, 0.30),
        LevelKind::Prism => Color::srgb(0.20, 0.20, 0.36),
    };

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(80.0, 0.2, 80.0))),
        MeshMaterial3d(materials.add(ground_color)),
        Transform::from_xyz(0.0, -0.1, 0.0),
        LevelEntity,
    ));
}

fn spawn_lighthouse(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(2.0, 8.0, 2.0))),
        MeshMaterial3d(materials.add(Color::srgb(0.85, 0.87, 0.96))),
        Transform::from_xyz(LIGHTHOUSE_POS.x, 4.0, LIGHTHOUSE_POS.z),
        LighthouseZone,
        LevelEntity,
    ));

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(6.0, 0.2, 6.0))),
        MeshMaterial3d(materials.add(Color::srgba(0.9, 0.8, 0.4, 0.35))),
        Transform::from_xyz(LIGHTHOUSE_POS.x, 0.05, LIGHTHOUSE_POS.z),
        LevelEntity,
    ));
}

fn spawn_lava_marker(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(56.0, 0.05, 56.0))),
        MeshMaterial3d(materials.add(Color::srgba(0.9, 0.36, 0.16, 0.24))),
        Transform::from_xyz(0.0, 0.02, 0.0),
        LevelEntity,
    ));
}

fn spawn_obstacle_ring(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    radius: f32,
    count: usize,
    color: Color,
) {
    for i in 0..count {
        let angle = i as f32 / count as f32 * PI * 2.0;
        let pos = Vec3::new(angle.cos() * radius, 1.4, angle.sin() * radius);
        commands.spawn((
            Mesh3d(meshes.add(Cuboid::new(2.4, 2.8, 2.4))),
            MeshMaterial3d(materials.add(color)),
            Transform::from_translation(pos),
            Obstacle { radius: 1.4 },
            LevelEntity,
        ));
    }
}

fn spawn_shadow_level(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let pillar_positions = [
        Vec3::new(-16.0, 5.0, -10.0),
        Vec3::new(-8.0, 5.0, 8.0),
        Vec3::new(2.0, 5.0, -14.0),
        Vec3::new(10.0, 5.0, 11.0),
        Vec3::new(17.0, 5.0, -2.0),
    ];

    let sun_dir = SUN_DIR_SHADOW_LEVEL.normalize();
    let shadow_shift = Vec3::new(-sun_dir.x, 0.0, -sun_dir.z) * 5.0;

    for pos in pillar_positions {
        commands.spawn((
            Mesh3d(meshes.add(Cuboid::new(2.6, 10.0, 2.6))),
            MeshMaterial3d(materials.add(Color::srgb(0.95, 0.95, 0.95))),
            Transform::from_translation(pos),
            Obstacle { radius: 1.55 },
            LevelEntity,
        ));

        commands.spawn((
            Mesh3d(meshes.add(Cuboid::new(6.0, 0.05, 6.0))),
            MeshMaterial3d(materials.add(Color::srgba(0.18, 0.21, 0.30, 0.22))),
            Transform::from_translation(Vec3::new(pos.x, 0.02, pos.z) + shadow_shift),
            ShadowZone { radius: 3.0 },
            LevelEntity,
        ));
    }
}

fn spawn_chroma_pillars(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let placements = [
        (EnemyColor::Blue, Vec3::new(-16.0, 2.5, -4.0)),
        (EnemyColor::Red, Vec3::new(-8.0, 2.5, 13.0)),
        (EnemyColor::Green, Vec3::new(4.0, 2.5, 15.0)),
        (EnemyColor::Black, Vec3::new(15.0, 2.5, 8.0)),
        (EnemyColor::Orange, Vec3::new(14.0, 2.5, -10.0)),
        (EnemyColor::Yellow, Vec3::new(-3.0, 2.5, -15.0)),
    ];

    for (color, pos) in placements {
        commands.spawn((
            Mesh3d(meshes.add(Cuboid::new(2.4, 5.0, 2.4))),
            MeshMaterial3d(materials.add(color.color())),
            Transform::from_translation(pos),
            Obstacle { radius: 1.3 },
            ColorPillar { color, radius: 2.2 },
            LevelEntity,
        ));
    }
}

fn spawn_health_packs(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    let mut rng = rand::rng();
    for _ in 0..6 {
        let x = rng.random_range(-22.0..22.0);
        let z = rng.random_range(-22.0..22.0);
        commands.spawn((
            Mesh3d(meshes.add(Cuboid::new(0.8, 0.8, 0.8))),
            MeshMaterial3d(materials.add(Color::srgb(1.0, 0.45, 0.72))),
            Transform::from_xyz(x, 0.4, z),
            Visibility::Visible,
            HealthPack {
                active: true,
                respawn_timer: 0.0,
            },
            LevelEntity,
        ));
    }
}

fn spawn_dark_tide_zone(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    center: Vec3,
) {
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(12.0, 0.04, 12.0))),
        MeshMaterial3d(materials.add(Color::srgba(0.10, 0.05, 0.20, 0.30))),
        Transform::from_translation(center),
        DarkTideZone { radius: 6.0 },
        LevelEntity,
    ));
}

fn mouse_look(
    accumulated_mouse_motion: Res<AccumulatedMouseMotion>,
    cursor_q: Query<&CursorOptions, With<PrimaryWindow>>,
    mut player_q: Query<&mut Player, With<MainCamera>>,
    progress: Res<GameProgress>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let Ok(cursor) = cursor_q.single() else {
        return;
    };

    if cursor.grab_mode != CursorGrabMode::Locked {
        return;
    }

    let Ok(mut player) = player_q.single_mut() else {
        return;
    };

    let delta = accumulated_mouse_motion.delta;

    if delta == Vec2::ZERO {
        return;
    }

    let sensitivity = 0.0026;
    player.yaw -= delta.x * sensitivity;
    player.pitch -= delta.y * sensitivity;
    player.pitch = player.pitch.clamp(-1.35, 1.35);
}

fn player_move(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    mut player_q: Query<(&mut Transform, &mut Player), (With<MainCamera>, Without<Obstacle>)>,
    obstacle_q: Query<(&Transform, &Obstacle), (With<LevelEntity>, Without<MainCamera>)>,
    progress: Res<GameProgress>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let Ok((mut tf, mut player)) = player_q.single_mut() else {
        return;
    };

    let dt = time.delta_secs();
    let yaw_rot = Quat::from_rotation_y(player.yaw);
    let forward = yaw_rot * Vec3::NEG_Z;
    let right = yaw_rot * Vec3::X;

    let mut move_dir = Vec3::ZERO;
    if keys.pressed(KeyCode::KeyW) {
        move_dir += forward;
    }
    if keys.pressed(KeyCode::KeyS) {
        move_dir -= forward;
    }
    if keys.pressed(KeyCode::KeyA) {
        move_dir -= right;
    }
    if keys.pressed(KeyCode::KeyD) {
        move_dir += right;
    }

    let mut next = tf.translation;
    if move_dir.length_squared() > 0.0 {
        next += move_dir.normalize() * PLAYER_MOVE_SPEED * dt;
    }

    for (obstacle_tf, obstacle) in &obstacle_q {
        let to_player = Vec2::new(next.x - obstacle_tf.translation.x, next.z - obstacle_tf.translation.z);
        let min_dist = PLAYER_RADIUS + obstacle.radius;
        let dist = to_player.length();
        if dist > 0.0001 && dist < min_dist {
            let push = to_player / dist * min_dist;
            next.x = obstacle_tf.translation.x + push.x;
            next.z = obstacle_tf.translation.z + push.y;
        }
    }

    next.x = next.x.clamp(-WORLD_CLAMP, WORLD_CLAMP);
    next.z = next.z.clamp(-WORLD_CLAMP, WORLD_CLAMP);

    if keys.pressed(KeyCode::Space) && player.on_ground {
        player.velocity_y = PLAYER_JUMP_SPEED;
        player.on_ground = false;
    }

    player.velocity_y -= PLAYER_GRAVITY * dt;
    next.y += player.velocity_y * dt;
    if next.y <= PLAYER_HEIGHT {
        next.y = PLAYER_HEIGHT;
        player.velocity_y = 0.0;
        player.on_ground = true;
    } else {
        player.on_ground = false;
    }

    tf.translation = next;
    tf.rotation = Quat::from_euler(EulerRot::YXZ, player.yaw, player.pitch, 0.0);
}

fn enemy_spawner(
    mut commands: Commands,
    mut progress: ResMut<GameProgress>,
    time: Res<Time>,
    player_q: Query<&Transform, With<MainCamera>>,
    enemies_q: Query<(), With<Enemy>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let level = LEVELS[progress.level_index];
    let cap_bonus = if matches!(level.kind, LevelKind::Rift | LevelKind::Prism) {
        4
    } else {
        0
    };
    let active_cap = ENEMY_MAX_ACTIVE_COUNT + cap_bonus;
    if enemies_q.iter().count() >= active_cap {
        return;
    }

    progress.spawn_timer += time.delta_secs();
    if progress.spawn_timer < ENEMY_SPAWN_INTERVAL_SECONDS {
        return;
    }
    progress.spawn_timer = 0.0;

    let Ok(player_tf) = player_q.single() else {
        return;
    };

    let mut rng = rand::rng();
    let angle = rng.random_range(0.0..(PI * 2.0));
    let distance = rng.random_range(14.0..28.0);
    let spawn = Vec3::new(
        player_tf.translation.x + angle.cos() * distance,
        0.8,
        player_tf.translation.z + angle.sin() * distance,
    );

    let enemy_color = match level.kind {
        LevelKind::Chroma | LevelKind::Eclipse | LevelKind::Rift | LevelKind::Prism => {
            let idx = rng.random_range(0..EnemyColor::ALL.len());
            Some(EnemyColor::ALL[idx])
        }
        _ => None,
    };

    let base_color = enemy_color
        .map(EnemyColor::color)
        .unwrap_or(Color::srgb(0.60, 0.16, 0.20));

    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(1.6, 1.6, 1.6))),
        MeshMaterial3d(materials.add(base_color)),
        Transform::from_translation(spawn),
        Enemy {
            speed: rng.random_range(1.8..3.0),
            color: enemy_color,
            touch_cooldown: rng.random_range(0.3..1.0),
        },
        LevelEntity,
    ));
}

fn enemy_update(
    mut enemies_q: Query<(&mut Transform, &mut Enemy), Without<MainCamera>>,
    player_q: Query<&Transform, (With<MainCamera>, Without<Enemy>)>,
    mut progress: ResMut<GameProgress>,
    time: Res<Time>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let Ok(player_tf) = player_q.single() else {
        return;
    };

    let dt = time.delta_secs();
    for (mut enemy_tf, mut enemy) in &mut enemies_q {
        let to_player = player_tf.translation - enemy_tf.translation;
        let distance = to_player.length();

        if distance > 1.5 {
            enemy_tf.translation += to_player.normalize_or_zero() * enemy.speed * dt;
        }

        enemy_tf.translation.y = 0.8;
        enemy.touch_cooldown -= dt;
        if distance < 1.9 && enemy.touch_cooldown <= 0.0 {
            enemy.touch_cooldown = 0.9;
            progress.hp -= ENEMY_TOUCH_DAMAGE;

            if is_color_curse_level(&progress) {
                if let Some(color) = enemy.color {
                    progress.curse_color = Some(color);
                }
            }
        }
    }
}

fn shooting(
    mut commands: Commands,
    mouse: Res<ButtonInput<MouseButton>>,
    progress: ResMut<GameProgress>,
    player_q: Query<&Transform, With<MainCamera>>,
    enemies_q: Query<(Entity, &Transform, &Enemy)>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    if !mouse.just_pressed(MouseButton::Left) {
        return;
    }

    let mut progress = progress;
    if progress.mode != RoundMode::Playing {
        return;
    }

    let Ok(player_tf) = player_q.single() else {
        return;
    };

    let forward = player_tf.forward().as_vec3();
    let origin = player_tf.translation;

    let mut best_hit: Option<(Entity, Vec3, Option<EnemyColor>, f32)> = None;
    for (entity, enemy_tf, enemy) in &enemies_q {
        let to_enemy = enemy_tf.translation - origin;
        let depth = to_enemy.dot(forward);
        if depth <= 0.0 || depth > 42.0 {
            continue;
        }

        let nearest_on_ray = origin + forward * depth;
        let miss = enemy_tf.translation.distance(nearest_on_ray);
        if miss > 1.2 {
            continue;
        }

        match best_hit {
            Some((_, _, _, current_depth)) if current_depth <= depth => {}
            _ => {
                best_hit = Some((entity, enemy_tf.translation, enemy.color, depth));
            }
        }
    }

    let Some((enemy_entity, hit_pos, hit_color, _)) = best_hit else {
        return;
    };

    commands.entity(enemy_entity).despawn();
    progress.total_score += 1;
    progress.level_kills += 1;

    let level = LEVELS[progress.level_index];

    if matches!(level.kind, LevelKind::Eclipse | LevelKind::Rift | LevelKind::Prism) {
        if let Some(color) = hit_color {
            let idx = color.index();
            if !progress.spawned_rings[idx] {
                progress.spawned_rings[idx] = true;
                spawn_ring(&mut commands, &mut meshes, &mut materials, color, hit_pos + Vec3::Y * 0.8);
            }
        }
    }

    if matches!(level.kind, LevelKind::Prism) && progress.lighthouse_activated {
        progress.prism_crystal_kills += 1;
    }
}

fn spawn_ring(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    color: EnemyColor,
    position: Vec3,
) {
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(0.8, 0.8, 0.8))),
        MeshMaterial3d(materials.add(color.color())),
        Transform::from_translation(position),
        RingPickup { color },
        LevelEntity,
    ));
}

fn pickups_and_objectives(
    mut commands: Commands,
    mut progress: ResMut<GameProgress>,
    time: Res<Time>,
    mut packs_q: Query<(Entity, &mut Transform, &mut HealthPack, &mut Visibility), With<HealthPack>>,
    mut rings_q: Query<(Entity, &Transform, &RingPickup), (With<RingPickup>, Without<HealthPack>)>,
    player_q: Query<&Transform, (With<MainCamera>, Without<HealthPack>)>,
    pillars_q: Query<(&Transform, &ColorPillar), (With<ColorPillar>, Without<HealthPack>)>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let Ok(player_tf) = player_q.single() else {
        return;
    };

    let level = LEVELS[progress.level_index];
    let dt = time.delta_secs();

    if matches!(level.kind, LevelKind::Bleed) {
        let mut rng = rand::rng();
        for (_, mut pack_tf, mut pack, mut visibility) in &mut packs_q {
            if pack.active {
                if player_tf.translation.distance(pack_tf.translation) < 1.3 {
                    progress.hp = (progress.hp + 30.0).min(PLAYER_MAX_HP);
                    pack.active = false;
                    pack.respawn_timer = 8.0;
                    *visibility = Visibility::Hidden;
                }
            } else {
                pack.respawn_timer -= dt;
                if pack.respawn_timer <= 0.0 {
                    pack.active = true;
                    pack_tf.translation = Vec3::new(
                        rng.random_range(-22.0..22.0),
                        0.4,
                        rng.random_range(-22.0..22.0),
                    );
                    *visibility = Visibility::Visible;
                }
            }
        }
    }

    for (entity, ring_tf, ring) in &mut rings_q {
        if player_tf.translation.distance(ring_tf.translation) < 1.4 {
            progress.collected_rings[ring.color.index()] = true;
            commands.entity(entity).despawn();
        }
    }

    if is_color_curse_level(&progress) {
        if let Some(curse) = progress.curse_color {
            for (pillar_tf, pillar) in &pillars_q {
                if pillar.color != curse {
                    continue;
                }
                if player_tf.translation.distance(pillar_tf.translation) < pillar.radius {
                    progress.curse_color = None;
                    progress.hp = PLAYER_MAX_HP;
                    break;
                }
            }
        }
    }
}

fn day_beacon_ritual(
    mut commands: Commands,
    time: Res<Time>,
    mut progress: ResMut<GameProgress>,
    player_q: Query<&Transform, With<MainCamera>>,
    enemies_q: Query<Entity, With<Enemy>>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let level = LEVELS[progress.level_index];
    let supports_ritual = matches!(level.kind, LevelKind::Bleed | LevelKind::Shadow)
        || matches!(level.kind, LevelKind::Prism) && progress.lighthouse_activated;

    if !supports_ritual {
        progress.day_beacon_active = false;
        progress.day_beacon_accumulator = 0.0;
        return;
    }

    let Ok(player_tf) = player_q.single() else {
        return;
    };
    let at_lighthouse = player_tf.translation.distance(Vec3::new(
        LIGHTHOUSE_POS.x,
        player_tf.translation.y,
        LIGHTHOUSE_POS.z,
    )) < LIGHTHOUSE_TRIGGER_RADIUS;

    let should_activate = match level.kind {
        LevelKind::Bleed | LevelKind::Shadow => at_lighthouse,
        LevelKind::Prism => progress.lighthouse_activated,
        _ => false,
    };

    if !should_activate {
        progress.day_beacon_active = false;
        progress.day_beacon_accumulator = 0.0;
        return;
    }

    if !progress.day_beacon_active {
        progress.day_beacon_active = true;
        progress.day_beacon_accumulator = 0.0;
        progress.message = if matches!(level.kind, LevelKind::Prism) {
            "灯塔净化光束已启动，结晶化敌人中！".to_string()
        } else {
            "信标净化已启动，正在结晶化敌人。".to_string()
        };
    }

    progress.day_beacon_accumulator += time.delta_secs();
    if progress.day_beacon_accumulator < DAY_BEACON_CRYSTALIZE_INTERVAL_SECONDS {
        return;
    }

    let ticks = (progress.day_beacon_accumulator / DAY_BEACON_CRYSTALIZE_INTERVAL_SECONDS).floor() as usize;
    progress.day_beacon_accumulator -= ticks as f32 * DAY_BEACON_CRYSTALIZE_INTERVAL_SECONDS;

    let mut candidates: Vec<Entity> = enemies_q.iter().collect();
    if candidates.is_empty() {
        return;
    }

    let mut rng = rand::rng();
    let eliminations = ticks.min(candidates.len());
    for _ in 0..eliminations {
        let idx = rng.random_range(0..candidates.len());
        let target = candidates.swap_remove(idx);
        commands.entity(target).despawn();
        progress.total_score += 1;
        progress.level_kills += 1;
        if matches!(level.kind, LevelKind::Prism) && progress.lighthouse_activated {
            progress.prism_crystal_kills += 1;
        }
    }
}

fn hazards(
    time: Res<Time>,
    mut progress: ResMut<GameProgress>,
    player_q: Query<&Transform, (With<MainCamera>, Without<DarkTideZone>)>,
    shadow_q: Query<(&Transform, &ShadowZone), (With<ShadowZone>, Without<DarkTideZone>)>,
    mut dark_tide_q: Query<(&mut Transform, &DarkTideZone)>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let Ok(player_tf) = player_q.single() else {
        return;
    };

    let level = LEVELS[progress.level_index];
    let dt = time.delta_secs();

    match level.kind {
        LevelKind::Lava => {
            let dist_center = player_tf.translation.xz().length();
            if dist_center > 18.0 {
                progress.hp -= LAVA_DAMAGE_PER_SECOND * dt;
            }
        }
        LevelKind::Bleed => {
            progress.hp -= BLEED_DAMAGE_PER_SECOND * dt;
        }
        LevelKind::Shadow => {
            let mut in_shadow = false;
            for (zone_tf, zone) in &shadow_q {
                let distance = player_tf.translation.distance(Vec3::new(
                    zone_tf.translation.x,
                    player_tf.translation.y,
                    zone_tf.translation.z,
                ));
                if distance < zone.radius {
                    in_shadow = true;
                    break;
                }
            }
            if !in_shadow {
                progress.hp -= SHADOW_DAMAGE_PER_SECOND * dt;
            }
        }
        LevelKind::Rift | LevelKind::Prism => {
            progress.rift_angle += dt * 0.55;
            let center = Vec3::new(progress.rift_angle.cos() * 15.0, 0.02, progress.rift_angle.sin() * 15.0);
            for (mut tf, zone) in &mut dark_tide_q {
                tf.translation = center;
                if player_tf.translation.distance(Vec3::new(center.x, player_tf.translation.y, center.z))
                    < zone.radius
                {
                    progress.hp -= DARK_TIDE_DAMAGE_PER_SECOND * dt;
                }
            }
        }
        _ => {}
    }

    if is_color_curse_level(&progress) && progress.curse_color.is_some() {
        progress.hp -= COLOR_CURSE_DAMAGE_PER_SECOND * dt;
    }

    progress.hp = progress.hp.clamp(0.0, PLAYER_MAX_HP);
}

fn level_progression(
    mut progress: ResMut<GameProgress>,
    mut pending_level: ResMut<PendingLevelLoad>,
    time: Res<Time>,
    player_q: Query<&Transform, With<MainCamera>>,
) {
    if progress.mode != RoundMode::Playing {
        return;
    }

    let level = LEVELS[progress.level_index];
    let dt = time.delta_secs();
    progress.time_left -= dt;

    if progress.hp <= 0.0 {
        progress.mode = RoundMode::Lost;
        progress.message = "你已失败，按 R 重开本关。".to_string();
        return;
    }

    let Ok(player_tf) = player_q.single() else {
        return;
    };
    let at_lighthouse = player_tf.translation.distance(Vec3::new(
        LIGHTHOUSE_POS.x,
        player_tf.translation.y,
        LIGHTHOUSE_POS.z,
    )) < LIGHTHOUSE_TRIGGER_RADIUS;

    let ring_count = progress.collected_rings.iter().filter(|&&v| v).count();
    let all_rings = ring_count >= SOLAR_RING_TARGET_COUNT;

    match level.kind {
        LevelKind::Field | LevelKind::Lava | LevelKind::Bleed | LevelKind::Shadow | LevelKind::Chroma => {
            if progress.level_kills >= level.enemy_goal || progress.time_left <= 0.0 {
                advance_level_or_finish(&mut progress, &mut pending_level);
                return;
            }
            if matches!(level.kind, LevelKind::Field | LevelKind::Lava) && at_lighthouse {
                advance_level_or_finish(&mut progress, &mut pending_level);
                return;
            }
        }
        LevelKind::Eclipse | LevelKind::Rift => {
            if progress.time_left <= 0.0 {
                progress.mode = RoundMode::Lost;
                progress.message = "超时失败，按 R 重开。".to_string();
                return;
            }
            if all_rings && at_lighthouse {
                advance_level_or_finish(&mut progress, &mut pending_level);
                return;
            }
        }
        LevelKind::Prism => {
            if progress.time_left <= 0.0 {
                progress.mode = RoundMode::Lost;
                progress.message = "终章超时失败，按 R 重开。".to_string();
                return;
            }

            if all_rings && at_lighthouse && !progress.lighthouse_activated {
                progress.lighthouse_activated = true;
                progress.message = "灯塔激活：继续击杀敌人完成结晶净化！".to_string();
            }

            if progress.lighthouse_activated && progress.prism_crystal_kills >= level.enemy_goal {
                progress.mode = RoundMode::CampaignWon;
                progress.message = "你通关了 Beaconfall！按 R 从第一关重新开始。".to_string();
            }
        }
    }
}

fn update_victory_overlay(
    progress: Res<GameProgress>,
    mut overlay_q: Query<&mut Visibility, With<VictoryOverlay>>,
    mut title_q: Query<&mut Text, With<VictoryOverlayTitle>>,
    mut hint_q: Query<&mut Text, With<VictoryOverlayHint>>,
) {
    let Ok(mut overlay_vis) = overlay_q.single_mut() else {
        return;
    };
    let Ok(mut title) = title_q.single_mut() else {
        return;
    };
    let Ok(mut hint) = hint_q.single_mut() else {
        return;
    };

    if progress.mode != RoundMode::LevelCleared {
        *overlay_vis = Visibility::Hidden;
        return;
    }

    *overlay_vis = Visibility::Visible;
    title.0 = format!("{} 胜利", LEVELS[progress.level_index].name);

    let next_name = progress
        .next_level_index
        .map(|idx| LEVELS[idx].name)
        .unwrap_or("下一关");
    hint.0 = format!(
        "按 Enter / N 确认进入 {next_name}\n按 R 重打本关"
    );
}

fn advance_level_or_finish(progress: &mut GameProgress, pending_level: &mut PendingLevelLoad) {
    if progress.level_index + 1 >= LEVELS.len() {
        progress.mode = RoundMode::CampaignWon;
        progress.message = "你通关了 Beaconfall！按 R 从第一关重新开始。".to_string();
        return;
    }

    let cleared = LEVELS[progress.level_index];
    let next = progress.level_index + 1;
    progress.mode = RoundMode::LevelCleared;
    progress.next_level_index = Some(next);
    progress.message = format!(
        "{} 胜利！按 Enter / N 确认进入 {}（按 R 可重打本关）",
        cleared.name, LEVELS[next].name
    );
    pending_level.0 = None;
}

fn update_hud(
    progress: Res<GameProgress>,
    enemies_q: Query<(), With<Enemy>>,
    mut hud_q: Query<&mut Text, (With<HudText>, Without<MessageText>)>,
    mut msg_q: Query<&mut Text, (With<MessageText>, Without<HudText>)>,
) {
    let Ok(mut hud) = hud_q.single_mut() else {
        return;
    };
    let Ok(mut msg) = msg_q.single_mut() else {
        return;
    };

    let level = LEVELS[progress.level_index];
    let enemy_count = enemies_q.iter().count();
    let collected_ring_colors = EnemyColor::ALL
        .iter()
        .filter(|&&color| progress.collected_rings[color.index()])
        .map(|color| color.name())
        .collect::<Vec<_>>();
    let ring_status = if collected_ring_colors.is_empty() {
        "无".to_string()
    } else {
        collected_ring_colors.join("/")
    };
    let ring_count = collected_ring_colors.len();

    let curse = progress
        .curse_color
        .map(|c| c.name())
        .unwrap_or("白");

    let objective = objective_hint(&progress);

    hud.0 = format!(
        "HP: {:>3} | SCORE: {} | ENEMIES: {} | TIME: {:>3} | LEVEL: {} ({}) | CURSE: {} | RINGS: {}/{} ({})\n{}\n操作: WASD 移动 | Space 跳跃 | 鼠标左键射击/锁定视角 | Esc 释放鼠标 | R 重开",
        progress.hp.ceil() as i32,
        progress.total_score,
        enemy_count,
        progress.time_left.max(0.0).ceil() as i32,
        level.label,
        level.id,
        curse,
        ring_count,
        SOLAR_RING_TARGET_COUNT,
        ring_status,
        objective,
    );

    let rings = progress.collected_rings.iter().filter(|&&v| v).count();
    let live_progress = match level.kind {
        LevelKind::Field | LevelKind::Lava | LevelKind::Bleed | LevelKind::Shadow | LevelKind::Chroma => {
            format!("实时进度: 击杀 {} / {}", progress.level_kills, level.enemy_goal)
        }
        LevelKind::Eclipse => {
            format!(
                "实时进度: 圆环 {} / {}，前往灯塔撤离",
                rings, SOLAR_RING_TARGET_COUNT
            )
        }
        LevelKind::Rift => {
            format!(
                "实时进度: 圆环 {} / {}，前往灯塔触发净化",
                rings, SOLAR_RING_TARGET_COUNT
            )
        }
        LevelKind::Prism => {
            if progress.lighthouse_activated {
                format!(
                    "实时进度: 净化结晶击杀 {} / {}",
                    progress.prism_crystal_kills, level.enemy_goal
                )
            } else {
                format!(
                    "实时进度: 圆环 {} / {}，激活灯塔后进入净化",
                    rings, SOLAR_RING_TARGET_COUNT
                )
            }
        }
    };

    msg.0 = if progress.mode == RoundMode::Playing {
        format!("{} | {}", progress.message, live_progress)
    } else {
        progress.message.clone()
    };
}

fn objective_hint(progress: &GameProgress) -> String {
    let level = LEVELS[progress.level_index];
    match level.kind {
        LevelKind::Field | LevelKind::Lava => format!(
            "目标: 击杀 {} / {}，或存活到计时结束，或到灯塔撤离",
            progress.level_kills, level.enemy_goal
        ),
        LevelKind::Bleed | LevelKind::Shadow => format!(
            "目标: 击杀 {} / {}，或存活到计时结束（可到灯塔触发信标净化）",
            progress.level_kills, level.enemy_goal
        ),
        LevelKind::Chroma => format!(
            "目标: 击杀 {} / {}，或存活到计时结束",
            progress.level_kills, level.enemy_goal
        ),
        LevelKind::Eclipse => {
            let rings = progress.collected_rings.iter().filter(|&&v| v).count();
            format!(
                "目标: 收集任意三色圆环（{rings}/{SOLAR_RING_TARGET_COUNT}）并抵达灯塔撤离"
            )
        }
        LevelKind::Rift => {
            let rings = progress.collected_rings.iter().filter(|&&v| v).count();
            format!(
                "目标: 收集任意三色圆环（{rings}/{SOLAR_RING_TARGET_COUNT}）并前往灯塔触发净化"
            )
        }
        LevelKind::Prism => {
            let rings = progress.collected_rings.iter().filter(|&&v| v).count();
            if progress.lighthouse_activated {
                format!(
                    "目标: 净化进行中 {} / {}",
                    progress.prism_crystal_kills, level.enemy_goal
                )
            } else {
                format!(
                    "目标: 收集任意三色圆环（{rings}/{SOLAR_RING_TARGET_COUNT}）并激活灯塔"
                )
            }
        }
    }
}

fn is_color_curse_level(progress: &GameProgress) -> bool {
    matches!(
        LEVELS[progress.level_index].kind,
        LevelKind::Chroma | LevelKind::Prism
    )
}
