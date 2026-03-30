import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { GameCanvas } from "./components/GameCanvas";
import {
    CRITICAL_TOOLTIP,
    CHARACTER_HOVER_HINTS,
    CHEST_REWARD_POOL,
    DANGER_INDEX_RULES,
    FLOOR,
    FORGE_HOVER_HINTS,
    MONSTER_SEGMENT_MAX,
    RESOURCE_SEGMENT_MAX,
    RESOURCE_THRESHOLD_RULES,
    ROOM_RANGES,
    ROOM_ADD,
    SCROLL_INFO,
    SHOP_BUY_POOL,
    SKILL_SP_COST,
    STATUE_ACTION_TOOLTIPS,
    THRESHOLD_DISABLED,
    TRAP_ACTION_TOOLTIPS,
    XP_LEVEL_SEGMENT_MAX,
    XP_MAX,
    XP_PROGRESS_SEGMENT_MAX,
} from "./game/constants";
import { gameState } from "./game/state";
import type { DeveloperScalarField } from "./game/state";
import type { CombatActionKind, ResourcePulseTone } from "./animations/combatAnimation";
import type { RoomIntroKind } from "./animations/roomAnimation";
import type { ActionDeltaBadge, ActionDeltaHint, CharacterHoverHint, CharacterTuple, CombatActionType, RoomAction } from "./game/types";
import type { ThresholdRule } from "./game/constants";
import type { RoomEventType } from "./game/types";

type Stage = "menu" | "character" | "explore" | "event" | "combat" | "gameover";

type ResourceSpendKey = "hp" | "defense" | "defenseMax" | "skillPoint" | "food" | "coin" | "scroll" | "extraAtk";

type ResourceSpendPreview = Partial<Record<ResourceSpendKey, number>>;

type ResourceGainKey = "hp" | "defense" | "defenseMax" | "skillPoint" | "food" | "coin" | "xp" | "xpLevel" | "extraAtk";

type ResourceGainHint = ActionDeltaHint;

type ResourceGainPreview = Partial<Record<ResourceGainKey, ResourceGainHint>>;

type ResourceDeltaRange = { min: number; max: number };

type ResourceDeltaRanges = Partial<Record<ResourceGainKey, ResourceDeltaRange>>;

type ActionDeltaBadgeTone = "cost" | "reward";

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
    valuePrefix?: React.ReactNode;
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

type LogCategory = "room" | "combat" | "resource" | "system";
type LogEntryView = {
    id: string;
    category: LogCategory;
    text: string;
    indexLabel: string;
    emphasis?: string;
    detail: string;
};

type CategorizedLog = {
    id: string;
    text: string;
    category: LogCategory;
};

type TooltipHint = {
    title: string;
    detail?: string;
};

type VictoryFxShard = {
    left: string;
    delay: string;
    duration: string;
    drift: string;
    size: string;
    hue: string;
};

type VictoryShardStyle = CSSProperties & {
    "--victory-drift": string;
    "--victory-hue": string;
};

type DeveloperControl = {
    key: DeveloperScalarField;
    label: string;
    value: number;
    hidden?: boolean;
};

const DEV_PANEL_TOGGLE = "Ctrl+Alt+Shift+D";

const DEV_ROOM_TYPE_OPTIONS: RoomEventType[] = [
    "monster_event",
    "boss_event",
    "branch_event",
    "chest_event",
    "trap_event",
    "shop_event",
    "bonfire_event",
    "forge_event",
    "statue_event",
    "mine_event",
];

const DEV_ROOM_TYPE_LABELS: Record<RoomEventType, string> = {
    monster_event: "怪物",
    boss_event: "Boss",
    branch_event: "分叉",
    chest_event: "宝箱",
    trap_event: "陷阱",
    shop_event: "商店",
    bonfire_event: "篝火",
    forge_event: "铸锻",
    statue_event: "雕像",
    mine_event: "矿洞",
};

const VICTORY_SHARDS: VictoryFxShard[] = [
    { left: "6%", delay: "0ms", duration: "3400ms", drift: "-42px", size: "10px", hue: "190" },
    { left: "14%", delay: "180ms", duration: "3000ms", drift: "28px", size: "14px", hue: "38" },
    { left: "22%", delay: "520ms", duration: "3600ms", drift: "-18px", size: "8px", hue: "158" },
    { left: "31%", delay: "110ms", duration: "3200ms", drift: "46px", size: "12px", hue: "332" },
    { left: "39%", delay: "760ms", duration: "3500ms", drift: "-34px", size: "9px", hue: "214" },
    { left: "48%", delay: "420ms", duration: "3100ms", drift: "24px", size: "16px", hue: "52" },
    { left: "57%", delay: "940ms", duration: "3700ms", drift: "-26px", size: "11px", hue: "174" },
    { left: "65%", delay: "260ms", duration: "3300ms", drift: "36px", size: "13px", hue: "286" },
    { left: "74%", delay: "680ms", duration: "3450ms", drift: "-22px", size: "10px", hue: "24" },
    { left: "83%", delay: "360ms", duration: "3050ms", drift: "31px", size: "15px", hue: "198" },
    { left: "91%", delay: "840ms", duration: "3550ms", drift: "-38px", size: "9px", hue: "120" },
];

const LOG_SECTION_ORDER: LogCategory[] = ["room", "combat", "resource", "system"];

const LOG_SECTION_TITLES: Record<LogCategory, string> = {
    room: "房间",
    combat: "战斗",
    resource: "资源",
    system: "系统",
};

const ROOM_LOG_MARKERS = [
    "进入房间",
    "触发事件",
    "分支",
    "路线",
    "宝箱",
    "陷阱",
    "商人",
    "篝火",
    "铸锻",
    "雕像",
    "矿洞",
];

const COMBAT_LOG_MARKERS = [
    "遭遇",
    "造成伤害",
    "反击",
    "寒冰效果",
    "暴击",
    "净化生效",
    "血祭生效",
    "挑衅生效",
    "击败",
    "脱离战斗",
    "Boss",
    "阵亡",
    "无法释放暴击",
    "无法使用技能",
    "无法使用卷轴",
    "火球术",
    "冻结敌人",
    "治疗术",
    "隐身术",
];

const RESOURCE_LOG_MARKERS = [
    "HP",
    "Coin",
    "Food",
    "Def",
    "XP",
    "ATK",
    "升级",
    "恢复",
    "损失",
    "伤害",
    "奖励",
    "卷轴",
];

const RESOURCE_DELTA_LOG_RE = /\b(?:HP|Coin|Food|Def(?: Max)?|XP|ATK(?: Extra)?)\b\s*[+-]\d+/;

const classifyLog = (line: string): LogCategory => {
    if (COMBAT_LOG_MARKERS.some((marker) => line.includes(marker))) {
        return "combat";
    }
    // Resource delta logs can carry room prefixes (e.g. "宝箱金币: Coin +4"),
    // so we classify them before checking room keywords.
    if (RESOURCE_DELTA_LOG_RE.test(line)) {
        return "resource";
    }
    if (ROOM_LOG_MARKERS.some((marker) => line.includes(marker))) {
        return "room";
    }
    if (RESOURCE_LOG_MARKERS.some((marker) => line.includes(marker))) {
        return "resource";
    }
    return "system";
};

const calcScaledSegments = (cap: number, maxSegments = RESOURCE_SEGMENT_MAX): number => {
    const safeCap = Math.max(1, cap);
    return Math.min(maxSegments, Math.max(1, Math.ceil(safeCap)));
};

const buildLogBuckets = (logs: string[]): Record<LogCategory, CategorizedLog[]> => {
    const initial: Record<LogCategory, CategorizedLog[]> = {
        room: [],
        combat: [],
        resource: [],
        system: [],
    };

    logs.forEach((text, idx) => {
        const category = classifyLog(text);
        initial[category].push({
            id: `${idx}-${text}`,
            text,
            category,
        });
    });

    LOG_SECTION_ORDER.forEach((key) => {
        initial[key] = initial[key].slice(-10).reverse();
    });

    return initial;
};

const splitLogEntry = (text: string): { emphasis?: string; detail: string } => {
    const normalized = text.trim();
    const match = normalized.match(/^(.*?[：:])\s*(.+)$/);
    if (match) {
        return {
            emphasis: match[1].trim(),
            detail: match[2].trim(),
        };
    }
    return { detail: normalized };
};
const buildLogEntryView = (entry: CategorizedLog, order: number): LogEntryView => {
    const { emphasis, detail } = splitLogEntry(entry.text);
    return {
        id: entry.id,
        category: entry.category,
        text: entry.text,
        indexLabel: (order + 1).toString().padStart(2, "0"),
        emphasis,
        detail,
    };
};

const calcLevelClass = (ratio: number, threshold: ThresholdRule): string => {
    if (threshold.warning === THRESHOLD_DISABLED || threshold.critical === THRESHOLD_DISABLED) {
        return "";
    }
    const warning = Math.max(0, Math.min(1, threshold.warning));
    const critical = Math.max(0, Math.min(1, threshold.critical));
    if (ratio <= critical) return "is-critical";
    if (ratio <= warning) return "is-warning";
    return "is-safe";
};

const mergeSpendPreview = (base: ResourceSpendPreview, key: ResourceSpendKey, amount: number): void => {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0) return;
    base[key] = Math.max(base[key] ?? 0, normalized);
};

const ACTION_BADGE_LABELS: Record<ActionDeltaBadge["resource"], string> = {
    hp: "HP",
    defense: "Def",
    defenseMax: "Def Max",
    skillPoint: "SP",
    food: "Food",
    coin: "Coin",
    xp: "XP",
    xpLevel: "Lv",
    extraAtk: "ATK Extra",
    scroll: "Scroll",
};

const getActionBadgeLabel = (badge: ActionDeltaBadge): string => badge.label ?? ACTION_BADGE_LABELS[badge.resource];

const getActionPrimaryLabel = (action: RoomAction): string => action.displayLabel ?? action.label;

const getActionBadgeHint = (badge: ActionDeltaBadge): ActionDeltaHint | undefined => {
    if (badge.hint) return badge.hint;
    if (!badge.range) return undefined;
    if (badge.range.max > 0 && badge.range.min > 0) return "plusplus";
    if (badge.range.max > 0 && badge.range.min < 0) return "plusminus";
    if (badge.range.max > 0 && badge.range.min === 0) return "plusmaybe";
    return undefined;
};

