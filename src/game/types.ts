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
}

export interface DungeonState {
    floor: number;
    roomIdx: number;
    map: Record<string, RoomTuple>;
}

export interface CombatState {
    monsterName: string;
    monsterHp: number;
    monsterAtk: number;
    skillPoint: number;
}

export interface GameSnapshot {
    player: PlayerState;
    dungeon: DungeonState;
    combat: CombatState;
    logs: string[];
}
