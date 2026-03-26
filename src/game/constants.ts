import type { CharacterTuple, RoomTuple } from "./types";

export const FLOOR = 4;
export const ROOM_ADD = 3;
export const XP_MAX = 8;
export const SKILL_POINT_MAX = 12;

export const CHARS: CharacterTuple[] = [
    ["术士", 21, 8, 1, 6, 0, "神算"],
    ["圣骑士", 19, 5, 4, 5, 1, "净化"],
    ["盗贼", 20, 13, 1, 5, 0, "卷轴"],
    ["祭司", 26, 7, 1, 5, 0, "血祭"],
    ["刺客", 18, 4, 1, 4, 2, "挑衅"],
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
