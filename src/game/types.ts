export type CharacterTuple = [
    name: string,
    hp: number,
    coin: number,
    defenseMax: number,
    food: number,
    extraAtk: number,
    skill: string
];

export type RoomTuple = [name: string, eventType: string];

export type ScrollType = "火球术" | "寒冰术" | "治疗术" | "隐身术";

export type TrapType = "fire" | "acid" | "rock" | "spike" | "pit";

export type CharacterHoverHint = {
    trait: string;
    skill: string;
};
export type TooltipContent = {
    title: string;
    detail: string;
};

export type CombatActionType = "attack" | "critical" | "skill" | "scroll";

export type RoomEventType =
    | "monster_event"
    | "boss_event"
    | "branch_event"
    | "chest_event"
    | "trap_event"
    | "shop_event"
    | "bonfire_event"
    | "forge_event"
    | "statue_event"
    | "mine_event";

export type ActionDeltaResource =
    | "hp"
    | "defense"
    | "defenseMax"
    | "skillPoint"
    | "food"
    | "coin"
    | "xp"
    | "xpLevel"
    | "extraAtk"
    | "scroll";

export type ActionDeltaHint = "plusplus" | "plusminus" | "plusmaybe";

export interface ActionDeltaRange {
    min: number;
    max: number;
}

export interface ActionDeltaBadge {
    resource: ActionDeltaResource;
    amount?: number;
    hint?: ActionDeltaHint;
    range?: ActionDeltaRange;
    label?: string;
}

export interface RoomNode {
    key: string;
    floor: number;
    index: number;
    name: string;
    eventType: RoomEventType;
    revealed: boolean;
    branches?: RoomTuple[];
    revealedBranchIndexes?: number[];
    chosenBranchName?: string;
    chosenBranchEventType?: RoomEventType;
    reorderedByBranch?: boolean;
}

export interface MapRoomView {
    key: string;
    floor: number;
    index: number;
    display: string;
    isCurrent: boolean;
    revealed: boolean;
    chosenBranchName?: string;
    reorderedByBranch: boolean;
}

export interface RoomAction {
    id: string;
    label: string;
    displayLabel?: string;
    costBadges?: ActionDeltaBadge[];
    rewardBadges?: ActionDeltaBadge[];
    disabledReason?: string;
}

export interface ShopInventoryView {
    buy: RoomAction[];
    sell: RoomAction[];
}

export interface PlayerState {
    playerName: string;
    character: CharacterTuple | null;
    hp: number;
    coin: number;
    defense: number;
    defenseMax: number;
    food: number;
    extraAtk: number;
    skill: string;
    xp: number;
    xpLevel: number;
    scroll: ScrollType | null;
    pendingScroll: ScrollType | null;
    hasThornsArmor: boolean;
    hasHeavyArmor: boolean;
}

export interface DungeonState {
    floor: number;
    roomIdx: number;
    map: Record<string, RoomNode>;
}

export interface CombatState {
    monsterName: string;
    monsterHp: number;
    monsterAtk: number;
    skillPoint: number;
    isBoss: boolean;
    skipCounterattackOnce: boolean;
    tempExtraAtk: number;
    tempMonsterAtkDelta: number;
    forgeUpgradeType: "thorns" | "heavy" | null;
}

export interface CombatActionResult {
    playerDied: boolean;
    victory: boolean;
    escaped: boolean;
}

export interface GameSnapshot {
    player: PlayerState;
    dungeon: DungeonState;
    combat: CombatState;
    logs: string[];
}
