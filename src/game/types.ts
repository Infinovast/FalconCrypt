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

export interface RoomNode {
    key: string;
    floor: number;
    index: number;
    name: string;
    eventType: RoomEventType;
    revealed: boolean;
    branches?: RoomTuple[];
}

export interface MapRoomView {
    key: string;
    floor: number;
    index: number;
    display: string;
    isCurrent: boolean;
    revealed: boolean;
}

export interface RoomAction {
    id: string;
    label: string;
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
    frozenEnemyTurns: number;
    tempExtraAtk: number;
    tempMonsterAtkDelta: number;
    pendingFoodCost: number;
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