const mergeSpendPreviewFromBadge = (preview: ResourceSpendPreview, badge: ActionDeltaBadge): void => {
    if (typeof badge.amount !== "number" || badge.amount >= 0) return;
    switch (badge.resource) {
        case "hp":
            mergeSpendPreview(preview, "hp", Math.abs(badge.amount));
            break;
        case "defense":
            mergeSpendPreview(preview, "defense", Math.abs(badge.amount));
            break;
        case "defenseMax":
            mergeSpendPreview(preview, "defenseMax", Math.abs(badge.amount));
            break;
        case "skillPoint":
            mergeSpendPreview(preview, "skillPoint", Math.abs(badge.amount));
            break;
        case "food":
            mergeSpendPreview(preview, "food", Math.abs(badge.amount));
            break;
        case "coin":
            mergeSpendPreview(preview, "coin", Math.abs(badge.amount));
            break;
        case "extraAtk":
            mergeSpendPreview(preview, "extraAtk", Math.abs(badge.amount));
            break;
        case "scroll":
            mergeSpendPreview(preview, "scroll", Math.abs(badge.amount));
            break;
        default:
            break;
    }
};

const applyActionBadgesToRanges = (ranges: ResourceDeltaRanges, badges: ActionDeltaBadge[] | undefined): void => {
    badges?.forEach((badge) => {
        const rangeMin = badge.range?.min ?? badge.amount;
        const rangeMax = badge.range?.max ?? badge.amount;
        if (typeof rangeMin !== "number" || typeof rangeMax !== "number") return;
        switch (badge.resource) {
            case "hp":
            case "defense":
            case "defenseMax":
            case "skillPoint":
            case "food":
            case "coin":
            case "xp":
            case "xpLevel":
            case "extraAtk":
                addDeltaRange(ranges, badge.resource, rangeMin, rangeMax);
                break;
            default:
                break;
        }
    });
};

const hasSpendPreview = (preview: ResourceSpendPreview): boolean =>
    Object.values(preview).some((value) => typeof value === "number" && value > 0);

const addDeltaRange = (ranges: ResourceDeltaRanges, key: ResourceGainKey, minDelta: number, maxDelta: number): void => {
    const prev = ranges[key] ?? { min: 0, max: 0 };
    ranges[key] = {
        min: prev.min + minDelta,
        max: prev.max + maxDelta,
    };
};

const applySpendPreviewAsNegativeRanges = (ranges: ResourceDeltaRanges, spendPreview: ResourceSpendPreview): void => {
    if (spendPreview.hp) addDeltaRange(ranges, "hp", -spendPreview.hp, -spendPreview.hp);
    if (spendPreview.defense) addDeltaRange(ranges, "defense", -spendPreview.defense, -spendPreview.defense);
    if (spendPreview.defenseMax) addDeltaRange(ranges, "defenseMax", -spendPreview.defenseMax, -spendPreview.defenseMax);
    if (spendPreview.skillPoint) addDeltaRange(ranges, "skillPoint", -spendPreview.skillPoint, -spendPreview.skillPoint);
    if (spendPreview.food) addDeltaRange(ranges, "food", -spendPreview.food, -spendPreview.food);
    if (spendPreview.coin) addDeltaRange(ranges, "coin", -spendPreview.coin, -spendPreview.coin);
    if (spendPreview.extraAtk) addDeltaRange(ranges, "extraAtk", -spendPreview.extraAtk, -spendPreview.extraAtk);
};

const buildGainPreviewFromRanges = (ranges: ResourceDeltaRanges): ResourceGainPreview => {
    const preview: ResourceGainPreview = {};
    const keys: ResourceGainKey[] = ["hp", "defense", "defenseMax", "skillPoint", "food", "coin", "xp", "xpLevel", "extraAtk"];

    keys.forEach((key) => {
        const range = ranges[key];
        if (!range) return;
        if (range.max > 0 && range.min > 0) {
            preview[key] = "plusplus";
        } else if (range.max > 0 && range.min < 0) {
            preview[key] = "plusminus";
        } else if (range.max > 0 && range.min === 0) {
            preview[key] = "plusmaybe";
        }
    });

    return preview;
};

const hasGainPreview = (preview: ResourceGainPreview): boolean =>
    Object.values(preview).some((value) => value === "plusplus" || value === "plusminus" || value === "plusmaybe");

const gainHintText = (hint?: ResourceGainHint, prefix = ""): string => {
    if (hint === "plusminus") return `${prefix}+-`;
    if (hint === "plusmaybe") return `${prefix}+?`;
    if (hint === "plusplus") return `${prefix}++`;
    return "";
};

const getShopBuyValueById = (itemId: string): (typeof SHOP_BUY_POOL)[number]["value"] | undefined =>
    SHOP_BUY_POOL.find((item) => item.id === itemId)?.value;

const getChestRewardValueById = (rewardId: string): (typeof CHEST_REWARD_POOL)[number]["value"] | undefined =>
    CHEST_REWARD_POOL.find((item) => item.id === rewardId)?.value;

const isKnownScroll = (value: string | null | undefined): value is keyof typeof SCROLL_INFO => {
    return Boolean(value && value in SCROLL_INFO);
};

const DISABLED_THRESHOLD_RULE: ThresholdRule = {
    warning: THRESHOLD_DISABLED,
    critical: THRESHOLD_DISABLED,
};

const getCharacterHoverHint = (character: CharacterTuple): CharacterHoverHint =>
    CHARACTER_HOVER_HINTS[character[0]] ?? {
        trait: "特色：冒险风格均衡。",
        skill: `${character[6]}：按战况灵活使用。`,
    };

