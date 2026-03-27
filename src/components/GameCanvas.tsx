import { useEffect, useRef } from "react";
import {
    type CombatActionKind,
    type ResourcePulseTone,
    createCombatActionState,
    createResourcePulseState,
    drawCombatActionOverlay,
    createCombatIntroState,
    drawCombatIntroOverlay,
    drawResourcePulseOverlay,
    sampleCombatAction,
    sampleCombatIntro,
    sampleResourcePulse,
    syncCombatActionTrigger,
    syncCombatIntroTrigger,
    syncResourcePulseTrigger,
} from "../animations/combatAnimation";
import {
    type RoomIntroKind,
    createRoomIntroState,
    drawRoomIntroOverlay,
    sampleRoomIntro,
    syncRoomIntroTrigger,
} from "../animations/roomAnimation";

type Props = {
    dangerLevel: number;
    combatIntroTriggerKey: number;
    combatActionTriggerKey: number;
    combatActionType: CombatActionKind;
    roomIntroTriggerKey: number;
    roomIntroType: RoomIntroKind;
    resourcePulseTriggerKey: number;
    resourcePulseTone: ResourcePulseTone;
    resourcePulsePower: number;
};

export function GameCanvas({
    dangerLevel,
    combatIntroTriggerKey,
    combatActionTriggerKey,
    combatActionType,
    roomIntroTriggerKey,
    roomIntroType,
    resourcePulseTriggerKey,
    resourcePulseTone,
    resourcePulsePower,
}: Props): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dangerLevelRef = useRef(dangerLevel);
    const combatIntroTriggerRef = useRef(combatIntroTriggerKey);
    const combatActionTriggerRef = useRef(combatActionTriggerKey);
    const combatActionTypeRef = useRef(combatActionType);
    const roomIntroTriggerRef = useRef(roomIntroTriggerKey);
    const roomIntroTypeRef = useRef(roomIntroType);
    const resourcePulseTriggerRef = useRef(resourcePulseTriggerKey);
    const resourcePulseToneRef = useRef(resourcePulseTone);
    const resourcePulsePowerRef = useRef(resourcePulsePower);

    useEffect(() => {
        dangerLevelRef.current = dangerLevel;
    }, [dangerLevel]);

    useEffect(() => {
        combatIntroTriggerRef.current = combatIntroTriggerKey;
    }, [combatIntroTriggerKey]);

    useEffect(() => {
        combatActionTriggerRef.current = combatActionTriggerKey;
    }, [combatActionTriggerKey]);

    useEffect(() => {
        combatActionTypeRef.current = combatActionType;
    }, [combatActionType]);

    useEffect(() => {
        roomIntroTriggerRef.current = roomIntroTriggerKey;
    }, [roomIntroTriggerKey]);

    useEffect(() => {
        roomIntroTypeRef.current = roomIntroType;
    }, [roomIntroType]);

    useEffect(() => {
        resourcePulseTriggerRef.current = resourcePulseTriggerKey;
    }, [resourcePulseTriggerKey]);

    useEffect(() => {
        resourcePulseToneRef.current = resourcePulseTone;
    }, [resourcePulseTone]);

    useEffect(() => {
        resourcePulsePowerRef.current = resourcePulsePower;
    }, [resourcePulsePower]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        const startMs = Date.now();
        const introState = createCombatIntroState({ durationSec: 0.44, intensity: 1 });
        const actionState = createCombatActionState({ intensity: 1 });
        const roomIntroState = createRoomIntroState({ intensity: 1 });
        const resourcePulseState = createResourcePulseState();

        const render = () => {
            const elapsedSec = (Date.now() - startMs) / 1000;
            const w = canvas.width;
            const h = canvas.height;
            const currentDangerLevel = dangerLevelRef.current;
            const lowFx = window.innerWidth <= 768;

            syncCombatIntroTrigger(introState, combatIntroTriggerRef.current, elapsedSec);
            syncCombatActionTrigger(actionState, combatActionTriggerRef.current, combatActionTypeRef.current, elapsedSec);
            syncRoomIntroTrigger(roomIntroState, roomIntroTriggerRef.current, roomIntroTypeRef.current, elapsedSec);
            syncResourcePulseTrigger(
                resourcePulseState,
                resourcePulseTriggerRef.current,
                resourcePulseToneRef.current,
                resourcePulsePowerRef.current,
                elapsedSec,
            );
            const introFrame = sampleCombatIntro(introState, elapsedSec);
            const actionFrame = sampleCombatAction(actionState, elapsedSec);
            const roomIntroFrame = sampleRoomIntro(roomIntroState, elapsedSec);
            const resourcePulseFrame = sampleResourcePulse(resourcePulseState, elapsedSec);

            ctx.clearRect(0, 0, w, h);

            const pulse = Math.sin(elapsedSec * 1.6) * 0.5 + 0.5;
            const bgR = Math.floor(18 + currentDangerLevel * 12 + pulse * 10);
            const bgG = Math.floor(20 + pulse * 16);
            const bgB = Math.floor(38 + pulse * 18);
            ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
            ctx.fillRect(0, 0, w, h);

            // Pixel stars/paricles.
            const particleCount = lowFx ? 68 : 120;
            const driftX = Math.floor(elapsedSec * (lowFx ? 65 : 100));
            const driftY = Math.floor(elapsedSec * (lowFx ? 38 : 60));
            const twinkle = Math.floor(elapsedSec * 20);
            for (let i = 0; i < particleCount; i += 1) {
                const x = (i * 37 + driftX) % w;
                const y = (i * 59 + driftY) % h;
                const a = ((i + twinkle) % 10) / 10;
                ctx.fillStyle = `rgba(197, 255, 250, ${a})`;
                ctx.fillRect(x, y, 2, 2);
            }

            // Main crystal block.
            const centerX = w / 2;
            const centerY = h / 2;
            const size = 48 + pulse * 12;
            ctx.fillStyle = "#42f7c8";
            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
            ctx.strokeStyle = "#c9fff8";
            ctx.lineWidth = 3;
            ctx.strokeRect(centerX - size / 2, centerY - size / 2, size, size);

            drawRoomIntroOverlay(ctx, w, h, roomIntroFrame, lowFx);
            drawCombatIntroOverlay(ctx, w, h, introFrame, currentDangerLevel, lowFx);
            drawCombatActionOverlay(ctx, w, h, actionFrame, lowFx);
            drawResourcePulseOverlay(ctx, w, h, resourcePulseFrame, lowFx);

            raf = requestAnimationFrame(render);
        };

        raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, []);

    return <canvas ref={canvasRef} width={560} height={320} className="game-canvas" />;
}
