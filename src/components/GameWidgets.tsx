import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MONSTER_SEGMENT_MAX, RESOURCE_SEGMENT_MAX, XP_LEVEL_SEGMENT_MAX, XP_PROGRESS_SEGMENT_MAX } from "../game/constants";
import type { ThresholdRule } from "../game/constants";
import type { ActionDeltaBadge, RoomAction } from "../game/types";
import {
    calcLevelClass,
    gainHintText,
    getActionBadgeHint,
    getActionBadgeLabel,
    getActionPrimaryLabel,
} from "../game/uiHelpers";
import type { ActionDeltaBadgeTone, ResourceGainHint } from "../game/uiHelpers";

type SegmentedResourceProps = {
    icon: string;
    label: string;
    value: number;
    max: number;
    displayValue?: string;
    segments?: number;
    consumeCount?: number;
    gainHint?: ResourceGainHint;
    secondaryGainHint?: ResourceGainHint;
    secondaryGainHintPrefix?: string;
    valuePrefix?: ReactNode;
    tone?: "hp" | "shield" | "enemy";
    threshold: ThresholdRule;
};

type IconStripResourceProps = {
    icon: string;
    label: string;
    value: number;
    unit: number;
    maxValue?: number;
    segments?: number;
    consumeCount?: number;
    gainHint?: ResourceGainHint;
    tone?: "coin" | "path" | "food";
    threshold: ThresholdRule;
};

type XpCompositeResourceProps = {
    xp: number;
    xpMax: number;
    xpLevel: number;
    xpGainHint?: ResourceGainHint;
    levelGainHint?: ResourceGainHint;
};

type MonsterCompositeResourceProps = {
    hp: number;
    hpMax: number;
    atk: number;
    atkMax: number;
};

type ProgressCompositeResourceProps = {
    room: number;
    roomMax: number;
    floor: number;
    floorMax: number;
};

function useDeltaClass(value: number): "" | "delta-up" | "delta-down" {
    const prevRef = useRef(value);
    const [deltaClass, setDeltaClass] = useState<"" | "delta-up" | "delta-down">("");

    useEffect(() => {
        if (value === prevRef.current) return;
        setDeltaClass(value > prevRef.current ? "delta-up" : "delta-down");
        const timer = window.setTimeout(() => setDeltaClass(""), 420);
        prevRef.current = value;
        return () => window.clearTimeout(timer);
    }, [value]);

    return deltaClass;
}