const getCharacterSkillHint = (character: CharacterTuple | null): string | null => {
    if (!character) return null;
    return CHARACTER_HOVER_HINTS[character[0]]?.skill ?? `${character[6]}：按战况灵活使用。`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const scoreByBands = (value: number, bands: readonly { max: number; score: number }[]): number => {
    const matched = bands.find((band) => value <= band.max);
    return matched?.score ?? 0;
};

const calcDangerIndex = ({
    stage,
    floor,
    room,
    hp,
    defense,
    food,
    combat,
}: {
    stage: Stage;
    floor: number;
    room: number;
    hp: number;
    defense: number;
    food: number;
    combat: { monsterName: string; monsterHp: number; monsterAtk: number; isBoss: boolean };
}): number => {
    if (stage === "menu" || stage === "character") {
        return 1;
    }

    const floorScore = Math.max(0, floor - 1) * DANGER_INDEX_RULES.floorStep;
    const roomScore = Math.max(0, room - 1) * DANGER_INDEX_RULES.roomStep;
    const hpScore = scoreByBands(hp, DANGER_INDEX_RULES.hpBands);
    const defenseScore = scoreByBands(defense, DANGER_INDEX_RULES.defenseBands);
    const foodScore = scoreByBands(food, DANGER_INDEX_RULES.foodBands);

    let combatPressure = 0;
    if (combat.monsterName) {
        const monsterHpScore = Math.min(DANGER_INDEX_RULES.monsterHpScoreMax, combat.monsterHp / DANGER_INDEX_RULES.monsterHpDivisor);
        const monsterAtkScore = Math.min(DANGER_INDEX_RULES.monsterAtkScoreMax, combat.monsterAtk / DANGER_INDEX_RULES.monsterAtkDivisor);
        combatPressure =
            DANGER_INDEX_RULES.combatScore +
            monsterHpScore +
            monsterAtkScore +
            (combat.isBoss ? DANGER_INDEX_RULES.bossScore : 0);
    } else if (stage === "event") {
        combatPressure = DANGER_INDEX_RULES.eventScore;
    }

    const totalScore = floorScore + roomScore + hpScore + defenseScore + foodScore + combatPressure;
    const normalizedScore =
        (clamp(totalScore, DANGER_INDEX_RULES.minScore, DANGER_INDEX_RULES.maxScore) - DANGER_INDEX_RULES.minScore) /
        Math.max(1, DANGER_INDEX_RULES.maxScore - DANGER_INDEX_RULES.minScore);

    return Math.max(1, Math.min(5, Math.round(normalizedScore * 4) + 1));
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

function SegmentedResource({ icon, label, value, max, displayValue, segments, consumeCount = 0, gainHint, secondaryGainHint, secondaryGainHintPrefix = "", valuePrefix, tone = "hp", threshold }: SegmentedResourceProps): JSX.Element {
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

function IconStripResource({ icon, label, value, unit, maxValue, segments, consumeCount = 0, gainHint, tone = "path", threshold }: IconStripResourceProps): JSX.Element {
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

function ActionButtonContent({ action }: { action: RoomAction }): JSX.Element {
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

function XpCompositeResource({ xp, xpMax, xpLevel, xpGainHint, levelGainHint }: XpCompositeResourceProps): JSX.Element {
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

function MonsterCompositeResource({ hp, hpMax, atk, atkMax }: MonsterCompositeResourceProps): JSX.Element {
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

function ProgressCompositeResource({ room, roomMax, floor, floorMax }: ProgressCompositeResourceProps): JSX.Element {
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

export function App(): JSX.Element {
    const developerPanelDefaultPosition = { x: 24, y: 24 };
    const [stage, setStage] = useState<Stage>("menu");
    const [, setTick] = useState(0);
    const [showWelcomeFx, setShowWelcomeFx] = useState(false);
    const [showVictoryFx, setShowVictoryFx] = useState(false);
    const [welcomeFxOrigin, setWelcomeFxOrigin] = useState({ x: 0.5, y: 0.5 });
    const [welcomeFxKey, setWelcomeFxKey] = useState(0);
    const [victoryFxKey, setVictoryFxKey] = useState(0);
    const [combatIntroTriggerKey, setCombatIntroTriggerKey] = useState(0);
    const [combatActionTriggerKey, setCombatActionTriggerKey] = useState(0);
    const [combatActionType, setCombatActionType] = useState<CombatActionKind>("attack");
    const [roomIntroTriggerKey, setRoomIntroTriggerKey] = useState(0);
    const [roomIntroType, setRoomIntroType] = useState<RoomIntroKind>("branch_event");
    const [resourcePulseTriggerKey, setResourcePulseTriggerKey] = useState(0);
    const [resourcePulseTone, setResourcePulseTone] = useState<ResourcePulseTone>("gain");
    const [resourcePulsePower, setResourcePulsePower] = useState(0.55);
    const [charOptions, setCharOptions] = useState<CharacterTuple[]>([]);
    const [hoveredChar, setHoveredChar] = useState<CharacterTuple | null>(null);
    const [activeEvent, setActiveEvent] = useState<RoomEventType | null>(null);
    const [activeRoomKey, setActiveRoomKey] = useState<string | null>(null);
    const [pendingBossBonusChest, setPendingBossBonusChest] = useState(false);
    const [eventAwaitingLeave, setEventAwaitingLeave] = useState(false);
    const [buttonsAnimating, setButtonsAnimating] = useState(false);
    const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
    const [developerPanelPosition, setDeveloperPanelPosition] = useState(developerPanelDefaultPosition);
    const [developerPanelDragging, setDeveloperPanelDragging] = useState(false);
    const [hoveredSpendPreview, setHoveredSpendPreview] = useState<ResourceSpendPreview | null>(null);
    const [hoveredGainPreview, setHoveredGainPreview] = useState<ResourceGainPreview | null>(null);
    const hpPeakRef = useRef(1);
    const foodPeakRef = useRef(1);
    const coinPeakRef = useRef(1);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const startButtonRef = useRef<HTMLButtonElement | null>(null);
    const actionAnimTimerRef = useRef<number | null>(null);
    const welcomeFxTimerRef = useRef<number | null>(null);
    const victoryFxTimerRef = useRef<number | null>(null);
    const prevStageRef = useRef<Stage>("menu");
    const developerPanelRef = useRef<HTMLElement | null>(null);
    const developerPanelDragOffsetRef = useRef({ x: 0, y: 0 });

    const snapshot = gameState.snapshot;
    const resourceSnapshotRef = useRef({
        hp: snapshot.player.hp,
        defense: snapshot.player.defense,
        food: snapshot.player.food,
        coin: snapshot.player.coin,
        xp: snapshot.player.xp,
    });
    const previewChar = stage === "character" ? hoveredChar : null;
    const displayCharacter = previewChar ?? snapshot.player.character;
    const displayHp = previewChar ? previewChar[1] : snapshot.player.hp;
    const displayDefense = previewChar ? previewChar[3] : snapshot.player.defense;
    const displayFood = previewChar ? previewChar[4] : snapshot.player.food;
    const displayCoin = previewChar ? previewChar[2] : snapshot.player.coin;
    const combatTempExtraAtk = !previewChar && stage === "combat" ? snapshot.combat.tempExtraAtk : 0;
    const displayExtraAtk = previewChar ? previewChar[5] : snapshot.player.extraAtk + combatTempExtraAtk;
    const hasTempExtraAtkInDisplay =
        !previewChar &&
        stage === "combat" &&
        snapshot.combat.tempExtraAtk !== 0 &&
        displayExtraAtk > 0;

    useEffect(() => {
        if (stage === "character") return;
        hpPeakRef.current = Math.max(hpPeakRef.current, snapshot.player.hp);
        foodPeakRef.current = Math.max(foodPeakRef.current, snapshot.player.food);
        coinPeakRef.current = Math.max(coinPeakRef.current, snapshot.player.coin);
    }, [snapshot.player.hp, snapshot.player.food, snapshot.player.coin, stage]);

    const hpHistoryCap = previewChar ? Math.max(1, previewChar[1]) : Math.max(1, hpPeakRef.current, snapshot.player.hp);
    const defHistoryCap = previewChar
        ? Math.max(1, previewChar[3])
        : Math.max(1, snapshot.player.defenseMax, snapshot.player.defense);
    const foodHistoryCap = previewChar ? Math.max(1, previewChar[4]) : Math.max(1, foodPeakRef.current, snapshot.player.food);
    const coinHistoryCap = previewChar ? Math.max(1, previewChar[2]) : Math.max(1, coinPeakRef.current, snapshot.player.coin);

    const hpSegments = calcScaledSegments(hpHistoryCap);
    const defSegments = calcScaledSegments(defHistoryCap);
    const foodSegments = calcScaledSegments(foodHistoryCap);
    const coinSegments = calcScaledSegments(coinHistoryCap);

    const pendingScroll = snapshot.player.pendingScroll;
    const displayScroll = previewChar
        ? previewChar[0] === "盗贼"
            ? "随机卷轴"
            : "-"
        : pendingScroll
            ? `${snapshot.player.scroll ?? "-"} (待替换 ${pendingScroll})`
            : snapshot.player.scroll ?? "-";
    const playerHpMax = hpHistoryCap;
    const defenseMax = Math.max(1, previewChar ? previewChar[3] : snapshot.player.defenseMax);
    const defenseDisplayValue = `${Math.max(0, displayDefense)}/${defenseMax}`;
    const armorEffectCount = Number(snapshot.player.hasThornsArmor) + Number(snapshot.player.hasHeavyArmor);
    const armorEffectStars = armorEffectCount > 0 ? (
        <span className="armor-effect-stars" aria-label={`护甲效果 ${armorEffectCount} 个`}>
            {Array.from({ length: armorEffectCount }, (_, idx) => (
                <span key={`armor-effect-${idx}`} className="armor-effect-star" aria-hidden="true" />
            ))}
        </span>
    ) : null;
    const foodMax = foodHistoryCap;
    const atkMin = snapshot.player.xpLevel;
    const atkMax = 2 * snapshot.player.xpLevel + 4;
    const monsterMax = snapshot.combat.monsterName
        ? Math.max(18 + snapshot.dungeon.floor * 4, snapshot.combat.monsterHp, 1)
        : 1;
    const effectiveMonsterAtk = snapshot.combat.monsterName
        ? Math.max(0, snapshot.combat.monsterAtk + snapshot.combat.tempMonsterAtkDelta)
        : 0;
    const monsterAtkMax = snapshot.combat.monsterName
        ? Math.max(snapshot.dungeon.floor + 6, snapshot.combat.monsterAtk, effectiveMonsterAtk, 1)
        : 1;
    const coinMax = coinHistoryCap;
    const floorMax = Math.max(FLOOR, snapshot.dungeon.floor, 1);
    const currentFloorRoomCount = snapshot.dungeon.floor + ROOM_ADD;
    const roomMax = Math.max(snapshot.dungeon.floor + ROOM_ADD, snapshot.dungeon.roomIdx, 1);
    const dangerLevel = useMemo(
        () =>
            calcDangerIndex({
                stage,
                floor: snapshot.dungeon.floor,
                room: snapshot.dungeon.roomIdx,
                hp: displayHp,
                defense: displayDefense,
                food: displayFood,
                combat: {
                    monsterName: snapshot.combat.monsterName,
                    monsterHp: snapshot.combat.monsterHp,
                    monsterAtk: effectiveMonsterAtk,
                    isBoss: snapshot.combat.isBoss,
                },
            }),
        [
            stage,
            snapshot.dungeon.floor,
            snapshot.dungeon.roomIdx,
            displayHp,
            displayDefense,
            displayFood,
            snapshot.combat.monsterName,
            snapshot.combat.monsterHp,
            effectiveMonsterAtk,
            snapshot.combat.isBoss,
        ]
    );
    const exploreEnterLabel =
        snapshot.dungeon.roomIdx === 1
            ? "进入房间"
            : snapshot.dungeon.roomIdx === currentFloorRoomCount
                ? "开启Boss房"
                : "下个房间";
    const showFullMap = displayCharacter?.[0] === "术士";
    const currentFloorMap = gameState.getMapRoomsForFloor(snapshot.dungeon.floor, showFullMap);
    const hasNextFloor = snapshot.dungeon.floor < FLOOR;
    const nextFloor = hasNextFloor ? snapshot.dungeon.floor + 1 : null;
    const nextFloorMap = hasNextFloor && nextFloor ? gameState.getMapRoomsForFloor(nextFloor, showFullMap) : [];
    const shopInventory = stage === "event" && activeEvent === "shop_event" ? gameState.getShopInventoryView() : null;
    const developerNextRoomType = gameState.getDeveloperNextRoomType();
    const developerNextRoomKey = gameState.getDeveloperNextRoomKey();
    const logBuckets = buildLogBuckets(snapshot.logs.slice(-48));
    const logViews = LOG_SECTION_ORDER.reduce(
        (acc, section) => {
            acc[section] = logBuckets[section].map((entry, index) => buildLogEntryView(entry, index));
            return acc;
        },
        { room: [], combat: [], resource: [], system: [] } as Record<LogCategory, LogEntryView[]>
    );
    const thresholdRule = (rule: ThresholdRule): ThresholdRule => (stage === "menu" ? DISABLED_THRESHOLD_RULE : rule);

    const developerControls: DeveloperControl[] = [
        { key: "hp", label: "HP", value: snapshot.player.hp },
        { key: "defense", label: "Def", value: snapshot.player.defense },
        { key: "defenseMax", label: "Def Max", value: snapshot.player.defenseMax },
        { key: "food", label: "Food", value: snapshot.player.food },
        { key: "coin", label: "Coin", value: snapshot.player.coin },
        { key: "scroll", label: "卷轴", value: snapshot.player.scroll ? 1 : 0 },
        { key: "extraAtk", label: "ATK Extra", value: snapshot.player.extraAtk },
        { key: "xp", label: "XP", value: snapshot.player.xp },
        { key: "xpLevel", label: "Lv", value: snapshot.player.xpLevel },
        { key: "skillPoint", label: "SP", value: snapshot.combat.skillPoint, hidden: stage !== "combat" },
        { key: "monsterHp", label: "怪物 HP", value: snapshot.combat.monsterHp, hidden: stage !== "combat" },
        { key: "monsterAtk", label: "怪物 ATK", value: snapshot.combat.monsterAtk, hidden: stage !== "combat" },
        { key: "tempExtraAtk", label: "临时 ATK", value: snapshot.combat.tempExtraAtk, hidden: stage !== "combat" },
        { key: "tempMonsterAtkDelta", label: "临时怪攻差", value: snapshot.combat.tempMonsterAtkDelta, hidden: stage !== "combat" },
        { key: "roomIdx", label: "房间", value: snapshot.dungeon.roomIdx },
        { key: "floor", label: "层数", value: snapshot.dungeon.floor },
    ];

    const refresh = () => setTick((v) => v + 1);

    const currentStageLabel =
        stage === "menu"
            ? "待机"
            : stage === "character"
                ? "选角"
                : stage === "explore"
                    ? "探索"
                    : stage === "event"
                        ? "事件"
                        : stage === "combat"
                            ? "战斗"
                            : "终止";
    const currentFocusLabel = previewChar
        ? previewChar[6]
        : stage === "event" && activeEvent
            ? gameState.getEventTitle(activeEvent)
            : snapshot.combat.monsterName || "未锁定";
    const menuHeroStats = [
        { label: "地牢层数", value: `${FLOOR} 层` },
        { label: "房间事件", value: "多分支事件" },
        { label: "战斗风格", value: "文字策略" },
    ];

    const adjustDeveloperScalar = (field: DeveloperScalarField, delta: number) => {
        gameState.adjustDeveloperScalar(field, delta);
        refresh();
    };

    const handleDeveloperWheel = (event: React.WheelEvent<HTMLElement>, field: DeveloperScalarField) => {
        event.preventDefault();
        event.stopPropagation();
        adjustDeveloperScalar(field, event.deltaY < 0 ? 1 : -1);
    };

    const handleDeveloperRoomTypeChange = (eventType: RoomEventType) => {
        gameState.setDeveloperNextRoomType(eventType);
        refresh();
    };

    const clearHoveredResourcePreview = () => {
        setHoveredSpendPreview(null);
        setHoveredGainPreview(null);
    };

    const renderActionTooltip = (hint: TooltipHint | null | undefined) => {
        if (!hint) {
            return null;
        }

        return (
            <span className="character-option-tip scroll-action-tip" aria-hidden="true">
                <span>{hint.title}</span>
                {hint.detail ? <span>{hint.detail}</span> : null}
            </span>
        );
    };

    const renderScrollTooltip = (scrollName: string | null | undefined) => {
        if (!isKnownScroll(scrollName)) {
            return null;
        }

        const tip = SCROLL_INFO[scrollName];
        return renderActionTooltip(tip);
    };

    const renderSkillTooltip = (character: CharacterTuple | null) => {
        const skillHint = getCharacterSkillHint(character);
        if (!skillHint) {
            return null;
        }

        return renderActionTooltip({ title: skillHint });
    };

    const renderCriticalTooltip = () => renderActionTooltip(CRITICAL_TOOLTIP);

    const renderTrapActionTooltip = (actionId: string) => {
        if (actionId !== "disarm" && actionId !== "rush") {
            return null;
        }

        const tip = TRAP_ACTION_TOOLTIPS[actionId];
        return renderActionTooltip(tip);
    };

    const renderStatueActionTooltip = (actionId: string) => {
        if (actionId !== "pray" && actionId !== "offer") {
            return null;
        }

        const tip = STATUE_ACTION_TOOLTIPS[actionId];
        return renderActionTooltip(tip);
    };

    const buildActionSpendPreview = (action: RoomAction): ResourceSpendPreview => {
        const preview: ResourceSpendPreview = {};
        const isLeaveAction = action.id === "leave-room" || action.id === "leave";

        action.costBadges?.forEach((badge) => {
            mergeSpendPreviewFromBadge(preview, badge);
        });

        if (stage === "event" && isLeaveAction) {
            if (snapshot.player.food > 0) {
                mergeSpendPreview(preview, "food", ROOM_RANGES.roomConsequence.foodCost);
            } else {
                mergeSpendPreview(preview, "hp", ROOM_RANGES.roomConsequence.hungerLossMin);
            }
        }

        if (action.id === "shop_sell_food") {
            mergeSpendPreview(preview, "food", ROOM_RANGES.shop.sell.food.foodCost);
        }
        if (action.id === "shop_sell_scroll" || action.id === "scroll") {
            mergeSpendPreview(preview, "scroll", 1);
        }
        if (action.id === "shop_sell_armor_shard") {
            mergeSpendPreview(preview, "defenseMax", ROOM_RANGES.shop.sell.armorShard.defMaxCost);
        }

        if (stage === "combat") {
            const role = snapshot.player.character?.[0];
            if (action.id === "critical") {
                mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.critical);
            }
            if (action.id === "skill") {
                if (role === "圣骑士") {
                    mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.paladin);
                    mergeSpendPreview(preview, "food", 1);
                }
                if (role === "祭司") {
                    mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.priest);
                    mergeSpendPreview(preview, "hp", 3);
                }
                if (role === "刺客") {
                    mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.assassin);
                }
            }
        }

        return preview;
    };

    const buildActionGainPreview = (action: RoomAction, spendPreview: ResourceSpendPreview): ResourceGainPreview => {
        const ranges: ResourceDeltaRanges = {};
        applySpendPreviewAsNegativeRanges(ranges, spendPreview);
        applyActionBadgesToRanges(ranges, action.rewardBadges);
        const isLeaveAction = action.id === "leave-room" || action.id === "leave";

        if (stage === "event" && isLeaveAction) {
            if (snapshot.player.food > 0) {
                addDeltaRange(ranges, "hp", ROOM_RANGES.roomConsequence.healMin, snapshot.dungeon.floor + 2);
            }
            if (snapshot.player.defense < snapshot.player.defenseMax) {
                addDeltaRange(ranges, "defense", ROOM_RANGES.roomConsequence.defenseRecover, ROOM_RANGES.roomConsequence.defenseRecover);
            }
        }

        if (stage === "event") {
            if (activeEvent === "shop_event") {
                if (action.id.startsWith("shop_buy_")) {
                    const itemId = action.id.replace("shop_buy_", "");
                    const value = getShopBuyValueById(itemId);

                    if (typeof value?.hp === "number") {
                        addDeltaRange(ranges, "hp", value.hp, value.hp);
                    }
                    if (value?.defense) {
                        addDeltaRange(ranges, "defense", value.defense.min, value.defense.max);
                    }
                    if (typeof value?.defenseMax === "number") {
                        addDeltaRange(ranges, "defenseMax", value.defenseMax, value.defenseMax);
                    }
                    if (value?.coin) {
                        addDeltaRange(ranges, "coin", value.coin.min, value.coin.max);
                    }
                    if (typeof value?.food === "number") {
                        addDeltaRange(ranges, "food", value.food, value.food);
                    }
                    if (typeof value?.extraAtk === "number") {
                        addDeltaRange(ranges, "extraAtk", value.extraAtk, value.extraAtk);
                    }
                }
                if (action.id === "shop_sell_armor_shard") {
                    addDeltaRange(ranges, "defenseMax", -ROOM_RANGES.shop.sell.armorShard.defMaxCost, -ROOM_RANGES.shop.sell.armorShard.defMaxCost);
                    addDeltaRange(ranges, "coin", ROOM_RANGES.shop.sell.armorShard.coinGain, ROOM_RANGES.shop.sell.armorShard.coinGain);
                }
                if (action.id === "shop_sell_food") {
                    addDeltaRange(ranges, "coin", ROOM_RANGES.shop.sell.food.coinGain, ROOM_RANGES.shop.sell.food.coinGain);
                }
                if (action.id === "shop_sell_scroll") {
                    addDeltaRange(ranges, "coin", ROOM_RANGES.shop.sell.scrollCoinGain, ROOM_RANGES.shop.sell.scrollCoinGain);
                }
            }

            if (activeEvent === "chest_event" && action.id === "open") {
                const chestCloudy = getChestRewardValueById("cloudy")?.hpRange;
                const chestLifeHp = getChestRewardValueById("life")?.hp ?? 0;
                const chestCoin = getChestRewardValueById("coin")?.coin;
                const chestPoorArmor = getChestRewardValueById("poor_armor")?.defense;
                const chestWhetstone = getChestRewardValueById("whetstone")?.extraAtk ?? 0;
                const chestHpMaxGain = chestLifeHp + Math.max(0, chestCloudy?.max ?? 0);

                addDeltaRange(ranges, "hp", -Math.abs(chestCloudy?.min ?? 0), chestHpMaxGain);
                addDeltaRange(ranges, "coin", 0, chestCoin?.max ?? 0);
                addDeltaRange(ranges, "food", 0, ROOM_RANGES.trapReward.spikeFood.max);
                addDeltaRange(ranges, "defense", 0, chestPoorArmor?.max ?? 0);
                addDeltaRange(ranges, "defenseMax", 0, getChestRewardValueById("superior_armor")?.defenseMax ?? 0);
                addDeltaRange(ranges, "extraAtk", 0, chestWhetstone);
            }

            if (activeEvent === "trap_event" && (action.id === "disarm" || action.id === "rush")) {
                addDeltaRange(ranges, "extraAtk", 0, ROOM_RANGES.trapReward.acidExtraAtk);
            }

            if (activeEvent === "bonfire_event") {
                if (action.id === "heal") addDeltaRange(ranges, "hp", ROOM_RANGES.bonfire.heal.min, ROOM_RANGES.bonfire.heal.max);
                if (action.id === "cook") addDeltaRange(ranges, "food", ROOM_RANGES.bonfire.cook.min, ROOM_RANGES.bonfire.cook.max);
                if (action.id === "polish") {
                    addDeltaRange(
                        ranges,
                        "extraAtk",
                        Math.min(...ROOM_RANGES.bonfire.polishDeltaPool),
                        Math.max(...ROOM_RANGES.bonfire.polishDeltaPool),
                    );
                }
                if (action.id === "search") {
                    addDeltaRange(ranges, "food", 0, ROOM_RANGES.bonfire.foundFood.max);
                    addDeltaRange(ranges, "coin", 0, ROOM_RANGES.bonfire.foundCoin.max);
                }
            }

            if (activeEvent === "forge_event") {
                if (action.id === "weapon") {
                    addDeltaRange(
                        ranges,
                        "extraAtk",
                        Math.min(...ROOM_RANGES.forge.weaponDeltaPool),
                        Math.max(...ROOM_RANGES.forge.weaponDeltaPool),
                    );
                }
                if (action.id === "armor") {
                    addDeltaRange(ranges, "defense", ROOM_RANGES.forge.armorDefGain, ROOM_RANGES.forge.armorDefGain);
                    addDeltaRange(ranges, "defenseMax", ROOM_RANGES.forge.armorDefMaxGain, ROOM_RANGES.forge.armorDefMaxGain);
                }
                if (action.id === "weapon" || action.id === "armor" || action.id === "forge_armor_thorns" || action.id === "forge_armor_heavy") {
                    addDeltaRange(ranges, "xp", ROOM_RANGES.forge.xpGain.min, ROOM_RANGES.forge.xpGain.max);
                }
            }

            if (activeEvent === "statue_event" && (action.id === "pray" || action.id === "offer")) {
                addDeltaRange(ranges, "hp", -ROOM_RANGES.statueCurseTrueDamage.max, ROOM_RANGES.statueBless.hp.max);
                addDeltaRange(ranges, "xp", -ROOM_RANGES.statue.curseXpLoss, ROOM_RANGES.statueBless.xp.jackpot);
                addDeltaRange(ranges, "defense", 0, ROOM_RANGES.statueBless.def.max);
                addDeltaRange(ranges, "extraAtk", 0, ROOM_RANGES.statue.blessAtkGain);
            }

            if (activeEvent === "mine_event" && action.id === "dig") {
                const chestCloudy = getChestRewardValueById("cloudy")?.hpRange;
                const chestLifeHp = getChestRewardValueById("life")?.hp ?? 0;
                const chestCoin = getChestRewardValueById("coin")?.coin;
                const chestWhetstone = getChestRewardValueById("whetstone")?.extraAtk ?? 0;
                const hpDownFromDig = snapshot.player.food > 0 ? 0 : ROOM_RANGES.mine.noFoodTrueDamage.max;
                const hpDownFromCloudy = Math.abs(chestCloudy?.min ?? 0);
                const hpUpFromChest = chestLifeHp + Math.max(0, chestCloudy?.max ?? 0);
                const hpUpFromPlant = ROOM_RANGES.mine.plantHp.max;
                const hpDown = Math.max(hpDownFromDig, hpDownFromCloudy);
                const hpUp = Math.max(hpUpFromChest, hpUpFromPlant);
                addDeltaRange(ranges, "hp", -hpDown, hpUp);

                if (snapshot.player.food > 0) {
                    addDeltaRange(
                        ranges,
                        "food",
                        ROOM_RANGES.mine.plantFood.min - ROOM_RANGES.mine.digFoodCost,
                        ROOM_RANGES.mine.plantFood.max - ROOM_RANGES.mine.digFoodCost,
                    );
                } else {
                    addDeltaRange(ranges, "food", 0, ROOM_RANGES.mine.plantFood.max);
                }

                addDeltaRange(ranges, "coin", 0, Math.max(ROOM_RANGES.mine.normalCoin.max, chestCoin?.max ?? 0));
                addDeltaRange(
                    ranges,
                    "extraAtk",
                    0,
                    Math.max(ROOM_RANGES.mine.rareOreAtkGain, chestWhetstone),
                );
            }
        }

        if (stage === "explore") {
            const currentXp = snapshot.player.xp;
            if (currentXp >= XP_MAX) {
                const levelGain = Math.floor(currentXp / XP_MAX);
                if (levelGain > 0) {
                    addDeltaRange(ranges, "xpLevel", levelGain, levelGain);
                }
            }
        }

        if (stage === "combat") {
            if (action.id === "skill") {
                const role = snapshot.player.character?.[0];
                if (role === "祭司") {
                    addDeltaRange(ranges, "extraAtk", 1, 3);
                }
                if (role === "刺客") {
                    addDeltaRange(ranges, "extraAtk", 2, 4);
                }
            }
            if (action.id === "scroll" && snapshot.player.scroll === "治疗术") {
                if (snapshot.player.hp > 10) {
                    addDeltaRange(ranges, "hp", 4, 7);
                } else {
                    addDeltaRange(ranges, "hp", 9, 13);
                }
            }
        }

        return buildGainPreviewFromRanges(ranges);
    };

    const getSpendPreviewHandlers = (action: RoomAction) => {
        if (action.disabledReason) {
            return {};
        }

        const applyPreview = () => {
            const spendPreview = buildActionSpendPreview(action);
            const gainPreview = buildActionGainPreview(action, spendPreview);
            setHoveredSpendPreview(hasSpendPreview(spendPreview) ? spendPreview : null);
            setHoveredGainPreview(hasGainPreview(gainPreview) ? gainPreview : null);
        };

        return {
            onMouseEnter: applyPreview,
            onMouseLeave: clearHoveredResourcePreview,
            onFocus: applyPreview,
            onBlur: clearHoveredResourcePreview,
        };
    };

    const useHealScrollInExplore = () => {
        if (!gameState.useHealScrollInExplore()) {
            refresh();
            return;
        }
        refresh();
    };

    const applyExploreHealScrollPreview = () => {
        const spendPreview = buildActionSpendPreview({
            id: "scroll",
            label: "使用卷轴: 治疗术",
            displayLabel: "使用治疗术",
            costBadges: [{ resource: "scroll", amount: -1 }],
        });
        setHoveredSpendPreview(hasSpendPreview(spendPreview) ? spendPreview : null);
        setHoveredGainPreview({ hp: "plusplus" });
    };

    useEffect(() => {
        return () => {
            if (actionAnimTimerRef.current !== null) {
                window.clearTimeout(actionAnimTimerRef.current);
                actionAnimTimerRef.current = null;
            }
            if (welcomeFxTimerRef.current !== null) {
                window.clearTimeout(welcomeFxTimerRef.current);
                welcomeFxTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) return;
            if (event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === "d") {
                event.preventDefault();
                setShowDeveloperPanel((value) => !value);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (!showDeveloperPanel) {
            return;
        }

        const blockPageWheel = (event: WheelEvent) => {
            event.preventDefault();
        };

        window.addEventListener("wheel", blockPageWheel, { passive: false });
        return () => window.removeEventListener("wheel", blockPageWheel);
    }, [showDeveloperPanel]);

    useEffect(() => {
        if (!showDeveloperPanel || !developerPanelDragging) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const panel = developerPanelRef.current;
            const panelWidth = panel?.offsetWidth ?? 320;
            const panelHeight = panel?.offsetHeight ?? 480;
            const nextX = event.clientX - developerPanelDragOffsetRef.current.x;
            const nextY = event.clientY - developerPanelDragOffsetRef.current.y;
            const maxX = Math.max(12, window.innerWidth - panelWidth - 12);
            const maxY = Math.max(12, window.innerHeight - panelHeight - 12);

            setDeveloperPanelPosition({
                x: Math.min(Math.max(12, nextX), maxX),
                y: Math.min(Math.max(12, nextY), maxY),
            });
        };

        const handlePointerEnd = () => {
            setDeveloperPanelDragging(false);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
        };
    }, [showDeveloperPanel, developerPanelDragging]);

    const triggerWelcomeFx = () => {
        const buttonRect = startButtonRef.current?.getBoundingClientRect();
        if (buttonRect) {
            setWelcomeFxOrigin({
                x: (buttonRect.left + buttonRect.width / 2) / window.innerWidth,
                y: (buttonRect.top + buttonRect.height / 2) / window.innerHeight,
            });
        } else {
            setWelcomeFxOrigin({ x: 0.5, y: 0.5 });
        }
        setShowWelcomeFx(true);
        setWelcomeFxKey((key) => key + 1);
        if (welcomeFxTimerRef.current !== null) {
            window.clearTimeout(welcomeFxTimerRef.current);
        }
        welcomeFxTimerRef.current = window.setTimeout(() => {
            setShowWelcomeFx(false);
            welcomeFxTimerRef.current = null;
        }, 3280);
    };

    useEffect(() => {
        if (prevStageRef.current !== "combat" && stage === "combat") {
            setCombatIntroTriggerKey((key) => key + 1);
        }
        prevStageRef.current = stage;
    }, [stage]);

    const handleDeveloperPanelPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const target = event.target;
        if (target instanceof Element && target.closest("button")) {
            return;
        }

        const panelRect = developerPanelRef.current?.getBoundingClientRect();
        if (!panelRect) {
            return;
        }

        developerPanelDragOffsetRef.current = {
            x: event.clientX - panelRect.left,
            y: event.clientY - panelRect.top,
        };
        setDeveloperPanelDragging(true);
        developerPanelRef.current?.setPointerCapture(event.pointerId);
    };

    useEffect(() => {
        clearHoveredResourcePreview();
    }, [stage, activeEvent, pendingScroll]);

    useEffect(() => {
        setEventAwaitingLeave(false);
    }, [stage, activeEvent]);

    useEffect(() => {
        if (stage === "menu" || stage === "character") {
            resourceSnapshotRef.current = {
                hp: snapshot.player.hp,
                defense: snapshot.player.defense,
                food: snapshot.player.food,
                coin: snapshot.player.coin,
                xp: snapshot.player.xp,
            };
            return;
        }

        const prev = resourceSnapshotRef.current;
        const next = {
            hp: snapshot.player.hp,
            defense: snapshot.player.defense,
            food: snapshot.player.food,
            coin: snapshot.player.coin,
            xp: snapshot.player.xp,
        };

        const deltas = [
            next.hp - prev.hp,
            next.defense - prev.defense,
            next.food - prev.food,
            next.coin - prev.coin,
            next.xp - prev.xp,
        ];
        const positive = deltas.filter((v) => v > 0).reduce((sum, v) => sum + v, 0);
        const negative = deltas.filter((v) => v < 0).reduce((sum, v) => sum + Math.abs(v), 0);
        const totalAbs = deltas.reduce((sum, v) => sum + Math.abs(v), 0);

        if (totalAbs > 0) {
            const tone: ResourcePulseTone = positive > 0 && negative > 0 ? "mixed" : positive > 0 ? "gain" : "loss";
            const power = Math.min(1, 0.26 + totalAbs / 20);
            setResourcePulseTone(tone);
            setResourcePulsePower(power);
            setResourcePulseTriggerKey((key) => key + 1);
        }

        resourceSnapshotRef.current = next;
    }, [snapshot.player.hp, snapshot.player.defense, snapshot.player.food, snapshot.player.coin, snapshot.player.xp, stage]);

    const runActionWithButtonAnimation = (clickedActionId: string, action: () => void) => {
        if (buttonsAnimating) return;

        clearHoveredResourcePreview();

        const root = actionsRef.current;
        const allButtons = root ? Array.from(root.querySelectorAll<HTMLButtonElement>("button")) : [];
        if (allButtons.length === 0) {
            action();
            return;
        }

        setButtonsAnimating(true);
        allButtons.forEach((btn) => {
            const isClicked = btn.dataset.actionId === clickedActionId;
            if (btn.disabled || isClicked) {
                btn.classList.add("btn-exit-fade");
            } else {
                btn.classList.add("btn-exit-fall");
            }
        });

        actionAnimTimerRef.current = window.setTimeout(() => {
            action();
            setButtonsAnimating(false);
            window.requestAnimationFrame(() => {
                const latestButtons = actionsRef.current ? Array.from(actionsRef.current.querySelectorAll<HTMLButtonElement>("button")) : [];
                latestButtons.forEach((btn) => {
                    btn.classList.remove("btn-exit-fade", "btn-exit-fall");
                });
            });
            actionAnimTimerRef.current = null;
        }, 260);
    };

    const triggerAction = (actionId: string, action: () => void, withExitAnimation = true) => {
        clearHoveredResourcePreview();
        if (withExitAnimation) {
            runActionWithButtonAnimation(actionId, action);
            return;
        }
        if (buttonsAnimating) return;
        action();
    };

    const triggerVictoryFx = () => {
        if (victoryFxTimerRef.current !== null) {
            window.clearTimeout(victoryFxTimerRef.current);
        }
        setVictoryFxKey((key) => key + 1);
        setShowVictoryFx(true);
        victoryFxTimerRef.current = window.setTimeout(() => {
            setShowVictoryFx(false);
            victoryFxTimerRef.current = null;
        }, 4200);
    };

    const finalizeRoomFlow = () => {
        if (!activeRoomKey) {
            return;
        }

        const result = gameState.finalizeCurrentRoom(activeRoomKey);
        if (result.ignored) {
            refresh();
            return;
        }

        if (result.playerDied) {
            gameState.addLog("你在房间结算后倒下，游戏结束");
            setActiveRoomKey(null);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setEventAwaitingLeave(false);
            setStage("gameover");
            refresh();
            return;
        }

        if (result.dungeonCleared) {
            gameState.clearLogs();
            gameState.addLog("你击败了地牢终焉，获得鹰魂结晶！");
            gameState.addLog("系统提示：本轮冒险已通关，鹰魂结晶已纳入战利记录。");
            triggerVictoryFx();
            setActiveRoomKey(null);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setStage("menu");
            refresh();
            return;
        }

        setActiveRoomKey(null);
        setActiveEvent(null);
        setPendingBossBonusChest(false);
        setStage("explore");
    };

    const startNewRun = () => {
        triggerWelcomeFx();
        gameState.reset();
        setCharOptions(gameState.getCharacterOptions());
        gameState.addLog("鼠标停在一些按钮上可以预览信息，后面遇到的也一样哦");
        hpPeakRef.current = 1;
        foodPeakRef.current = 1;
        coinPeakRef.current = 1;
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setPendingBossBonusChest(false);
        setStage("character");
        refresh();
    };

    const returnToMenu = () => {
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setPendingBossBonusChest(false);
        setEventAwaitingLeave(false);
        clearHoveredResourcePreview();
        setStage("menu");
        refresh();
    };

    const confirmCharacter = (index: number) => {
        const selected = charOptions[index];
        if (selected) {
            hpPeakRef.current = Math.max(1, selected[1]);
            foodPeakRef.current = Math.max(1, selected[4]);
            coinPeakRef.current = Math.max(1, selected[2]);
        }
        gameState.pickCharacter(index);
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setPendingBossBonusChest(false);
        setStage("explore");
        refresh();
    };

    const enterRoom = () => {
        const roomKey = `${snapshot.dungeon.floor}-${snapshot.dungeon.roomIdx}`;
        gameState.clearLogs();
        setEventAwaitingLeave(false);
        const evt = gameState.getCurrentRoomEvent();
        if (!evt) return;
        const introType = evt as RoomEventType;
        setRoomIntroType(introType);
        setRoomIntroTriggerKey((key) => key + 1);
        setActiveRoomKey(roomKey);
        if (evt === "monster_event" || evt === "boss_event") {
            gameState.startRoomCombat(evt);
            setStage("combat");
        } else {
            setActiveEvent(evt as RoomEventType);
            setStage("event");
            gameState.addLog(`触发事件: ${gameState.getEventTitle(evt)}`);
        }
        refresh();
    };

    const executeRoomAction = (actionId: string) => {
        if (!activeEvent) return;
        const result = gameState.resolveRoomAction(activeEvent, actionId);

        if (result.nextEventType) {
            setEventAwaitingLeave(false);
            if (result.nextEventType === "monster_event" || result.nextEventType === "boss_event") {
                gameState.startRoomCombat(result.nextEventType);
                setStage("combat");
            } else {
                setActiveEvent(result.nextEventType);
                gameState.addLog(`分支落点: ${gameState.getEventTitle(result.nextEventType)}`);
            }
            refresh();
            return;
        }

        if (result.combat) {
            setEventAwaitingLeave(false);
            gameState.startCombat(result.combat.monsterName, result.combat.hp, result.combat.atk, result.combat.isBoss);
            setStage("combat");
            refresh();
            return;
        }

        if (result.roomAdvancedInternally) {
            setEventAwaitingLeave(false);
            setActiveRoomKey(null);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setStage("explore");
            refresh();
            return;
        }

        if (result.complete) {
            const hasRoomLeaveAction = gameState.getRoomActions(activeEvent).some((action) => action.id === "leave");
            if (!hasRoomLeaveAction) {
                const eventTitle = gameState.getEventTitle(activeEvent);
                gameState.clearLogs();
                gameState.addLog(`离开${eventTitle}，触发通用结算`);
                if (activeEvent === "chest_event" && pendingBossBonusChest) {
                    setPendingBossBonusChest(false);
                }
                setEventAwaitingLeave(false);
                finalizeRoomFlow();
                refresh();
                return;
            }
            setEventAwaitingLeave(true);
        }
        refresh();
    };

    const leaveCurrentEvent = () => {
        if (!activeEvent) return;

        const eventTitle = gameState.getEventTitle(activeEvent);
        const hasRoomLeaveAction = gameState.getRoomActions(activeEvent).some((action) => action.id === "leave");

        if (hasRoomLeaveAction) {
            const leaveResult = gameState.resolveRoomAction(activeEvent, "leave");

            if (leaveResult.nextEventType) {
                setEventAwaitingLeave(false);
                if (leaveResult.nextEventType === "monster_event" || leaveResult.nextEventType === "boss_event") {
                    gameState.startRoomCombat(leaveResult.nextEventType);
                    setStage("combat");
                } else {
                    setActiveEvent(leaveResult.nextEventType);
                    gameState.addLog(`分支落点: ${gameState.getEventTitle(leaveResult.nextEventType)}`);
                }
                refresh();
                return;
            }

            if (leaveResult.combat) {
                setEventAwaitingLeave(false);
                gameState.startCombat(leaveResult.combat.monsterName, leaveResult.combat.hp, leaveResult.combat.atk, leaveResult.combat.isBoss);
                setStage("combat");
                refresh();
                return;
            }

            if (leaveResult.roomAdvancedInternally) {
                setEventAwaitingLeave(false);
                setActiveRoomKey(null);
                setActiveEvent(null);
                setPendingBossBonusChest(false);
                setStage("explore");
                refresh();
                return;
            }

            if (!leaveResult.complete) {
                refresh();
                return;
            }
        }

        gameState.clearLogs();
        gameState.addLog(`离开${eventTitle}，触发通用结算`);
        if (activeEvent === "chest_event" && pendingBossBonusChest) {
            setPendingBossBonusChest(false);
        }
        setEventAwaitingLeave(false);
        finalizeRoomFlow();
        refresh();
    };

    const resolveCombatAnimationKind = (actionType: CombatActionType): CombatActionKind => {
        if (actionType === "attack" || actionType === "critical") {
            return actionType;
        }

        if (actionType === "skill") {
            const role = snapshot.player.character?.[0];
            if (role === "圣骑士") return "skillPaladin";
            if (role === "祭司") return "skillPriest";
            if (role === "刺客") return "skillAssassin";
            return "skill";
        }

        if (actionType === "scroll") {
            const scroll = snapshot.player.scroll;
            if (scroll === "火球术") return "scrollFire";
            if (scroll === "寒冰术") return "scrollFrost";
            if (scroll === "治疗术") return "scrollHeal";
            if (scroll === "隐身术") return "scrollStealth";
            return "scroll";
        }

        return "attack";
    };

    const handleCombatAction = (actionType: CombatActionType) => {
        setCombatActionType(resolveCombatAnimationKind(actionType));
        setCombatActionTriggerKey((key) => key + 1);
        if (actionType === "attack" || actionType === "critical") {
            gameState.clearCombatLogs();
        }
        const result = gameState.performCombatAction(actionType);

        if (result.victory) {
            const defeatedName = snapshot.combat.monsterName;
            const wasBoss = snapshot.combat.isBoss;
            gameState.addLog(`击败 ${defeatedName}`);
            gameState.finishCombat(true);
            if (wasBoss) {
                gameState.queueBonusChest(1);
                setPendingBossBonusChest(true);
                setActiveEvent("chest_event");
                setStage("event");
                gameState.addLog("Boss掉落宝箱：请手动开启");
            } else {
                finalizeRoomFlow();
            }
        } else if (result.escaped) {
            gameState.finishCombat(false);
            finalizeRoomFlow();
        } else if (result.playerDied) {
            gameState.addLog("你已阵亡，本次游戏结束");
            gameState.finishCombat(false);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setEventAwaitingLeave(false);
            setStage("gameover");
        }
        refresh();
    };

    const resolvePendingScroll = (accept: boolean) => {
        gameState.resolveScrollReplacement(accept);
        refresh();
    };

    useEffect(() => {
        return () => {
            if (victoryFxTimerRef.current !== null) {
                window.clearTimeout(victoryFxTimerRef.current);
            }
        };
    }, []);

    return (
        <main className={`shell stage-shell stage-${stage}`}>
            <div className="shell-ornament shell-ornament-a" aria-hidden="true" />
            <div className="shell-ornament shell-ornament-b" aria-hidden="true" />
            <div className="shell-grain" aria-hidden="true" />
            {showVictoryFx && (
                <div key={victoryFxKey} className="victory-fx" role="status" aria-live="assertive">
                    <div className="victory-fx-backdrop" aria-hidden="true" />
                    <div className="victory-fx-shards" aria-hidden="true">
                        {VICTORY_SHARDS.map((shard, idx) => (
                            (() => {
                                const shardStyle: VictoryShardStyle = {
                                    left: shard.left,
                                    animationDelay: shard.delay,
                                    animationDuration: shard.duration,
                                    width: shard.size,
                                    height: shard.size,
                                    "--victory-drift": shard.drift,
                                    "--victory-hue": shard.hue,
                                };

                                return (
                                    <span
                                        key={`victory-shard-${victoryFxKey}-${idx}`}
                                        className="victory-fx-shard"
                                        style={shardStyle}
                                    />
                                );
                            })()
                        ))}
                    </div>
                    <div className="victory-fx-center">
                        <span className="victory-fx-kicker">地牢终焉已破</span>
                        <strong className="victory-fx-title">鹰魂结晶</strong>
                        <span className="victory-fx-detail">你击败了地牢终焉，结晶已完成收束。</span>
                    </div>
                </div>
            )}
            {showWelcomeFx && (
                <div
                    key={welcomeFxKey}
                    className="welcome-fx"
                    role="status"
                    aria-live="polite"
                    style={
                        {
                            "--welcome-origin-x": `${(welcomeFxOrigin.x * 100).toFixed(2)}vw`,
                            "--welcome-origin-y": `${(welcomeFxOrigin.y * 100).toFixed(2)}vh`,
                        } as React.CSSProperties
                    }
                >
                    <div className="welcome-fx-shards" aria-hidden="true">
                        {[
                            { dx: "-30vw", dy: "-20vh", size: "14px", delay: "40ms", duration: "2260ms", rotate: "-420deg" },
                            { dx: "-18vw", dy: "-28vh", size: "10px", delay: "0ms", duration: "2120ms", rotate: "-320deg" },
                            { dx: "22vw", dy: "-24vh", size: "12px", delay: "70ms", duration: "2200ms", rotate: "380deg" },
                            { dx: "34vw", dy: "-10vh", size: "16px", delay: "120ms", duration: "2360ms", rotate: "460deg" },
                            { dx: "-26vw", dy: "18vh", size: "11px", delay: "110ms", duration: "2180ms", rotate: "-360deg" },
                            { dx: "28vw", dy: "20vh", size: "13px", delay: "160ms", duration: "2320ms", rotate: "410deg" },
                        ].map((shard, idx) => (
                            <span
                                key={`welcome-shard-${idx}`}
                                className="welcome-fx-shard"
                                style={
                                    {
                                        "--welcome-shard-x": shard.dx,
                                        "--welcome-shard-y": shard.dy,
                                        "--welcome-shard-rotate": shard.rotate,
                                        width: shard.size,
                                        height: shard.size,
                                        animationDelay: shard.delay,
                                        animationDuration: shard.duration,
                                    } as React.CSSProperties
                                }
                            />
                        ))}
                    </div>
                    <div className="welcome-fx-inner">
                        <span className="welcome-fx-kicker">欢迎你，冒险者</span>
                        <strong className="welcome-fx-title">FALCON CRYPT</strong>
                    </div>
                </div>
            )}
            {stage === "menu" ? (
                <section className="left-panel stage-panel-main menu-only-panel menu-stage-panel">
                    <section className="menu-hero" aria-label="首页概览">
                        <div className="menu-hero-copy">
                            <span className="menu-hero-kicker">FalconCrypt</span>
                            <h1 className="menu-hero-title">
                                遗迹不是地图，
                                <br />
                                是一台会吞噬判断的仪表盘。
                            </h1>
                            <p className="menu-hero-text">
                                文字冒险为核心，围绕地图预判、资源波动与房间事件，可视化地向地牢深处推进。
                            </p>
                            <div className="menu-hero-actions">
                                <button ref={startButtonRef} data-action-id="start-new-run" onClick={() => triggerAction("start-new-run", startNewRun)}>
                                    进入遗迹
                                </button>
                                <span className="menu-hero-caption">先选角色，再进入四层地牢，围绕资源和路径做持续取舍。</span>
                            </div>
                        </div>
                        <div className="menu-hero-sigil" aria-hidden="true">
                            <div className="menu-hero-sigil-core" />
                            <div className="menu-hero-sigil-ring menu-hero-sigil-ring-outer" />
                            <div className="menu-hero-sigil-ring menu-hero-sigil-ring-mid" />
                            <div className="menu-hero-sigil-ring menu-hero-sigil-ring-inner" />
                            <div className="menu-hero-sigil-axis menu-hero-sigil-axis-a" />
                            <div className="menu-hero-sigil-axis menu-hero-sigil-axis-b" />
                        </div>
                        <div className="menu-hero-metrics">
                            {menuHeroStats.map((item) => (
                                <div key={item.label} className="menu-hero-metric">
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </section>
                </section>
            ) : (
                <>
                    <section className="left-panel stage-panel-main">
                        <div className="map-canvas-row">
                            <div>
                                <header className="panel-title">地图</header>
                                <div className="map-panel">
                                    <div className="map-floor">
                                        <div className="map-floor-title">当前层 B{snapshot.dungeon.floor}</div>
                                        <div className="map-room-list" aria-label={`当前层 B${snapshot.dungeon.floor} 路径`}>
                                            {currentFloorMap.map((room) => (
                                                <div key={room.key} className="map-room-node">
                                                    <span
                                                        className={`map-room ${room.revealed ? "is-revealed" : ""} ${room.isCurrent ? "is-current" : ""} ${room.reorderedByBranch ? "is-reordered" : ""}`}
                                                    >
                                                        {room.floor}-{room.index} {room.display}
                                                    </span>
                                                    {room.chosenBranchName && (
                                                        <>
                                                            <span className="map-branch-link" aria-hidden="true" />
                                                            <span className="map-room map-room-branch is-revealed">{room.chosenBranchName}</span>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {hasNextFloor && nextFloor && (
                                        <div className="map-floor">
                                            <div className="map-floor-title">下一层 B{nextFloor}</div>
                                            <div className="map-room-list" aria-label={`下一层 B${nextFloor} 预判`}>
                                                {nextFloorMap.map((room) => (
                                                    <div key={room.key} className="map-room-node">
                                                        <span className={`map-room ${room.revealed ? "is-revealed" : ""} ${room.reorderedByBranch ? "is-reordered" : ""}`}>
                                                            {room.floor}-{room.index} {room.display}
                                                        </span>
                                                        {room.chosenBranchName && (
                                                            <>
                                                                <span className="map-branch-link" aria-hidden="true" />
                                                                <span className="map-room map-room-branch is-revealed">{room.chosenBranchName}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="map-canvas-box">
                                <header className="panel-title">动画</header>
                                <GameCanvas
                                    dangerLevel={dangerLevel}
                                    combatIntroTriggerKey={combatIntroTriggerKey}
                                    combatActionTriggerKey={combatActionTriggerKey}
                                    combatActionType={combatActionType}
                                    roomIntroTriggerKey={roomIntroTriggerKey}
                                    roomIntroType={roomIntroType}
                                    resourcePulseTriggerKey={resourcePulseTriggerKey}
                                    resourcePulseTone={resourcePulseTone}
                                    resourcePulsePower={resourcePulsePower}
                                />
                            </div>
                        </div>

                        <header className="panel-title">日志</header>
                        <div className="log-grid" aria-label="按类别分组日志">
                            {LOG_SECTION_ORDER.map((section) => (
                                <section key={section} className={`log-lane log-lane-${section} ${logViews[section].length > 3 ? "is-scrollable" : ""}`}>
                                    <header className="log-lane-head">
                                        <div>
                                            <span className="log-lane-kicker">{section.toUpperCase()}</span>
                                            <span className="log-lane-title">{LOG_SECTION_TITLES[section]}</span>
                                        </div>
                                        <span className="log-lane-count">{logViews[section].length}</span>
                                    </header>
                                    <div className={`log-lane-list ${logViews[section].length > 3 ? "is-scrollable" : ""}`}>
                                        {logViews[section].length === 0 ? (
                                            <div className="log-empty">
                                                <span>暂无记录</span>
                                                <strong>该轨道还没有新的事件回波。</strong>
                                            </div>
                                        ) : (
                                            logViews[section].map((entry) => (
                                                <article
                                                    key={entry.id}
                                                    className={`log-entry log-entry-${entry.category} ${entry.detail ? "" : "log-entry-detail-standalone"}`.trim()}
                                                >
                                                    {entry.detail ? <span className="log-entry-index">{entry.indexLabel}</span> : null}
                                                    <span className="log-entry-line">
                                                        {entry.detail && entry.emphasis ? (
                                                            <>
                                                                <strong className="log-entry-emphasis">{entry.emphasis}</strong>
                                                                <span className="log-entry-detail">{entry.detail}</span>
                                                            </>
                                                        ) : entry.detail ? (
                                                            <span className="log-entry-detail log-entry-detail-full">{entry.detail}</span>
                                                        ) : (
                                                            <strong className="log-entry-emphasis log-entry-detail-only">{entry.emphasis}</strong>
                                                        )}
                                                    </span>
                                                </article>
                                            ))
                                        )}
                                    </div>
                                </section>
                            ))}
                        </div>
                        <div className="actions" ref={actionsRef}>
                            {pendingScroll ? (
                                <>
                                    <button data-action-id="pending-scroll-accept" onClick={() => triggerAction("pending-scroll-accept", () => resolvePendingScroll(true))}>
                                        替换为 {pendingScroll}
                                    </button>
                                    <button data-action-id="pending-scroll-keep" onClick={() => triggerAction("pending-scroll-keep", () => resolvePendingScroll(false))}>
                                        保留当前卷轴
                                    </button>
                                </>
                            ) : (
                                <>
                                    {stage === "character" &&
                                        charOptions.map((c, i) => {
                                            const hint = getCharacterHoverHint(c);
                                            return (
                                                <button
                                                    key={c[0]}
                                                    className="character-option-btn"
                                                    data-action-id={`character-${i}`}
                                                    onClick={() => triggerAction(`character-${i}`, () => confirmCharacter(i))}
                                                    onMouseEnter={() => setHoveredChar(c)}
                                                    onMouseLeave={() => setHoveredChar(null)}
                                                    onFocus={() => setHoveredChar(c)}
                                                    onBlur={() => setHoveredChar(null)}
                                                >
                                                    <span className="character-option-label">
                                                        选择 {c[0]} / {c[6]}
                                                    </span>
                                                    <span className="character-option-tip" aria-hidden="true">
                                                        <span>{hint.trait}</span>
                                                        <span>{hint.skill}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    {stage === "explore" && (
                                        <>
                                            <button data-action-id="enter-room" onClick={() => triggerAction("enter-room", enterRoom)}>
                                                {exploreEnterLabel}
                                            </button>
                                            {snapshot.player.scroll === "治疗术" && (
                                                <button
                                                    className="scroll-action-btn"
                                                    data-action-id="explore-heal-scroll"
                                                    onClick={() => triggerAction("explore-heal-scroll", useHealScrollInExplore, false)}
                                                    onMouseEnter={applyExploreHealScrollPreview}
                                                    onMouseLeave={clearHoveredResourcePreview}
                                                    onFocus={applyExploreHealScrollPreview}
                                                    onBlur={clearHoveredResourcePreview}
                                                >
                                                    使用治疗术
                                                    {renderScrollTooltip("治疗术")}
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {stage === "event" &&
                                        activeEvent &&
                                        (activeEvent === "shop_event" && shopInventory ? (
                                            <>
                                                <div className="shop-board">
                                                    <div className="shop-section">
                                                        <div className="shop-title">买入</div>
                                                        <div className="shop-list">
                                                            {shopInventory.buy.map((action) => (
                                                                <button
                                                                    key={action.id}
                                                                    data-action-id={action.id}
                                                                    onClick={() => triggerAction(action.id, () => executeRoomAction(action.id), false)}
                                                                    disabled={Boolean(action.disabledReason)}
                                                                    title={action.disabledReason}
                                                                    {...getSpendPreviewHandlers(action)}
                                                                >
                                                                    <ActionButtonContent action={action} />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="shop-section">
                                                        <div className="shop-title">卖出</div>
                                                        <div className="shop-list">
                                                            {shopInventory.sell.map((action) => (
                                                                <button
                                                                    key={action.id}
                                                                    data-action-id={action.id}
                                                                    onClick={() => triggerAction(action.id, () => executeRoomAction(action.id), false)}
                                                                    disabled={Boolean(action.disabledReason)}
                                                                    title={action.disabledReason}
                                                                    {...getSpendPreviewHandlers(action)}
                                                                >
                                                                    <ActionButtonContent action={action} />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                {gameState
                                                    .getRoomActions(activeEvent)
                                                    .filter((action) => action.id === "leave")
                                                    .map((action) => (
                                                        <button
                                                            key={action.id}
                                                            data-action-id={action.id}
                                                            onClick={() => triggerAction(action.id, leaveCurrentEvent)}
                                                            disabled={Boolean(action.disabledReason)}
                                                            title={action.disabledReason}
                                                            {...getSpendPreviewHandlers(action)}
                                                        >
                                                            <ActionButtonContent action={action} />
                                                        </button>
                                                    ))}
                                            </>
                                        ) : (
                                            <>
                                                {activeEvent === "mine_event" && (
                                                    <div className="event-tip">提示：本房间只要执行过挖掘，离开后将跳过通用房间结算。</div>
                                                )}
                                                {gameState
                                                    .getRoomActions(activeEvent)
                                                    .filter((action) => {
                                                        if (eventAwaitingLeave) return action.id === "leave";
                                                        if (
                                                            (activeEvent === "chest_event" ||
                                                                activeEvent === "trap_event" ||
                                                                activeEvent === "bonfire_event") &&
                                                            action.id === "leave"
                                                        ) {
                                                            return false;
                                                        }
                                                        return true;
                                                    })
                                                    .map((action) => (
                                                        <button
                                                            key={action.id}
                                                            className={
                                                                (activeEvent === "forge_event" && (action.id === "weapon" || action.id === "armor" || action.id.startsWith("forge_armor_"))) ||
                                                                    (activeEvent === "trap_event" && (action.id === "disarm" || action.id === "rush")) ||
                                                                    (activeEvent === "statue_event" && (action.id === "pray" || action.id === "offer"))
                                                                    ? "scroll-action-btn"
                                                                    : undefined
                                                            }
                                                            data-action-id={action.id}
                                                            onClick={() =>
                                                                action.id === "leave"
                                                                    ? triggerAction(action.id, leaveCurrentEvent)
                                                                    : triggerAction(action.id, () => executeRoomAction(action.id))
                                                            }
                                                            disabled={Boolean(action.disabledReason)}
                                                            title={action.disabledReason}
                                                            {...getSpendPreviewHandlers(action)}
                                                        >
                                                            <ActionButtonContent action={action} />
                                                            {activeEvent === "trap_event" ? renderTrapActionTooltip(action.id) : null}
                                                            {activeEvent === "statue_event" ? renderStatueActionTooltip(action.id) : null}
                                                            {activeEvent === "forge_event" && action.id === "weapon"
                                                                ? renderActionTooltip(FORGE_HOVER_HINTS.weapon)
                                                                : null}
                                                            {activeEvent === "forge_event" && action.id === "armor"
                                                                ? renderActionTooltip(FORGE_HOVER_HINTS.armor)
                                                                : null}
                                                            {activeEvent === "forge_event" && action.id === "forge_armor_thorns"
                                                                ? renderActionTooltip(FORGE_HOVER_HINTS.thorns)
                                                                : null}
                                                            {activeEvent === "forge_event" && action.id === "forge_armor_heavy"
                                                                ? renderActionTooltip(FORGE_HOVER_HINTS.heavy)
                                                                : null}
                                                        </button>
                                                    ))}
                                            </>
                                        ))}
                                    {stage === "combat" &&
                                        gameState.getCombatActions().map((action) => (
                                            <button
                                                key={action.id}
                                                className={action.id === "scroll" || action.id === "skill" || action.id === "critical" ? "scroll-action-btn" : undefined}
                                                data-action-id={action.id}
                                                onClick={() => triggerAction(action.id, () => handleCombatAction(action.id as CombatActionType), false)}
                                                disabled={Boolean(action.disabledReason)}
                                                title={action.disabledReason}
                                                {...getSpendPreviewHandlers(action)}
                                            >
                                                <ActionButtonContent action={action} />
                                                {action.id === "critical" ? renderCriticalTooltip() : null}
                                                {action.id === "scroll" ? renderScrollTooltip(snapshot.player.scroll) : null}
                                                {action.id === "skill" ? renderSkillTooltip(snapshot.player.character) : null}
                                            </button>
                                        ))}
                                    {stage === "gameover" && (
                                        <button data-action-id="return-menu" onClick={() => triggerAction("return-menu", returnToMenu)}>
                                            返回主页
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </section>

                    <div className="right-side-cluster">
                        <section className="right-panel stage-panel-side">
                            <section className="status-hero" aria-label="状态概览">
                                <div className="status-hero-main">
                                    <span className="status-hero-kicker">运行状态</span>
                                    <div className="status-hero-value-row">
                                        <strong className="status-hero-stage">{currentStageLabel}</strong>
                                        <span className="status-hero-dot" aria-hidden="true" />
                                        <span className="status-hero-focus">{currentFocusLabel}</span>
                                    </div>
                                </div>
                                <div className="status-hero-badge">
                                    <span>危险指数</span>
                                    <strong>{dangerLevel}/5</strong>
                                </div>
                            </section>
                            <header className="panel-title">状态</header>
                            <div className="status-overview">
                                <div className="overview-chip">
                                    <span>角色</span>
                                    <strong>{displayCharacter?.[0] ?? "-"}</strong>
                                </div>
                                <div className="overview-chip">
                                    <span>{previewChar ? "技能" : stage === "event" ? "事件" : "怪物"}</span>
                                    <strong>{currentFocusLabel}</strong>
                                </div>
                                <div className="overview-chip">
                                    <span>卷轴</span>
                                    <strong className={(hoveredSpendPreview?.scroll ?? 0) > 0 ? "scroll-preview consume-pulse" : "scroll-preview"}>{displayScroll}</strong>
                                </div>
                                <div className="overview-chip">
                                    <span>攻击</span>
                                    <strong className="atk-line">
                                        <span className="atk-main">[{atkMin}~{atkMax}]</span>
                                        {displayExtraAtk > 0 ? (
                                            <span className={`atk-bonus ${hasTempExtraAtkInDisplay ? "atk-bonus-temp" : ""}`}>+{displayExtraAtk}</span>
                                        ) : (
                                            ""
                                        )}
                                        {hoveredGainPreview?.extraAtk && (
                                            <span
                                                className={`atk-gain-hint ${hoveredGainPreview.extraAtk === "plusminus" ? "is-mixed" : hoveredGainPreview.extraAtk === "plusmaybe" ? "is-maybe" : ""}`}
                                            >
                                                {gainHintText(hoveredGainPreview.extraAtk)}
                                            </span>
                                        )}
                                    </strong>
                                </div>
                            </div>

                            <div className="resource-stack">
                                <SegmentedResource
                                    icon="❤"
                                    label="生命"
                                    value={displayHp}
                                    max={playerHpMax}
                                    segments={hpSegments}
                                    consumeCount={hoveredSpendPreview?.hp ?? 0}
                                    gainHint={hoveredGainPreview?.hp}
                                    tone="hp"
                                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.hp)}
                                />
                                <SegmentedResource
                                    valuePrefix={armorEffectStars}
                                    icon="🛡"
                                    label="护甲"
                                    value={displayDefense}
                                    max={defenseMax}
                                    displayValue={defenseDisplayValue}
                                    segments={defSegments}
                                    consumeCount={hoveredSpendPreview?.defense ?? 0}
                                    gainHint={hoveredGainPreview?.defense}
                                    secondaryGainHint={hoveredGainPreview?.defenseMax}
                                    secondaryGainHintPrefix="Max"
                                    tone="shield"
                                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.shield)}
                                />
                                {stage === "combat" && (
                                    <IconStripResource
                                        icon="✦"
                                        label="技能点"
                                        value={snapshot.combat.skillPoint}
                                        unit={1}
                                        maxValue={12}
                                        consumeCount={hoveredSpendPreview?.skillPoint ?? 0}
                                        gainHint={hoveredGainPreview?.skillPoint}
                                        tone="path"
                                        threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.path)}
                                    />
                                )}
                                <IconStripResource
                                    icon="🍖"
                                    label="食物"
                                    value={displayFood}
                                    unit={1}
                                    maxValue={foodMax}
                                    segments={foodSegments}
                                    consumeCount={hoveredSpendPreview?.food ?? 0}
                                    gainHint={hoveredGainPreview?.food}
                                    tone="food"
                                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.food)}
                                />
                                <IconStripResource
                                    icon="🪙"
                                    label="金币"
                                    value={displayCoin}
                                    unit={1}
                                    maxValue={coinMax}
                                    segments={coinSegments}
                                    consumeCount={hoveredSpendPreview?.coin ?? 0}
                                    gainHint={hoveredGainPreview?.coin}
                                    tone="coin"
                                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.coin)}
                                />
                                {stage === "combat" && (
                                    <MonsterCompositeResource
                                        hp={snapshot.combat.monsterHp || 0}
                                        hpMax={monsterMax}
                                        atk={effectiveMonsterAtk}
                                        atkMax={monsterAtkMax}
                                    />
                                )}
                                <XpCompositeResource
                                    xp={snapshot.player.xp}
                                    xpMax={XP_MAX}
                                    xpLevel={snapshot.player.xpLevel}
                                    xpGainHint={hoveredGainPreview?.xp}
                                    levelGainHint={hoveredGainPreview?.xpLevel}
                                />
                                <ProgressCompositeResource room={snapshot.dungeon.roomIdx} roomMax={roomMax} floor={snapshot.dungeon.floor} floorMax={floorMax} />
                            </div>
                        </section>

                        {showDeveloperPanel && (
                            <section
                                className={`developer-panel${developerPanelDragging ? " is-dragging" : ""}`}
                                ref={developerPanelRef}
                                aria-label="开发者面板"
                                style={{ left: `${developerPanelPosition.x}px`, top: `${developerPanelPosition.y}px` }}
                                onPointerDown={handleDeveloperPanelPointerDown}
                            >
                                <header className="developer-panel-head">
                                    <div>
                                        <div className="developer-panel-kicker">开发者面板</div>
                                        <strong>滚轮调值</strong>
                                    </div>
                                    <div className="developer-panel-head-tools">
                                        <span className="developer-panel-shortcut">{DEV_PANEL_TOGGLE}</span>
                                    </div>
                                </header>
                                <div className="developer-panel-note">将鼠标移到条目上滚动即可增减。隐藏项也会显示在这里。</div>
                                <div className="developer-control-list">
                                    {developerControls.map((control) => (
                                        <button
                                            key={control.key}
                                            type="button"
                                            className={`developer-control ${control.hidden ? "is-hidden-field" : ""}`}
                                            onWheel={(event) => handleDeveloperWheel(event, control.key)}
                                        >
                                            <span className="developer-control-label">{control.label}</span>
                                            <strong className="developer-control-value">{control.value}</strong>
                                        </button>
                                    ))}
                                </div>
                                <div className="developer-next-room">
                                    <div className="developer-next-room-head">
                                        <span>下个房间</span>
                                        <strong>{developerNextRoomKey ?? "无"}</strong>
                                    </div>
                                    <div className="developer-room-type-grid">
                                        {DEV_ROOM_TYPE_OPTIONS.map((eventType) => (
                                            <button
                                                key={eventType}
                                                type="button"
                                                className={`developer-room-type ${developerNextRoomType === eventType ? "is-active" : ""}`}
                                                onClick={() => handleDeveloperRoomTypeChange(eventType)}
                                                disabled={!developerNextRoomKey}
                                            >
                                                {DEV_ROOM_TYPE_LABELS[eventType]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </>
            )}
        </main>
    );
}
