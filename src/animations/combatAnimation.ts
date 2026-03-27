export type CombatIntroState = {
    active: boolean;
    triggerKey: number;
    startSec: number;
    durationSec: number;
    intensity: number;
};

export type CombatActionKind = "attack" | "critical" | "skill" | "scroll";

export type ResourcePulseTone = "gain" | "loss" | "mixed";

export type ResourcePulseState = {
    active: boolean;
    triggerKey: number;
    tone: ResourcePulseTone;
    power: number;
    startSec: number;
    durationSec: number;
};

export type CombatActionState = {
    active: boolean;
    triggerKey: number;
    kind: CombatActionKind;
    startSec: number;
    durationSec: number;
    intensity: number;
};

export type CombatActionFrame = {
    active: boolean;
    kind: CombatActionKind;
    progress: number;
    slashX: number;
    slashAlpha: number;
    ringRadius: number;
    ringAlpha: number;
    shakeX: number;
};

export type ResourcePulseFrame = {
    active: boolean;
    tone: ResourcePulseTone;
    progress: number;
    glowAlpha: number;
    ringRadius: number;
    ringAlpha: number;
};

export type CombatIntroFrame = {
    active: boolean;
    phase: "idle" | "entering" | "settle";
    progress: number;
    coreScale: number;
    ringRadius: number;
    ringAlpha: number;
    glowAlpha: number;
    shakeX: number;
    shakeY: number;
};

type CombatIntroConfig = {
    durationSec?: number;
    intensity?: number;
};

type CombatActionConfig = {
    durationSec?: number;
    intensity?: number;
};

type ResourcePulseConfig = {
    durationSec?: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);

const getPulsePalette = (tone: ResourcePulseTone): [number, number, number] => {
    switch (tone) {
        case "gain":
            return [112, 255, 186];
        case "loss":
            return [255, 114, 114];
        case "mixed":
        default:
            return [255, 210, 122];
    }
};

const getActionDurationSec = (kind: CombatActionKind): number => {
    switch (kind) {
        case "critical":
            return 0.32;
        case "skill":
            return 0.3;
        case "scroll":
            return 0.34;
        case "attack":
        default:
            return 0.24;
    }
};

const getActionPalette = (kind: CombatActionKind): [number, number, number] => {
    switch (kind) {
        case "critical":
            return [255, 108, 92];
        case "skill":
            return [120, 232, 255];
        case "scroll":
            return [204, 166, 255];
        case "attack":
        default:
            return [255, 196, 120];
    }
};

export function createCombatIntroState(config: CombatIntroConfig = {}): CombatIntroState {
    return {
        active: false,
        triggerKey: 0,
        startSec: 0,
        durationSec: clamp(config.durationSec ?? 0.44, 0.25, 1.2),
        intensity: clamp(config.intensity ?? 1, 0.5, 2),
    };
}

export function createCombatActionState(config: CombatActionConfig = {}): CombatActionState {
    return {
        active: false,
        triggerKey: 0,
        kind: "attack",
        startSec: 0,
        durationSec: clamp(config.durationSec ?? 0.26, 0.18, 0.8),
        intensity: clamp(config.intensity ?? 1, 0.5, 2),
    };
}

export function createResourcePulseState(config: ResourcePulseConfig = {}): ResourcePulseState {
    return {
        active: false,
        triggerKey: 0,
        tone: "gain",
        power: 0.6,
        startSec: 0,
        durationSec: clamp(config.durationSec ?? 0.32, 0.16, 0.9),
    };
}

export function syncCombatIntroTrigger(state: CombatIntroState, triggerKey: number, nowSec: number): void {
    if (triggerKey === state.triggerKey) return;

    state.triggerKey = triggerKey;
    if (triggerKey <= 0) return;

    state.startSec = nowSec;
    state.active = true;
}

export function syncCombatActionTrigger(
    state: CombatActionState,
    triggerKey: number,
    kind: CombatActionKind,
    nowSec: number,
): void {
    if (triggerKey === state.triggerKey) return;

    state.triggerKey = triggerKey;
    if (triggerKey <= 0) return;

    state.kind = kind;
    state.durationSec = getActionDurationSec(kind);
    state.startSec = nowSec;
    state.active = true;
}

