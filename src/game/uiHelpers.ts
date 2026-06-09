import {
    CHARACTER_HOVER_HINTS,
    CHEST_REWARD_POOL,
    DANGER_INDEX_RULES,
    RESOURCE_SEGMENT_MAX,
    SCROLL_INFO,
    SHOP_BUY_POOL,
    THRESHOLD_DISABLED,
} from "./constants";
import type { ThresholdRule } from "./constants";
import type { ActionDeltaBadge, ActionDeltaHint, CharacterHoverHint, CharacterTuple, RoomAction } from "./types";

export type Stage = "menu" | "character" | "explore" | "event" | "combat" | "gameover";

export type ResourceSpendKey = "hp" | "defense" | "defenseMax" | "skillPoint" | "food" | "coin" | "scroll" | "extraAtk";

export type ResourceSpendPreview = Partial<Record<ResourceSpendKey, number>>;

export type ResourceGainKey = "hp" | "defense" | "defenseMax" | "skillPoint" | "food" | "coin" | "xp" | "xpLevel" | "extraAtk";

export type ResourceGainHint = ActionDeltaHint;

export type ResourceGainPreview = Partial<Record<ResourceGainKey, ResourceGainHint>>;

export type ResourceDeltaRange = { min: number; max: number };

export type ResourceDeltaRanges = Partial<Record<ResourceGainKey, ResourceDeltaRange>>;

export type ActionDeltaBadgeTone = "cost" | "reward";

export type LogCategory = "room" | "combat" | "resource" | "system";

