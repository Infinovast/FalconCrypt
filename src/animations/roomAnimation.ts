import type { RoomEventType } from "../game/types";

export type RoomIntroKind = RoomEventType;

export type RoomIntroState = {
    active: boolean;
    triggerKey: number;
    kind: RoomIntroKind;
    startSec: number;
    durationSec: number;
    intensity: number;
};

export type RoomIntroFrame = {
    active: boolean;
    kind: RoomIntroKind;
    progress: number;
    waveRadius: number;
    waveAlpha: number;
    coreScale: number;
    shimmerAlpha: number;
    shakeX: number;
};

type RoomIntroConfig = {
    durationSec?: number;
    intensity?: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);

const getRoomIntroDurationSec = (kind: RoomIntroKind): number => {
    switch (kind) {
        case "boss_event":
            return 0.46;
        case "statue_event":
            return 0.42;
        case "shop_event":
            return 0.36;
        case "monster_event":
        case "bonfire_event":
            return 0.34;
        case "chest_event":
        case "forge_event":
            return 0.32;
        case "mine_event":
            return 0.31;
        case "branch_event":
            return 0.28;
        case "trap_event":
            return 0.26;
        default:
            return 0.34;
    }
};

const getRoomIntroPalette = (kind: RoomIntroKind): [number, number, number] => {
    switch (kind) {
        case "monster_event":
            return [255, 124, 96];
        case "boss_event":
            return [255, 80, 132];
        case "branch_event":
            return [96, 226, 188];
        case "chest_event":
            return [255, 210, 110];
        case "trap_event":
            return [255, 106, 176];
        case "shop_event":
            return [122, 218, 255];
        case "bonfire_event":
            return [255, 148, 94];
        case "forge_event":
            return [170, 188, 212];
        case "statue_event":
            return [214, 152, 255];
        case "mine_event":
            return [200, 172, 120];
        default:
            return [180, 216, 255];
    }
};

const getRoomIntroShape = (
    kind: RoomIntroKind,
): "diamond" | "beam" | "halo" | "boss_sigil" | "branch_bonfire" | "shop_forge" => {
    switch (kind) {
        case "trap_event":
        case "monster_event":
            return "beam";
        case "boss_event":
            return "boss_sigil";
        case "branch_event":
        case "bonfire_event":
            return "branch_bonfire";
        case "shop_event":
        case "forge_event":
            return "shop_forge";
        case "statue_event":
            return "halo";
        default:
            return "diamond";
    }
};

export function createRoomIntroState(config: RoomIntroConfig = {}): RoomIntroState {
    return {
        active: false,
        triggerKey: 0,
        kind: "branch_event",
        startSec: 0,
        durationSec: clamp(config.durationSec ?? 0.34, 0.22, 1.2),
        intensity: clamp(config.intensity ?? 1, 0.5, 2),
    };
}

export function syncRoomIntroTrigger(state: RoomIntroState, triggerKey: number, kind: RoomIntroKind, nowSec: number): void {
    if (triggerKey === state.triggerKey) return;

    state.triggerKey = triggerKey;
    if (triggerKey <= 0) return;

    state.kind = kind;
    state.durationSec = getRoomIntroDurationSec(kind);
    state.startSec = nowSec;
    state.active = true;
}

export function sampleRoomIntro(state: RoomIntroState, nowSec: number): RoomIntroFrame {
    if (!state.active) {
        return {
            active: false,
            kind: state.kind,
            progress: 0,
            waveRadius: 0,
            waveAlpha: 0,
            coreScale: 1,
            shimmerAlpha: 0,
            shakeX: 0,
        };
    }

    const elapsedSec = Math.max(0, nowSec - state.startSec);
    const progress = clamp(elapsedSec / state.durationSec, 0, 1);
    const eased = easeOutCubic(progress);
    const waveAlpha = Math.pow(1 - progress, 1.55);
    const shakeX = Math.sin(progress * Math.PI * 9) * (1 - progress) * 5 * state.intensity;

    const frame: RoomIntroFrame = {
        active: true,
        kind: state.kind,
        progress,
        waveRadius: 16 + eased * 200,
        waveAlpha,
        coreScale: 0.8 + eased * 0.5,
        shimmerAlpha: 0.16 + Math.pow(1 - progress, 1.25) * 0.46,
        shakeX,
    };

    if (progress >= 1) {
        state.active = false;
    }

    return frame;
}