export function syncResourcePulseTrigger(
    state: ResourcePulseState,
    triggerKey: number,
    tone: ResourcePulseTone,
    power: number,
    nowSec: number,
): void {
    if (triggerKey === state.triggerKey) return;

    state.triggerKey = triggerKey;
    if (triggerKey <= 0) return;

    state.tone = tone;
    state.power = clamp(power, 0.2, 1);
    state.startSec = nowSec;
    state.active = true;
}

export function sampleCombatIntro(state: CombatIntroState, nowSec: number): CombatIntroFrame {
    if (!state.active) {
        return {
            active: false,
            phase: "idle",
            progress: 0,
            coreScale: 1,
            ringRadius: 0,
            ringAlpha: 0,
            glowAlpha: 0,
            shakeX: 0,
            shakeY: 0,
        };
    }

    const elapsedSec = Math.max(0, nowSec - state.startSec);
    const progress = clamp(elapsedSec / state.durationSec, 0, 1);
    const eased = easeOutCubic(progress);
    const wobble = Math.sin(progress * Math.PI * 12) * (1 - progress);
    const shakeBase = wobble * 8 * state.intensity;
    const phase = progress < 0.68 ? "entering" : "settle";

    const frame: CombatIntroFrame = {
        active: true,
        phase,
        progress,
        coreScale: 0.65 + eased * 0.62 + wobble * 0.06,
        ringRadius: 20 + eased * 220,
        ringAlpha: Math.pow(1 - progress, 1.8),
        glowAlpha: 0.2 + Math.pow(1 - progress, 1.2) * 0.7,
        shakeX: shakeBase,
        shakeY: shakeBase * 0.4,
    };

    if (progress >= 1) {
        state.active = false;
    }

    return frame;
}

export function sampleCombatAction(state: CombatActionState, nowSec: number): CombatActionFrame {
    if (!state.active) {
        return {
            active: false,
            kind: state.kind,
            progress: 0,
            slashX: 0,
            slashAlpha: 0,
            ringRadius: 0,
            ringAlpha: 0,
            shakeX: 0,
        };
    }

    const elapsedSec = Math.max(0, nowSec - state.startSec);
    const progress = clamp(elapsedSec / state.durationSec, 0, 1);
    const eased = easeOutCubic(progress);
    const shake = Math.sin(progress * Math.PI * 10) * (1 - progress) * 7 * state.intensity;

    const frame: CombatActionFrame = {
        active: true,
        kind: state.kind,
        progress,
        slashX: 0.15 + eased * 0.78,
        slashAlpha: Math.pow(1 - progress, 1.15),
        ringRadius: 24 + eased * 170,
        ringAlpha: Math.pow(1 - progress, 1.65),
        shakeX: shake,
    };

    if (progress >= 1) {
        state.active = false;
    }

    return frame;
}

export function sampleResourcePulse(state: ResourcePulseState, nowSec: number): ResourcePulseFrame {
    if (!state.active) {
        return {
            active: false,
            tone: state.tone,
            progress: 0,
            glowAlpha: 0,
            ringRadius: 0,
            ringAlpha: 0,
        };
    }

    const elapsedSec = Math.max(0, nowSec - state.startSec);
    const progress = clamp(elapsedSec / state.durationSec, 0, 1);
    const eased = easeOutCubic(progress);

    const frame: ResourcePulseFrame = {
        active: true,
        tone: state.tone,
        progress,
        glowAlpha: (0.1 + Math.pow(1 - progress, 1.2) * 0.4) * state.power,
        ringRadius: 18 + eased * 180,
        ringAlpha: Math.pow(1 - progress, 1.75) * state.power,
    };

    if (progress >= 1) {
        state.active = false;
    }

    return frame;
}