export function SegmentedResource({ icon, label, value, max, displayValue, segments, consumeCount = 0, gainHint, secondaryGainHint, secondaryGainHintPrefix = "", valuePrefix, tone = "hp", threshold }: SegmentedResourceProps): JSX.Element {
    const safeMax = Math.max(1, max);
    const clampedValue = Math.max(0, Math.min(value, safeMax));
    const fillRatio = clampedValue / safeMax;
    const segmentCount = Math.min(RESOURCE_SEGMENT_MAX, Math.max(1, Math.floor(segments ?? safeMax)));
    const filledCount = Math.round(fillRatio * segmentCount);
    const consumeTailCount = Math.max(0, Math.min(filledCount, Math.floor(consumeCount)));
    const levelClass = calcLevelClass(fillRatio, threshold);
    const deltaClass = useDeltaClass(value);
    return (
        <div className={`resource resource-${tone} ${levelClass} ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        {icon}
                    </span>
                    {label}
                    {gainHint && (
                        <span className={`resource-label-hint ${gainHint === "plusminus" ? "is-mixed" : gainHint === "plusmaybe" ? "is-maybe" : ""}`}>
                            {gainHintText(gainHint)}
                        </span>
                    )}
                    {secondaryGainHint && (
                        <span className={`resource-label-hint ${secondaryGainHint === "plusminus" ? "is-mixed" : secondaryGainHint === "plusmaybe" ? "is-maybe" : ""}`}>
                            {gainHintText(secondaryGainHint, secondaryGainHintPrefix)}
                        </span>
                    )}
                </span>
                <strong className="resource-value">
                    {valuePrefix}
                    {displayValue ?? `${Math.max(0, value)}/${safeMax}`}
                </strong>
            </div>
            <div
                className="segment-bar"
                role="img"
                aria-label={`${label} ${Math.max(0, value)} / ${safeMax}`}
                style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: segmentCount }, (_, idx) => {
                    const isOn = idx < filledCount;
                    const isConsumePulse = isOn && consumeTailCount > 0 && idx >= filledCount - consumeTailCount;
                    const className = ["segment", isOn ? "on" : "", isConsumePulse ? "consume-pulse" : ""].filter(Boolean).join(" ");
                    return <span key={`${label}-${idx}`} className={className} />;
                })}
            </div>
        </div>
    );
}

export function IconStripResource({ icon, label, value, unit, maxValue, segments, consumeCount = 0, gainHint, tone = "path", threshold }: IconStripResourceProps): JSX.Element {
    const safeUnit = Math.max(1, unit);
    const safeMax = Math.max(1, maxValue ?? value);
    const maxUnits = Math.min(RESOURCE_SEGMENT_MAX, Math.max(1, Math.ceil(segments ?? safeMax / safeUnit)));
    const ratio = Math.max(0, Math.min(value, safeMax)) / safeMax;
    const capped = Math.round(ratio * maxUnits);
    const consumeTailCount = Math.max(0, Math.min(capped, Math.floor(consumeCount)));
    const levelClass = calcLevelClass(ratio, threshold);
    const deltaClass = useDeltaClass(value);

    return (
        <div className={`resource resource-${tone} ${levelClass} ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        {icon}
                    </span>
                    {label}
                    {gainHint && (
                        <span className={`resource-label-hint ${gainHint === "plusminus" ? "is-mixed" : gainHint === "plusmaybe" ? "is-maybe" : ""}`}>
                            {gainHintText(gainHint)}
                        </span>
                    )}
                </span>
                <strong className="resource-value">
                    {value}/{safeMax}
                </strong>
            </div>
            <div className="icon-strip" role="img" aria-label={`${label} ${value} / ${safeMax}`}>
                {Array.from({ length: maxUnits }, (_, idx) => {
                    const isOn = idx < capped;
                    const isConsumePulse = isOn && consumeTailCount > 0 && idx >= capped - consumeTailCount;
                    const className = ["icon-node", isOn ? "on" : "", isConsumePulse ? "consume-pulse" : ""].filter(Boolean).join(" ");
                    return <span key={`${label}-icon-${idx}`} className={className} />;
                })}
            </div>
        </div>
    );
}

function ActionDeltaBadgePill({ badge, tone }: { badge: ActionDeltaBadge; tone: ActionDeltaBadgeTone }): JSX.Element {
    const hint = getActionBadgeHint(badge);
    const rangeMin = badge.range?.min;
    const isPositive = hint ? hint !== "plusminus" : typeof badge.amount === "number" ? badge.amount > 0 : typeof rangeMin === "number" ? rangeMin >= 0 : false;
    const amountText =
        hint
            ? gainHintText(hint)
            : typeof badge.amount === "number"
                ? `${badge.amount > 0 ? "+" : ""}${badge.amount}`
                : "";
    return (
        <span className={`action-delta-pill is-${tone} ${isPositive ? "is-positive" : "is-negative"}`}>
            <span className="action-delta-pill-amount">{amountText}</span>
            <span className="action-delta-pill-label">{getActionBadgeLabel(badge)}</span>
        </span>
    );
}

function ActionStatusPill({ text }: { text: string }): JSX.Element {
    return (
        <span className="action-status-pill">
            <span className="action-status-pill-text">{text}</span>
        </span>
    );
}

export function ActionButtonContent({ action }: { action: RoomAction }): JSX.Element {
    const primaryLabel = getActionPrimaryLabel(action);
    const hasBadges = Boolean(action.costBadges?.length || action.rewardBadges?.length || action.disabledReason);

    if (!hasBadges) {
        return (
            <>
                <span className="action-button-label">{primaryLabel}</span>
            </>
        );
    }

    return (
        <span className="action-button-content">
            <span className="action-button-label-row">
                <span className="action-button-label">{primaryLabel}</span>
            </span>
            <span className="action-delta-pill-row">
                {action.costBadges?.map((badge, idx) => (
                    <ActionDeltaBadgePill key={`cost-${action.id}-${badge.resource}-${idx}`} badge={badge} tone="cost" />
                ))}
                {action.rewardBadges?.map((badge, idx) => (
                    <ActionDeltaBadgePill key={`reward-${action.id}-${badge.resource}-${idx}`} badge={badge} tone="reward" />
                ))}
                {action.disabledReason ? <ActionStatusPill text={action.disabledReason} /> : null}
            </span>
        </span>
    );
}

export function XpCompositeResource({ xp, xpMax, xpLevel, xpGainHint, levelGainHint }: XpCompositeResourceProps): JSX.Element {
    const safeXpMax = Math.max(1, xpMax);
    const safeXp = Math.max(0, Math.min(xp, safeXpMax));
    const xpRatio = safeXp / safeXpMax;

    const safeLevel = Math.max(1, xpLevel);
    const levelScaleMax = XP_LEVEL_SEGMENT_MAX;
    const levelRatio = Math.max(0, Math.min(safeLevel, levelScaleMax)) / levelScaleMax;
    const xpSegments = XP_PROGRESS_SEGMENT_MAX;
    const levelSegments = levelScaleMax;
    const xpFilled = Math.round(xpRatio * xpSegments);
    const levelFilled = Math.round(levelRatio * levelSegments);

    const xpDelta = useDeltaClass(xp);
    const levelDelta = useDeltaClass(xpLevel);
    const deltaClass = xpDelta === "delta-down" || levelDelta === "delta-down" ? "delta-down" : xpDelta || levelDelta;

    return (
        <div className={`resource resource-xp ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        ✧
                    </span>
                    经验
                    {xpGainHint && (
                        <span className={`resource-label-hint ${xpGainHint === "plusminus" ? "is-mixed" : xpGainHint === "plusmaybe" ? "is-maybe" : ""}`}>
                            {gainHintText(xpGainHint)}
                        </span>
                    )}
                    {levelGainHint && (
                        <span className={`resource-label-hint ${levelGainHint === "plusminus" ? "is-mixed" : levelGainHint === "plusmaybe" ? "is-maybe" : ""}`}>
                            {gainHintText(levelGainHint, "Lv")}
                        </span>
                    )}
                </span>
            </div>
            <div className="xp-composite" role="img" aria-label={`经验 XP ${safeXp} / ${safeXpMax}，等级 ${safeLevel} / ${levelScaleMax}`}>
                <div className="xp-lane xp-lane-thin">
                    <span className="xp-lane-tag">XP</span>
                    <div className="xp-segment-grid" style={{ gridTemplateColumns: `repeat(${xpSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: xpSegments }, (_, idx) => (
                            <span key={`xp-${idx}`} className={idx < xpFilled ? "xp-segment xp-segment-progress on" : "xp-segment xp-segment-progress"} />
                        ))}
                    </div>
                    <span className="xp-lane-value">
                        {safeXp}/{safeXpMax}
                    </span>
                </div>
                <div className="xp-lane xp-lane-thick">
                    <span className="xp-lane-tag">Lv</span>
                    <div className="xp-segment-grid" style={{ gridTemplateColumns: `repeat(${levelSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: levelSegments }, (_, idx) => (
                            <span key={`lv-${idx}`} className={idx < levelFilled ? "xp-segment xp-segment-level on" : "xp-segment xp-segment-level"} />
                        ))}
                    </div>
                    <span className="xp-lane-value">
                        {safeLevel}/{levelScaleMax}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function MonsterCompositeResource({ hp, hpMax, atk, atkMax }: MonsterCompositeResourceProps): JSX.Element {
    const safeHpMax = Math.max(1, hpMax);
    const safeAtkMax = Math.max(1, atkMax);
    const clampedHp = Math.max(0, Math.min(hp, safeHpMax));
    const clampedAtk = Math.max(0, Math.min(atk, safeAtkMax));
    const segments = MONSTER_SEGMENT_MAX;
    const hpFilled = Math.round((clampedHp / safeHpMax) * segments);
    const atkFilled = Math.round((clampedAtk / safeAtkMax) * segments);

    const hpDelta = useDeltaClass(hp);
    const atkDelta = useDeltaClass(atk);
    const deltaClass = hpDelta === "delta-down" || atkDelta === "delta-down" ? "delta-down" : hpDelta || atkDelta;

    return (
        <div className={`resource resource-monster ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        ☠
                    </span>
                    怪物
                </span>
            </div>
            <div className="monster-composite" role="img" aria-label={`怪物生命 ${clampedHp} / ${safeHpMax}，攻击 ${clampedAtk} / ${safeAtkMax}`}>
                <div className="monster-row">
                    <span className="monster-tag">生命</span>
                    <div className="monster-segment-bar">
                        {Array.from({ length: segments }, (_, idx) => (
                            <span
                                key={`monster-hp-${idx}`}
                                className={idx < hpFilled ? "segment monster-segment-hp on" : "segment monster-segment-hp"}
                            />
                        ))}
                    </div>
                    <span className="monster-value">
                        {clampedHp}/{safeHpMax}
                    </span>
                </div>
                <div className="monster-row">
                    <span className="monster-tag">ATK</span>
                    <div className="monster-segment-bar">
                        {Array.from({ length: segments }, (_, idx) => (
                            <span
                                key={`monster-atk-${idx}`}
                                className={idx < atkFilled ? "segment monster-segment-atk on" : "segment monster-segment-atk"}
                            />
                        ))}
                    </div>
                    <span className="monster-value">
                        {clampedAtk}/{safeAtkMax}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function ProgressCompositeResource({ room, roomMax, floor, floorMax }: ProgressCompositeResourceProps): JSX.Element {
    const safeRoomMax = Math.max(1, roomMax);
    const safeFloorMax = Math.max(1, floorMax);
    const clampedRoom = Math.max(0, Math.min(room, safeRoomMax));
    const clampedFloor = Math.max(0, Math.min(floor, safeFloorMax));

    const roomSegments = safeRoomMax;
    const floorSegments = safeFloorMax;
    const roomFilled = Math.round((clampedRoom / safeRoomMax) * roomSegments);
    const floorFilled = Math.round((clampedFloor / safeFloorMax) * floorSegments);

    const roomDelta = useDeltaClass(room);
    const floorDelta = useDeltaClass(floor);
    const deltaClass = roomDelta === "delta-down" || floorDelta === "delta-down" ? "delta-down" : roomDelta || floorDelta;

    return (
        <div className={`resource resource-progress ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        🧭
                    </span>
                    进度
                </span>
            </div>
            <div className="progress-composite" role="img" aria-label={`房间 ${clampedRoom} / ${safeRoomMax}，层数 ${clampedFloor} / ${safeFloorMax}`}>
                <div className="progress-row progress-row-thin">
                    <span className="progress-tag">房间</span>
                    <div className="progress-segment-grid" style={{ gridTemplateColumns: `repeat(${roomSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: roomSegments }, (_, idx) => (
                            <span
                                key={`progress-room-${idx}`}
                                className={idx < roomFilled ? "progress-segment progress-segment-room on" : "progress-segment progress-segment-room"}
                            />
                        ))}
                    </div>
                    <span className="progress-value">
                        {clampedRoom}/{safeRoomMax}
                    </span>
                </div>

                <div className="progress-row progress-row-thick">
                    <span className="progress-tag">层数</span>
                    <div className="progress-segment-grid" style={{ gridTemplateColumns: `repeat(${floorSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: floorSegments }, (_, idx) => (
                            <span
                                key={`progress-floor-${idx}`}
                                className={idx < floorFilled ? "progress-segment progress-segment-floor on" : "progress-segment progress-segment-floor"}
                            />
                        ))}
                    </div>
                    <span className="progress-value">
                        {clampedFloor}/{safeFloorMax}
                    </span>
                </div>
            </div>
        </div>
    );
}