export function drawRoomIntroOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: RoomIntroFrame,
    lowFx: boolean,
): void {
    if (!frame.active) return;

    const [r, g, b] = getRoomIntroPalette(frame.kind);
    const shape = getRoomIntroShape(frame.kind);
    const scale = lowFx ? 0.72 : 1;
    const centerX = width * 0.5 + frame.shakeX * scale;
    const centerY = height * 0.5;
    const radius = frame.waveRadius * scale;
    const core = (20 + frame.coreScale * 26) * scale;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.waveAlpha * 0.88).toFixed(3)})`;
    ctx.lineWidth = lowFx ? 2 : 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (shape === "beam") {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.9).toFixed(3)})`;
        ctx.lineWidth = lowFx ? 4 : 6;
        ctx.beginPath();
        ctx.moveTo(centerX - core * 1.5, centerY - core * 1.2);
        ctx.lineTo(centerX + core * 1.3, centerY + core * 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX - core * 1.2, centerY + core * 1.3);
        ctx.lineTo(centerX + core * 1.45, centerY - core * 1.15);
        ctx.stroke();
    } else if (shape === "boss_sigil") {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.95).toFixed(3)})`;
        ctx.lineWidth = lowFx ? 2 : 3;

        // Outer ring with rotating notch for an unmistakable boss intro.
        const ringRadius = core * 1.8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, frame.progress * Math.PI * 2, frame.progress * Math.PI * 2 + Math.PI * 1.7);
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < 5; i += 1) {
            const angle = frame.progress * 0.8 + (Math.PI * 2 * i) / 5;
            const outer = core * 1.25;
            const inner = core * 0.55;
            const px = centerX + Math.cos(angle) * outer;
            const py = centerY + Math.sin(angle) * outer;
            const qx = centerX + Math.cos(angle + Math.PI / 5) * inner;
            const qy = centerY + Math.sin(angle + Math.PI / 5) * inner;
            if (i === 0) ctx.moveTo(px, py);
            ctx.lineTo(qx, qy);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.38).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, core * 0.62, 0, Math.PI * 2);
        ctx.fill();
    } else if (shape === "branch_bonfire") {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.82).toFixed(3)})`;
        ctx.lineWidth = lowFx ? 2 : 3;

        // Split path motif for branch/bonfire room entry.
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + core * 1.35);
        ctx.lineTo(centerX, centerY - core * 0.2);
        ctx.lineTo(centerX - core * 1.05, centerY - core * 1.05);
        ctx.moveTo(centerX, centerY - core * 0.2);
        ctx.lineTo(centerX + core * 1.05, centerY - core * 1.05);
        ctx.stroke();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.48).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - core * 0.92);
        ctx.lineTo(centerX + core * 0.42, centerY - core * 0.1);
        ctx.lineTo(centerX, centerY + core * 0.25);
        ctx.lineTo(centerX - core * 0.42, centerY - core * 0.1);
        ctx.closePath();
        ctx.fill();
    } else if (shape === "shop_forge") {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.84).toFixed(3)})`;
        ctx.lineWidth = lowFx ? 2 : 3;

        // Industrial bracket motif for shop/forge room entry.
        const boxW = core * 1.9;
        const boxH = core * 1.2;
        const wobble = Math.sin(frame.progress * Math.PI * 4) * core * 0.08;

        ctx.beginPath();
        ctx.rect(centerX - boxW * 0.5, centerY - boxH * 0.5 + wobble, boxW, boxH);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX - boxW * 0.35, centerY - boxH * 0.78 + wobble);
        ctx.lineTo(centerX + boxW * 0.35, centerY - boxH * 0.78 + wobble);
        ctx.stroke();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.44).toFixed(3)})`;
        ctx.beginPath();
        ctx.rect(centerX - boxW * 0.18, centerY - boxH * 0.18 + wobble, boxW * 0.36, boxH * 0.36);
        ctx.fill();
    } else if (shape === "halo") {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.82).toFixed(3)})`;
        ctx.lineWidth = lowFx ? 2 : 3;
        for (let i = 0; i < 3; i += 1) {
            const phase = frame.progress * Math.PI * 2 + i * (Math.PI * 0.66);
            const arcRadius = core * (1 + i * 0.42);
            ctx.beginPath();
            ctx.arc(centerX, centerY, arcRadius, phase, phase + Math.PI * 0.9);
            ctx.stroke();
        }
    } else {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(frame.shimmerAlpha * 0.68).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - core * 1.2);
        ctx.lineTo(centerX + core * 0.95, centerY);
        ctx.lineTo(centerX, centerY + core * 1.2);
        ctx.lineTo(centerX - core * 0.95, centerY);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}
