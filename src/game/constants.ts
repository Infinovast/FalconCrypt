import type { CharacterTuple, RoomTuple } from "./types";

export const FLOOR = 4;
export const ROOM_ADD = 3;
export const XP_MAX = 8;
export const SKILL_POINT_MAX = 12;
export const RESOURCE_SEGMENT_MAX = 30;
export const XP_PROGRESS_SEGMENT_MAX = 14;
export const XP_LEVEL_SEGMENT_MAX = 5;
export const MONSTER_SEGMENT_MAX = 14;
export const NEXT_ROOM_REVEAL_RATE = 0.3;
export const NEXT_FLOOR_REVEAL_RATE = 0.1;
export const BRANCH_REORDER_SUCCESS_RATE = 0.5;

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
    ["术士", 25, 8, 1, 9, 0, "神算"],
    ["圣骑士", 23, 5, 4, 8, 1, "净化"],
    ["盗贼", 24, 13, 1, 8, 0, "卷轴"],
    ["祭司", 30, 7, 1, 8, 0, "血祭"],
    ["刺客", 22, 4, 1, 7, 2, "挑衅"],
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

export const SKILL_SP_COST = {
    critical: 3,
    paladin: 4,
    priest: 6,
    assassin: 4,
} as const;

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
};

export const SHOP_BUY_POOL: ShopBuyTemplate[] = [
    { id: "small_hp", name: "小生命药水", cost: 3 },
    { id: "large_hp", name: "大生命药水", cost: 5 },
    { id: "whetstone", name: "磨刀石", cost: 4 },
    { id: "poor_armor", name: "劣质护甲板", cost: 4 },
    { id: "armor_shard", name: "护甲片", cost: 6 },
    { id: "coin_bag", name: "金币袋", cost: 3 },
    { id: "small_ration", name: "小份干粮", cost: 3 },
    { id: "large_ration", name: "大份干粮", cost: 6 },
    { id: "scroll", name: "卷轴", cost: 6 },
];

export const ROOM_RANGES = {
    chestRewardCount: { min: 0, max: 4 },
    chestCoin: { min: 2, max: 8 },
    cloudyPotion: { min: -2, max: 4 },
    poorArmor: { min: 3, max: 6 },
    trapTriggerRate: {
        disarm: 0.75,
        rush: 0.45,
    },
    trapCompensateRate: 0.5,
    trapDamage: {
        fireTrue: { min: 2, max: 6 },
        rock: { min: 2, max: 5 },
        spike: { min: 4, max: 8 },
    },
    trapReward: {
        rockCoin: { min: 3, max: 6 },
        spikeFood: { min: 2, max: 4 },
    },
    statueBlessRate: {
        normal: 0.4,
        offer: 0.9,
    },
    statueOfferCoin: { min: 3, max: 5 },
    statueBless: {
        hp: { min: 2, max: 5 },
        def: { min: 2, max: 6 },
        xp: { min: 1, max: 3, jackpot: 8, jackpotRate: 0.1 },
    },
    statueCurseTrueDamage: { min: 2, max: 5 },
    bonfire: {
        heal: { min: 2, max: 6 },
        cook: { min: 1, max: 4 },
        searchBranchCount: { min: 1, max: 3 },
        foundFood: { min: 4, max: 7 },
        foundCoin: { min: 3, max: 9 },
        weakMonsterHp: { min: 8, max: 12 },
        weakMonsterAtk: { min: 1, max: 4 },
    },
    mine: {
        noFoodTrueDamage: { min: 1, max: 3 },
        chestRateUpper: 20,
        rareOreRateUpper: 30,
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
        healMin: 2,
        hungerLossMin: 1,
    },
} as const;
