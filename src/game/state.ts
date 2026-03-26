import { CHARS, FLOOR, ROOM_ADD, ROOMS, ROOMS_WEIGHT, SKILL_POINT_MAX, XP_MAX } from "./constants";
import type { CharacterTuple, GameSnapshot, RoomTuple } from "./types";

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const weightedChoice = <T>(items: T[], weights: number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = Math.random() * total;
    for (let i = 0; i < items.length; i += 1) {
        cursor -= weights[i];
        if (cursor <= 0) return items[i];
    }
    return items[items.length - 1];
};

const sample3 = <T>(arr: T[]): T[] => {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i);
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone.slice(0, 3);
};

export class GameState {
    private chosenChars: CharacterTuple[] = [];

    snapshot: GameSnapshot = {
        player: {
            playerName: "Player",
            character: null,
            hp: 0,
            coin: 0,
            defense: 0,
            defenseMax: 0,
            food: 0,
            extraAtk: 0,
            skill: "",
            xp: 0,
            xpLevel: 1,
        },
        dungeon: {
            floor: 1,
            roomIdx: 1,
            map: {},
        },
        combat: {
            monsterName: "",
            monsterHp: 0,
            monsterAtk: 0,
            skillPoint: SKILL_POINT_MAX,
        },
        logs: [],
    };

    reset(): void {
        this.snapshot.player = {
            playerName: "Player",
            character: null,
            hp: 0,
            coin: 0,
            defense: 0,
            defenseMax: 0,
            food: 0,
            extraAtk: 0,
            skill: "",
            xp: 0,
            xpLevel: 1,
        };
        this.snapshot.dungeon = { floor: 1, roomIdx: 1, map: {} };
        this.snapshot.combat = {
            monsterName: "",
            monsterHp: 0,
            monsterAtk: 0,
            skillPoint: SKILL_POINT_MAX,
        };
        this.snapshot.logs = [];
    }

    getCharacterOptions(): CharacterTuple[] {
        this.chosenChars = sample3(CHARS);
        return this.chosenChars;
    }

    pickCharacter(index: number): void {
        const selected = this.chosenChars[index];
        if (!selected) return;
        this.snapshot.player.character = selected;
        this.snapshot.player.playerName = `${selected[0]}Player`;
        this.snapshot.player.hp = selected[1];
        this.snapshot.player.coin = selected[2];
        this.snapshot.player.defenseMax = selected[3];
        this.snapshot.player.defense = selected[3];
        this.snapshot.player.food = selected[4];
        this.snapshot.player.extraAtk = selected[5];
        this.snapshot.player.skill = selected[6];
        this.addLog(`已选择角色: ${selected[0]} / 技能: ${selected[6]}`);
        this.generateMap();
    }

    generateMap(): void {
        const nextMap: Record<string, RoomTuple> = {};
        for (let floor = 1; floor <= FLOOR; floor += 1) {
            for (let room = 1; room <= floor + ROOM_ADD; room += 1) {
                const key = `${floor}-${room}`;
                nextMap[key] = room < floor + ROOM_ADD ? weightedChoice(ROOMS, ROOMS_WEIGHT) : ROOMS[ROOMS.length - 1];
            }
        }
        this.snapshot.dungeon.map = nextMap;
        this.addLog("地图已生成");
    }

    getCurrentRoomEvent(): string | null {
        const { floor, roomIdx, map } = this.snapshot.dungeon;
        const room = map[`${floor}-${roomIdx}`];
        if (!room) return null;
        this.addLog(`进入房间: ${room[0]}`);
        return room[1];
    }

    moveNextRoom(): void {
        this.snapshot.dungeon.roomIdx += 1;
        const roomLimit = this.snapshot.dungeon.floor + ROOM_ADD;
        if (this.snapshot.dungeon.roomIdx > roomLimit) {
            this.snapshot.dungeon.floor += 1;
            this.snapshot.dungeon.roomIdx = 1;
        }
    }

    startCombat(monsterName: string, hp: number, atk: number): void {
        this.snapshot.combat.monsterName = monsterName;
        this.snapshot.combat.monsterHp = hp;
        this.snapshot.combat.monsterAtk = atk;
        this.snapshot.combat.skillPoint = SKILL_POINT_MAX;
        this.addLog(`遭遇 ${monsterName}`);
    }

    playerAttack(): number {
        const minAtk = this.snapshot.player.xpLevel;
        const maxAtk = 2 * this.snapshot.player.xpLevel + 4;
        const damage = randomInt(minAtk, maxAtk) + this.snapshot.player.extraAtk;
        this.snapshot.combat.monsterHp -= damage;
        this.addLog(`造成伤害 ${damage}`);
        return damage;
    }

    processRoomConsequences(): void {
        if (this.snapshot.player.xp >= XP_MAX) {
            const gained = Math.floor(this.snapshot.player.xp / XP_MAX);
            this.snapshot.player.xp %= XP_MAX;
            this.snapshot.player.xpLevel += gained;
            this.addLog(`升级 +${gained}`);
        }

        if (this.snapshot.player.food > 0) {
            this.snapshot.player.food -= 1;
            const heal = randomInt(2, this.snapshot.dungeon.floor + 2);
            this.snapshot.player.hp += heal;
            this.addLog(`食物恢复 +${heal}`);
        } else {
            const loss = randomInt(1, this.snapshot.dungeon.floor + 2);
            this.snapshot.player.hp = Math.max(0, this.snapshot.player.hp - loss);
            this.addLog(`饥饿损失 -${loss}`);
        }
    }

    addLog(message: string): void {
        this.snapshot.logs.push(message);
        if (this.snapshot.logs.length > 60) {
            this.snapshot.logs.shift();
        }
    }
}

export const gameState = new GameState();