export type LogEntryView = {
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

export type TooltipHint = {
    title: string;
    detail?: string;
};

export const LOG_SECTION_ORDER: LogCategory[] = ["room", "combat", "resource", "system"];

export const LOG_SECTION_TITLES: Record<LogCategory, string> = {
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

export const calcScaledSegments = (cap: number, maxSegments = RESOURCE_SEGMENT_MAX): number => {
    const safeCap = Math.max(1, cap);
    return Math.min(maxSegments, Math.max(1, Math.ceil(safeCap)));
};

export const buildLogBuckets = (logs: string[]): Record<LogCategory, CategorizedLog[]> => {
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

export const buildLogTimeline = (logs: string[], limit = 24): LogEntryView[] =>
    logs
        .slice(-limit)
        .map((text, idx) =>
            buildLogEntryView(
                {
                    id: `${idx}-${text}`,
                    text,
                    category: classifyLog(text),
                },
                idx
            )
        )
        .reverse();

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

export const buildLogEntryView = (entry: CategorizedLog, order: number): LogEntryView => {
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

export const calcLevelClass = (ratio: number, threshold: ThresholdRule): string => {
    if (threshold.warning === THRESHOLD_DISABLED || threshold.critical === THRESHOLD_DISABLED) {
        return "";
    }
    const warning = Math.max(0, Math.min(1, threshold.warning));
    const critical = Math.max(0, Math.min(1, threshold.critical));
    if (ratio <= critical) return "is-critical";
    if (ratio <= warning) return "is-warning";
    return "is-safe";
};

export const mergeSpendPreview = (base: ResourceSpendPreview, key: ResourceSpendKey, amount: number): void => {
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

export const getActionBadgeLabel = (badge: ActionDeltaBadge): string => badge.label ?? ACTION_BADGE_LABELS[badge.resource];

export const getActionPrimaryLabel = (action: RoomAction): string => action.displayLabel ?? action.label;

export const getActionBadgeHint = (badge: ActionDeltaBadge): ActionDeltaHint | undefined => {
    if (badge.hint) return badge.hint;
    if (!badge.range) return undefined;
    if (badge.range.max > 0 && badge.range.min > 0) return "plusplus";
    if (badge.range.max > 0 && badge.range.min < 0) return "plusminus";
    if (badge.range.max > 0 && badge.range.min === 0) return "plusmaybe";
    return undefined;
};

export const mergeSpendPreviewFromBadge = (preview: ResourceSpendPreview, badge: ActionDeltaBadge): void => {
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

export const applyActionBadgesToRanges = (ranges: ResourceDeltaRanges, badges: ActionDeltaBadge[] | undefined): void => {
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

export const hasSpendPreview = (preview: ResourceSpendPreview): boolean =>
    Object.values(preview).some((value) => typeof value === "number" && value > 0);

export const addDeltaRange = (ranges: ResourceDeltaRanges, key: ResourceGainKey, minDelta: number, maxDelta: number): void => {
    const prev = ranges[key] ?? { min: 0, max: 0 };
    ranges[key] = {
        min: prev.min + minDelta,
        max: prev.max + maxDelta,
    };
};

export const applySpendPreviewAsNegativeRanges = (ranges: ResourceDeltaRanges, spendPreview: ResourceSpendPreview): void => {
    if (spendPreview.hp) addDeltaRange(ranges, "hp", -spendPreview.hp, -spendPreview.hp);
    if (spendPreview.defense) addDeltaRange(ranges, "defense", -spendPreview.defense, -spendPreview.defense);
    if (spendPreview.defenseMax) addDeltaRange(ranges, "defenseMax", -spendPreview.defenseMax, -spendPreview.defenseMax);
    if (spendPreview.skillPoint) addDeltaRange(ranges, "skillPoint", -spendPreview.skillPoint, -spendPreview.skillPoint);
    if (spendPreview.food) addDeltaRange(ranges, "food", -spendPreview.food, -spendPreview.food);
    if (spendPreview.coin) addDeltaRange(ranges, "coin", -spendPreview.coin, -spendPreview.coin);
    if (spendPreview.extraAtk) addDeltaRange(ranges, "extraAtk", -spendPreview.extraAtk, -spendPreview.extraAtk);
};

export const buildGainPreviewFromRanges = (ranges: ResourceDeltaRanges): ResourceGainPreview => {
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

export const hasGainPreview = (preview: ResourceGainPreview): boolean =>
    Object.values(preview).some((value) => value === "plusplus" || value === "plusminus" || value === "plusmaybe");

export const gainHintText = (hint?: ResourceGainHint, prefix = ""): string => {
    if (hint === "plusminus") return `${prefix}+-`;
    if (hint === "plusmaybe") return `${prefix}+?`;
    if (hint === "plusplus") return `${prefix}++`;
    return "";
};

export const getShopBuyValueById = (itemId: string): (typeof SHOP_BUY_POOL)[number]["value"] | undefined =>
    SHOP_BUY_POOL.find((item) => item.id === itemId)?.value;

export const getChestRewardValueById = (rewardId: string): (typeof CHEST_REWARD_POOL)[number]["value"] | undefined =>
    CHEST_REWARD_POOL.find((item) => item.id === rewardId)?.value;

export const isKnownScroll = (value: string | null | undefined): value is keyof typeof SCROLL_INFO => {
    return Boolean(value && value in SCROLL_INFO);
};

export const DISABLED_THRESHOLD_RULE: ThresholdRule = {
    warning: THRESHOLD_DISABLED,
    critical: THRESHOLD_DISABLED,
};

export const getCharacterHoverHint = (character: CharacterTuple): CharacterHoverHint =>
    CHARACTER_HOVER_HINTS[character[0]] ?? {
        trait: "特色：冒险风格均衡。",
        skill: `${character[6]}：按战况灵活使用。`,
    };

export const getCharacterSkillHint = (character: CharacterTuple | null): string | null => {
    if (!character) return null;
    return CHARACTER_HOVER_HINTS[character[0]]?.skill ?? `${character[6]}：按战况灵活使用。`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const scoreByBands = (value: number, bands: readonly { max: number; score: number }[]): number => {
    const matched = bands.find((band) => value <= band.max);
    return matched?.score ?? 0;
};

export const calcDangerIndex = ({
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
