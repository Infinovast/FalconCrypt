import type { CharacterHoverHint, CharacterTuple, RoomTuple, TooltipContent } from "./types";

export type ScrollInfo = {
    title: string;
    detail: string;
};

export const FLOOR = 4;
export const ROOM_ADD = 3;
export const CHARACTER_OPTION_COUNT = 4;
export const XP_MAX = 8;
export const SKILL_POINT_MAX = 12;
export const RESOURCE_SEGMENT_MAX = 30;
export const XP_PROGRESS_SEGMENT_MAX = 14;
export const XP_LEVEL_SEGMENT_MAX = 5;
export const MONSTER_SEGMENT_MAX = 14;
export const NEXT_ROOM_REVEAL_RATE = 0.3;
export const NEXT_FLOOR_REVEAL_RATE = 0.1;
export const BRANCH_REORDER_SUCCESS_RATE = 0.5;

export const DANGER_INDEX_RULES = {
    floorStep: 0.9,
    roomStep: 0.35,
    hpBands: [
        { max: 4, score: 2.2 },
        { max: 8, score: 1.4 },
        { max: 12, score: 0.7 },
    ],
    defenseBands: [
        { max: 0, score: 1.2 },
        { max: 2, score: 0.6 },
    ],
    foodBands: [
        { max: 0, score: 1.6 },
        { max: 2, score: 0.9 },
        { max: 4, score: 0.3 },
    ],
    eventScore: 0.2,
    combatScore: 0.75,
    bossScore: 1.1,
    monsterHpDivisor: 18,
    monsterHpScoreMax: 0.8,
    monsterAtkDivisor: 6,
    monsterAtkScoreMax: 0.9,
    minScore: 0,
    maxScore: 6.2,
} as const;

export type ForgeUpgradeType = "thorns" | "heavy";
export type ForgeActionTooltipKey = "weapon" | "armor" | ForgeUpgradeType;

export const THRESHOLD_DISABLED = -1;

export type ResourceThresholdKey = "hp" | "shield" | "enemy" | "food" | "coin" | "path";

export type ThresholdRule = {
    warning: number;
    critical: number;
};

export const RESOURCE_THRESHOLD_RULES: Record<ResourceThresholdKey, ThresholdRule> = {
    hp: { warning: 0.5, critical: 0.25 },
    shield: { warning: 0.5, critical: 0.25 },
    enemy: { warning: 0.5, critical: 0.25 },
    food: { warning: 0.34, critical: 0.17 },
    coin: { warning: THRESHOLD_DISABLED, critical: THRESHOLD_DISABLED },
    path: { warning: THRESHOLD_DISABLED, critical: THRESHOLD_DISABLED },
};

export const CHARS: CharacterTuple[] = [
    ["术士", 22, 8, 1, 9, 0, "神算"],
    ["圣骑士", 20, 5, 4, 9, 1, "净化"],
    ["盗贼", 21, 13, 1, 8, 0, "卷轴"],
    ["祭司", 27, 7, 1, 8, 0, "血祭"],
    ["刺客", 19, 4, 1, 7, 2, "挑衅"],
];

export const ROOMS: RoomTuple[] = [
    ["怪物", "monster_event"],
    ["宝箱", "chest_event"],
    ["陷阱", "trap_event"],
    ["商人", "shop_event"],
    ["篝火", "bonfire_event"],
    ["铸锻", "forge_event"],
    ["雕像", "statue_event"],
    ["矿洞", "mine_event"],
    ["BOSS", "boss_event"],
];

export const ROOMS_WEIGHT = [2, 1, 1, 1, 1, 1, 1, 1, 0];

export const BRANCH_ROOM: RoomTuple = ["分叉口", "branch_event"];

export const SCROLL_LIST = ["火球术", "寒冰术", "治疗术", "隐身术"] as const;

export const SCROLL_INFO: Record<(typeof SCROLL_LIST)[number], ScrollInfo> = {
    火球术: {
        title: "火球术",
        detail: "战斗中使用，对怪物造成 9~14 点伤害，不结束你的回合。",
    },
    寒冰术: {
        title: "寒冰术",
        detail: "战斗中使用，不结束你的回合；你下一次攻击后，敌人本回合不反击。",
    },
    治疗术: {
        title: "治疗术",
        detail: "可在探索或战斗中使用。当前 HP 大于 10 时恢复 4~7，否则恢复 9~13。",
    },
    隐身术: {
        title: "隐身术",
        detail: "战斗中使用，立刻脱离当前战斗；Boss 战无法使用。",
    },
};