export function drawCombatIntroOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: CombatIntroFrame,
    dangerLevel: number,
    lowFx: boolean,
): void {
    if (!frame.active) return;

    const intensityScale = lowFx ? 0.65 : 1;
    const centerX = width * 0.5 + frame.shakeX * intensityScale;
    const centerY = height * 0.5 + frame.shakeY * intensityScale;

    const dangerTint = clamp(dangerLevel / 5, 0, 1);
    const ringR = Math.floor(255 - dangerTint * 35);
    const ringG = Math.floor(132 - dangerTint * 45);
    const ringB = Math.floor(88 + dangerTint * 65);

    const ringLine = lowFx ? 2 : 3;
    const ringRadius = frame.ringRadius * intensityScale;
    const coreSize = (22 + frame.coreScale * 28) * intensityScale;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, ${frame.ringAlpha.toFixed(3)})`;
    ctx.lineWidth = ringLine;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    const glow = ctx.createRadialGradient(centerX, centerY, coreSize * 0.2, centerX, centerY, coreSize * 2.6);
    glow.addColorStop(0, `rgba(255, 224, 188, ${(frame.glowAlpha * 0.9).toFixed(3)})`);
    glow.addColorStop(1, "rgba(255, 120, 90, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(centerX - coreSize * 3, centerY - coreSize * 3, coreSize * 6, coreSize * 6);

    ctx.fillStyle = `rgba(255, ${Math.floor(140 + dangerTint * 50)}, 115, ${(frame.glowAlpha * 0.95).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - coreSize * 1.2);
    ctx.lineTo(centerX + coreSize * 0.8, centerY - coreSize * 0.15);
    ctx.lineTo(centerX + coreSize * 0.55, centerY + coreSize * 1.05);
    ctx.lineTo(centerX, centerY + coreSize * 1.35);
    ctx.lineTo(centerX - coreSize * 0.55, centerY + coreSize * 1.05);
    ctx.lineTo(centerX - coreSize * 0.8, centerY - coreSize * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    const flashAlpha = lowFx ? frame.glowAlpha * 0.08 : frame.glowAlpha * 0.14;
    ctx.fillStyle = `rgba(255, 246, 224, ${flashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
}

export function drawCombatActionOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: CombatActionFrame,
    lowFx: boolean,
): void {
    if (!frame.active) return;

    const [r, g, b] = getActionPalette(frame.kind);
    const intensityScale = lowFx ? 0.72 : 1;
    const slashX = width * frame.slashX + frame.shakeX * intensityScale;
    const slashLength = width * (lowFx ? 0.34 : 0.42);
    const slashHalf = slashLength * 0.5;
    const centerY = height * 0.52;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.slashAlpha * 0.92).toFixed(3)})`;
    ctx.lineWidth = lowFx ? 4 : 6;
    ctx.beginPath();
    ctx.moveTo(slashX - slashHalf, centerY - height * 0.24);
    ctx.lineTo(slashX + slashHalf, centerY + height * 0.24);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.ringAlpha * 0.78).toFixed(3)})`;
    ctx.lineWidth = lowFx ? 2 : 3;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.5, frame.ringRadius * intensityScale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    const flashAlpha = lowFx ? frame.slashAlpha * 0.08 : frame.slashAlpha * 0.13;
    ctx.fillStyle = `rgba(${Math.min(255, r + 28)}, ${Math.min(255, g + 28)}, ${Math.min(255, b + 28)}, ${flashAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
}

export function drawResourcePulseOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    frame: ResourcePulseFrame,
    lowFx: boolean,
): void {
    if (!frame.active) return;

    const [r, g, b] = getPulsePalette(frame.tone);
    const scale = lowFx ? 0.78 : 1;
    const ringRadius = frame.ringRadius * scale;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.ringAlpha * 0.84).toFixed(3)})`;
    ctx.lineWidth = lowFx ? 2 : 3;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.5, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(frame.ringAlpha * 0.6).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(width * 0.08, height * 0.28);
    ctx.lineTo(width * 0.92, height * 0.28);
    ctx.moveTo(width * 0.08, height * 0.72);
    ctx.lineTo(width * 0.92, height * 0.72);
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(frame.glowAlpha * 0.22).toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
}
