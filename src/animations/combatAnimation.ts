export type CombatIntroState = {
    active: boolean;
    triggerKey: number;
    startSec: number;
    durationSec: number;
    intensity: number;
};

export type CombatActionKind =
    | "attack"
    | "critical"
    | "skill"
    | "skillPaladin"
    | "skillPriest"
    | "skillAssassin"
    | "scroll"
    | "scrollFire"
    | "scrollFrost"
    | "scrollHeal"
    | "scrollStealth";

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

const TAU = Math.PI * 2;

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
        case "skillPaladin":
            return 0.38;
        case "skillPriest":
            return 0.34;
        case "skillAssassin":
            return 0.28;
        case "skill":
            return 0.3;
        case "scrollFire":
            return 0.36;
        case "scrollFrost":
            return 0.38;
        case "scrollHeal":
            return 0.4;
        case "scrollStealth":
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
        case "skillPaladin":
            return [112, 255, 208];
        case "skillPriest":
            return [255, 126, 158];
        case "skillAssassin":
            return [170, 245, 122];
        case "skill":
            return [120, 232, 255];
        case "scrollFire":
            return [255, 148, 84];
        case "scrollFrost":
            return [132, 220, 255];
        case "scrollHeal":
            return [150, 255, 182];
        case "scrollStealth":
            return [172, 184, 255];
        case "scroll":
            return [204, 166, 255];
        case "attack":
        default:
            return [255, 196, 120];
    }
};

type CombatActionMotionProfile = {
    slashStart: number;
    slashTravel: number;
    ringGrow: number;
    shakePower: number;
    slashFadePow: number;
    ringFadePow: number;
};

const getActionMotionProfile = (kind: CombatActionKind): CombatActionMotionProfile => {
    switch (kind) {
        case "critical":
            return {
                slashStart: 0.08,
                slashTravel: 0.86,
                ringGrow: 210,
                shakePower: 10,
                slashFadePow: 1.05,
                ringFadePow: 1.45,
            };
        case "skill":
            return {
                slashStart: 0.2,
                slashTravel: 0.65,
                ringGrow: 190,
                shakePower: 5,
                slashFadePow: 1.3,
                ringFadePow: 1.55,
            };
        case "skillPaladin":
            return {
                slashStart: 0.18,
                slashTravel: 0.62,
                ringGrow: 200,
                shakePower: 4.2,
                slashFadePow: 1.35,
                ringFadePow: 1.5,
            };
        case "skillPriest":
            return {
                slashStart: 0.24,
                slashTravel: 0.54,
                ringGrow: 180,
                shakePower: 4.8,
                slashFadePow: 1.28,
                ringFadePow: 1.58,
            };
        case "skillAssassin":
            return {
                slashStart: 0.12,
                slashTravel: 0.88,
                ringGrow: 164,
                shakePower: 8.8,
                slashFadePow: 1.08,
                ringFadePow: 1.7,
            };
        case "scroll":
            return {
                slashStart: 0.16,
                slashTravel: 0.8,
                ringGrow: 180,
                shakePower: 6.5,
                slashFadePow: 1.12,
                ringFadePow: 1.65,
            };
        case "scrollFire":
            return {
                slashStart: 0.14,
                slashTravel: 0.82,
                ringGrow: 196,
                shakePower: 7.4,
                slashFadePow: 1.06,
                ringFadePow: 1.55,
            };
        case "scrollFrost":
            return {
                slashStart: 0.1,
                slashTravel: 0.7,
                ringGrow: 214,
                shakePower: 4.5,
                slashFadePow: 1.2,
                ringFadePow: 1.48,
            };
        case "scrollHeal":
            return {
                slashStart: 0.24,
                slashTravel: 0.5,
                ringGrow: 220,
                shakePower: 3.4,
                slashFadePow: 1.4,
                ringFadePow: 1.42,
            };
        case "scrollStealth":
            return {
                slashStart: 0.22,
                slashTravel: 0.4,
                ringGrow: 150,
                shakePower: 2.8,
                slashFadePow: 1.6,
                ringFadePow: 1.9,
            };
        case "attack":
        default:
            return {
                slashStart: 0.15,
                slashTravel: 0.78,
                ringGrow: 170,
                shakePower: 7,
                slashFadePow: 1.15,
                ringFadePow: 1.65,
            };
    }
};