export const CHARACTER_HOVER_HINTS: Record<string, CharacterHoverHint> = {
    术士: {
        trait: "术士：数值均衡，地图全览，少走弯路。",
        skill: "神算：提前看见房间分布。（被动）",
    },
    圣骑士: {
        trait: "圣骑士：高护甲开局，容错更高。",
        skill: "净化：消耗少量食物，降低敌攻。",
    },
    盗贼: {
        trait: "盗贼：高金币起步，成型更快。",
        skill: "卷轴：开局与击败Boss后获得卷轴。（被动）",
    },
    祭司: {
        trait: "祭司：高生命开局，续航稳定。",
        skill: "血祭：献祭生命，换取临时攻击。",
    },
    刺客: {
        trait: "刺客：额外攻击高，爆发强。",
        skill: "挑衅：提高敌攻，换取更高临时攻击。",
    },
};

export const SKILL_SP_COST = {
    critical: 3,
    paladin: 4,
    priest: 6,
    assassin: 4,
} as const;

export const CRITICAL_TOOLTIP: TooltipContent = {
    title: `消耗 ${SKILL_SP_COST.critical} SP 发动一次暴击。`,
    detail: "伤害倍率会在 x0.25、x0.5、x1.5、x2、x2.5 中随机。",
};

export const TRAP_ACTION_TOOLTIPS: Record<"disarm" | "rush", TooltipContent> = {
    disarm: {
        title: "触发陷阱概率：大。",
        detail: "成功可拆掉机关并拿到对应收益；失败则会触发陷阱。",
    },
    rush: {
        title: "触发陷阱概率：小。",
        detail: "成功只是不受伤地穿过，不算解除，也不会拿到拆除收益。",
    },
};

export const STATUE_ACTION_TOOLTIPS: Record<"pray" | "offer", TooltipContent> = {
    pray: {
        title: "直接向雕像祈祷，低概率获得祝福。",
        detail: "可能得到祝福奖励，失败则会受诅咒。",
    },
    offer: {
        title: "先供奉再祈祷，祝福概率更高。",
        detail: "供奉优先消耗金币，若没有则消耗食物。",
    },
};

export const FORGE_HOVER_HINTS: Record<ForgeActionTooltipKey, TooltipContent> = {
    weapon: {
        title: "锻造武器",
        detail: "随机改动一次额外攻击，并顺带拿到一点锻造经验。",
    },
    armor: {
        title: "升级护甲",
        detail: "提升 1 点护甲上限；上限到 5 后会解锁重甲改造。",
    },
    thorns: {
        title: "荆棘改造：牺牲输出，换取反伤",
        detail: "消耗 1 点额外攻击与 9 金币；战斗中敌人攻击你后，大概率反弹其攻击 50% 的伤害。",
    },
    heavy: {
        title: "重甲改造：牺牲上限，换取稳固承伤",
        detail: "消耗 2 点护甲上限与 6 金币；受到非真伤时，只要还有护甲，本次伤害不会溢出到生命。",
    },
};

export type MonsterTemplate = {
    name: string;
    hpOffset: number;
    atkOffset: number;
};

export const MONSTER_POOL: MonsterTemplate[] = [
    { name: "蜘蛛", hpOffset: 0, atkOffset: 0 },
    { name: "毒鼠", hpOffset: -1, atkOffset: 0 },
    { name: "骷髅", hpOffset: 1, atkOffset: 0 },
    { name: "灵卫", hpOffset: 1, atkOffset: 1 },
    { name: "狼人", hpOffset: 2, atkOffset: 1 },
    { name: "巨魔", hpOffset: 3, atkOffset: 1 },
    { name: "虫群", hpOffset: -1, atkOffset: 1 },
];

export const BOSS_BY_FLOOR = ["巨型蜘蛛", "蟒", "重甲骷髅", "地狱犬"] as const;

export type ShopBuyTemplate = {
    id: string;
    name: string;
    cost: number;
    value: {
        hp?: number;
        hpRange?: { min: number; max: number };
        defense?: { min: number; max: number };
        defenseMax?: number;
        extraAtk?: number;
        coin?: { min: number; max: number };
        food?: number;
        grantsScroll?: true;
    };
};

export const SHOP_BUY_POOL: ShopBuyTemplate[] = [
    { id: "small_hp", name: "小生命药水", cost: 3, value: { hp: 5 } },
    { id: "large_hp", name: "大生命药水", cost: 5, value: { hp: 9 } },
    { id: "whetstone", name: "磨刀石", cost: 4, value: { extraAtk: 1 } },
    { id: "poor_armor", name: "劣质护甲板", cost: 4, value: { defense: { min: 3, max: 6 } } },
    { id: "armor_shard", name: "护甲片", cost: 6, value: { defenseMax: 1 } },
    { id: "coin_bag", name: "金币袋", cost: 3, value: { coin: { min: 1, max: 5 } } },
    { id: "small_ration", name: "小份干粮", cost: 3, value: { food: 2 } },
    { id: "large_ration", name: "大份干粮", cost: 6, value: { food: 5 } },
    { id: "scroll", name: "卷轴", cost: 6, value: { grantsScroll: true } },
];