const traceRegularPolygon = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number,
    sides: number,
    rotationRad: number,
): void => {
    const edgeCount = Math.max(3, Math.floor(sides));
    ctx.beginPath();
    for (let i = 0; i < edgeCount; i += 1) {
        const angle = rotationRad + (i / edgeCount) * TAU;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
};

const traceStarPolygon = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    outerRadius: number,
    innerRadius: number,
    points: number,
    rotationRad: number,
): void => {
    const tipCount = Math.max(3, Math.floor(points));
    ctx.beginPath();
    for (let i = 0; i < tipCount * 2; i += 1) {
        const useOuter = i % 2 === 0;
        const radius = useOuter ? outerRadius : innerRadius;
        const angle = rotationRad + (i / (tipCount * 2)) * TAU;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
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
    const motion = getActionMotionProfile(state.kind);
    const shake = Math.sin(progress * Math.PI * 10) * (1 - progress) * motion.shakePower * state.intensity;

    const frame: CombatActionFrame = {
        active: true,
        kind: state.kind,
        progress,
        slashX: motion.slashStart + eased * motion.slashTravel,
        slashAlpha: Math.pow(1 - progress, motion.slashFadePow),
        ringRadius: 24 + eased * motion.ringGrow,
        ringAlpha: Math.pow(1 - progress, motion.ringFadePow),
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
    const centerX = width * 0.5 + frame.shakeX * intensityScale * 0.5;
    const centerY = height * 0.5;
    const travelX = width * frame.slashX + frame.shakeX * intensityScale;
    const baseRadius = Math.max(14, frame.ringRadius * (lowFx ? 0.38 : 0.46));
    const spin = frame.progress * TAU * (lowFx ? 0.78 : 1.08);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const strokeShape = (alpha: number, widthScale: number, trace: () => void): void => {
        if (alpha <= 0) return;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = (lowFx ? 2 : 3) * widthScale;
        trace();
        ctx.stroke();
    };

    const fillShape = (alpha: number, trace: () => void): void => {
        if (alpha <= 0) return;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        trace();
        ctx.fill();
    };

    switch (frame.kind) {
        case "attack": {
            const headRadius = Math.max(16, baseRadius * 0.28);
            fillShape(frame.slashAlpha * 0.9, () => traceRegularPolygon(ctx, travelX, centerY, headRadius, 3, spin + Math.PI * 0.5));
            strokeShape(frame.ringAlpha * 0.78, 1.05, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.98, 4, spin * 0.55 + Math.PI * 0.25),
            );
            strokeShape(frame.ringAlpha * 0.56, 0.88, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.58, 4, -spin * 0.4 + Math.PI * 0.25),
            );
            break;
        }
        case "critical": {
            strokeShape(frame.ringAlpha * 0.92, 1.2, () =>
                traceStarPolygon(ctx, centerX, centerY, baseRadius * 1.12, baseRadius * 0.46, 5, spin * 1.7),
            );
            fillShape(frame.slashAlpha * 0.62, () =>
                traceStarPolygon(ctx, centerX, centerY, baseRadius * 0.62, baseRadius * 0.22, 5, -spin * 1.2),
            );
            strokeShape(frame.ringAlpha * 0.62, 0.92, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.9, 8, spin * 0.25),
            );
            break;
        }
        case "skill": {
            strokeShape(frame.ringAlpha * 0.84, 1.08, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius, 7, spin * 0.72 + Math.PI / 7),
            );
            strokeShape(frame.ringAlpha * 0.66, 0.92, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.62, 7, -spin * 0.55),
            );
            fillShape(frame.slashAlpha * 0.5, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.34, 7, spin * 0.9),
            );
            break;
        }
        case "skillPaladin": {
            strokeShape(frame.ringAlpha * 0.9, 1.14, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 1.04, 6, spin * 0.5 + Math.PI / 6),
            );
            strokeShape(frame.ringAlpha * 0.74, 1, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.7, 6, -spin * 0.42 + Math.PI / 6),
            );
            fillShape(frame.slashAlpha * 0.52, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.42, 6, spin * 0.36 + Math.PI / 6),
            );
            break;
        }
        case "skillPriest": {
            strokeShape(frame.ringAlpha * 0.82, 1.08, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius, 4, Math.PI * 0.25),
            );
            fillShape(frame.slashAlpha * 0.5, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.64, 4, 0),
            );
            strokeShape(frame.ringAlpha * 0.58, 0.86, () =>
                traceStarPolygon(ctx, centerX, centerY, baseRadius * 0.62, baseRadius * 0.3, 4, spin * 0.7),
            );
            break;
        }
        case "skillAssassin": {
            strokeShape(frame.ringAlpha * 0.88, 1.15, () =>
                traceStarPolygon(ctx, centerX, centerY, baseRadius * 1.06, baseRadius * 0.28, 4, spin * 1.55 + Math.PI * 0.25),
            );
            fillShape(frame.slashAlpha * 0.58, () =>
                traceStarPolygon(ctx, centerX, centerY, baseRadius * 0.66, baseRadius * 0.2, 4, -spin * 1.08),
            );
            strokeShape(frame.ringAlpha * 0.54, 0.9, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.46, 4, spin * 0.4),
            );
            break;
        }
        case "scroll": {
            strokeShape(frame.ringAlpha * 0.8, 1.04, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius, 5, spin * 0.7 + Math.PI / 5),
            );
            fillShape(frame.slashAlpha * 0.52, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.45, 5, -spin * 0.55),
            );
            break;
        }
        case "scrollFire": {
            const burst = baseRadius * (0.45 + frame.progress * 0.4);
            for (let i = 0; i < 3; i += 1) {
                const angle = spin + i * (TAU / 3);
                const x = centerX + Math.cos(angle) * burst * 0.22;
                const y = centerY + Math.sin(angle) * burst * 0.22;
                fillShape(frame.slashAlpha * (0.78 - i * 0.14), () =>
                    traceRegularPolygon(ctx, x, y, burst * (0.36 - i * 0.05), 3, angle + Math.PI * 0.5),
                );
            }
            strokeShape(frame.ringAlpha * 0.72, 0.96, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.88, 3, -spin * 0.6 + Math.PI * 0.5),
            );
            break;
        }
        case "scrollFrost": {
            strokeShape(frame.ringAlpha * 0.88, 1.06, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 1.02, 6, spin * 0.3),
            );
            strokeShape(frame.ringAlpha * 0.72, 0.96, () =>
                traceStarPolygon(ctx, centerX, centerY, baseRadius * 0.82, baseRadius * 0.2, 6, -spin * 0.94),
            );
            fillShape(frame.slashAlpha * 0.48, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.36, 6, spin * 0.66),
            );
            break;
        }
        case "scrollHeal": {
            const pulse = 0.55 + frame.progress * 0.45;
            strokeShape(frame.ringAlpha * 0.82 * pulse, 1.06, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 1.04, 12, spin * 0.22),
            );
            strokeShape(frame.ringAlpha * 0.66 * pulse, 0.96, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.72, 12, -spin * 0.32),
            );
            strokeShape(frame.ringAlpha * 0.56, 0.92, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.56, 4, Math.PI * 0.25),
            );
            strokeShape(frame.ringAlpha * 0.46, 0.82, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.36, 4, 0),
            );
            break;
        }
        case "scrollStealth": {
            const phase = (frame.progress - 0.5) * baseRadius;
            for (let i = 0; i < 3; i += 1) {
                const offset = (i - 1) * baseRadius * 0.62;
                const alpha = frame.ringAlpha * (0.66 - i * 0.13);
                strokeShape(alpha, 0.92, () =>
                    traceRegularPolygon(ctx, centerX + offset + phase * (0.8 - i * 0.2), centerY, baseRadius * (0.56 - i * 0.08), 4, Math.PI * 0.12),
                );
            }
            break;
        }
        default:
            strokeShape(frame.ringAlpha * 0.82, 1, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.96, 5, spin * 0.5),
            );
            fillShape(frame.slashAlpha * 0.44, () =>
                traceRegularPolygon(ctx, centerX, centerY, baseRadius * 0.34, 5, -spin * 0.4),
            );
            break;
    }

    ctx.restore();

    let flashBase = Math.max(frame.slashAlpha * 0.72, frame.ringAlpha);
    let flashScale = 1;
    if (frame.kind === "scrollHeal") {
        flashBase = frame.ringAlpha;
        flashScale = 0.9;
    } else if (frame.kind === "critical") {
        flashScale = 1.2;
    } else if (frame.kind === "scrollStealth") {
        flashScale = 0.58;
    } else if (frame.kind === "scrollFrost") {
        flashScale = 1.05;
    } else if (frame.kind === "skillAssassin") {
        flashScale = 1.08;
    }

    const flashAlpha = (lowFx ? 0.08 : 0.13) * flashBase * flashScale;
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