export type ChestRewardTemplate = {
    id: string;
    name: string;
    value: {
        hp?: number;
        hpRange?: { min: number; max: number };
        defense?: { min: number; max: number };
        defenseMax?: number;
        extraAtk?: number;
        coin?: { min: number; max: number };
        grantsScroll?: true;
    };
};

export const CHEST_REWARD_POOL: ChestRewardTemplate[] = [
    { id: "coin", name: "金币", value: { coin: { min: 5, max: 9 } } },
    { id: "cloudy", name: "浑浊药水", value: { hpRange: { min: -2, max: 4 } } },
    { id: "life", name: "秘制生命药水", value: { hp: 8 } },
    { id: "whetstone", name: "优质磨刀石", value: { extraAtk: 2 } },
    { id: "poor_armor", name: "破损护甲", value: { defense: { min: 3, max: 6 } } },
    { id: "superior_armor", name: "精良护甲", value: { defenseMax: 2 } },
    { id: "scroll", name: "卷轴", value: { grantsScroll: true } },
];

export const ROOM_RANGES = {
    branch: {
        optionCount: { min: 2, max: 3 },
    },
    trapTypes: ["fire", "acid", "rock", "spike", "pit"] as const,
    chestRewardCount: { min: 1, max: 4 },
    trapTriggerRate: {
        disarm: 0.75,
        rush: 0.45,
    },
    trapCompensateRate: 0.5,
    trapCompensateXp: { min: 1, max: 3 },
    trapDamage: {
        fireTrue: { min: 2, max: 6 },
        rock: { min: 2, max: 5 },
        spike: { min: 4, max: 8 },
        pit: { min: 3, max: 6 },
    },
    trapReward: {
        rockCoin: { min: 3, max: 6 },
        acidExtraAtk: 1,
        spikeFoodRate: 0.5,
        spikeFood: { min: 2, max: 4 },
        spikeDefMax: 2,
    },
    shop: {
        stockSize: { min: 6, max: 9 },
        sell: {
            armorShard: {
                minDefMax: 1,
                defMaxCost: 1,
                coinGain: 5,
            },
            food: {
                foodCost: 1,
                coinGain: 1,
            },
            scrollCoinGain: 5,
        },
    },
    forge: {
        weaponCost: 3,
        armorCost: 5,
        armorDefMaxCap: 5,
        xpGain: { min: 1, max: 3 },
        weaponDeltaPool: [-1, 1, 1, 2] as const,
        armorDefMaxGain: 1,
        armorDefGain: 1,
        upgradePool: ["thorns", "heavy"] as const satisfies readonly ForgeUpgradeType[],
        thornsCostCoin: 9,
        thornsCostExtraAtk: 1,
        thornsReflectRate: 0.75,
        thornsReflectRatio: 0.5,
        heavyArmorCostCoin: 6,
        heavyArmorCostDefMax: 2,
    },
    statueBlessRate: {
        normal: 0.4,
        offer: 0.9,
    },
    statueOfferCoin: { min: 3, max: 5 },
    statue: {
        offerFoodCost: 1,
        blessAtkGain: 1,
        curseTypeRate: 0.5,
        curseXpLoss: 1,
    },
    statueBless: {
        hp: { min: 2, max: 5 },
        def: { min: 2, max: 6 },
        xp: { min: 1, max: 3, jackpot: 8, jackpotRate: 0.1 },
    },
    statueCurseTrueDamage: { min: 2, max: 5 },
    bonfire: {
        heal: { min: 5, max: 8 },
        cook: { min: 2, max: 5 },
        polishDeltaPool: [-1, 1, 1, 2] as const,
        searchBranchCount: { min: 1, max: 3 },
        foundFood: { min: 4, max: 7 },
        foundCoin: { min: 5, max: 10 },
        weakMonsterHp: { min: 8, max: 13 },
        weakMonsterAtk: { min: 1, max: 4 },
    },
    mine: {
        digFoodCost: 1,
        minHpRequiredWithoutFood: 2,
        rollMax: 100,
        noFoodTrueDamage: { min: 1, max: 3 },
        chestRateUpper: 20,
        rareOreRateUpper: 30,
        rareOreAtkRate: 0.5,
        rareOreAtkGain: 1,
        rareOreDefMaxGain: 2,
        normalOreRateUpper: 60,
        plantRateUpper: 80,
        larvaRateUpper: 90,
        normalCoin: { min: 3, max: 8 },
        plantFood: { min: 1, max: 3 },
        plantHp: { min: 2, max: 5 },
        larvaHp: { min: 9, max: 13 },
        larvaAtk: { min: 2, max: 4 },
    },
    roomConsequence: {
        foodCost: 1,
        healMin: 2,
        hungerLossMin: 1,
        defenseRecover: 1,
    },
} as const;
