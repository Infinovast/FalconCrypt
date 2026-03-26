import { describe, expect, it, vi, afterEach } from "vitest";
import { GameState } from "./state";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("GameState map generation", () => {
    it("builds 4 floors with 4/5/6/7 rooms and boss revealed", () => {
        const state = new GameState();
        state.generateMap();

        const expectedRoomCounts = [4, 5, 6, 7];
        expectedRoomCounts.forEach((count, floorIdx) => {
            const floor = floorIdx + 1;
            const floorRooms = Object.values(state.snapshot.dungeon.map).filter((room) => room.floor === floor);
            expect(floorRooms).toHaveLength(count);

            const boss = state.snapshot.dungeon.map[`${floor}-${count}`];
            expect(boss.eventType).toBe("boss_event");
            expect(boss.revealed).toBe(true);
        });
    });
});

describe("GameState shop inventory", () => {
    it("keeps fixed stock in same shop room", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "商人",
                eventType: "shop_event",
                revealed: true,
            },
        };

        const first = state.getShopInventoryView();
        const second = state.getShopInventoryView();

        expect(first.buy.length).toBeGreaterThanOrEqual(6);
        expect(first.buy.length).toBeLessThanOrEqual(9);
        expect(second.buy.map((it) => it.id)).toEqual(first.buy.map((it) => it.id));
    });
});

describe("GameState combat actions", () => {
    it("frost scroll freezes enemy turn", () => {
        const state = new GameState();
        state.startCombat("测试怪", 20, 5, false);
        state.snapshot.player.scroll = "寒冰术";
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;

        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const result = state.performCombatAction("scroll");

        expect(result.escaped).toBe(false);
        expect(result.playerDied).toBe(false);
        expect(state.snapshot.player.hp).toBe(20);
        expect(state.snapshot.combat.frozenEnemyTurns).toBe(0);
        expect(state.snapshot.player.scroll).toBe(null);
    });

    it("invisibility escapes non-boss combat", () => {
        const state = new GameState();
        state.startCombat("测试怪", 20, 5, false);
        state.snapshot.player.scroll = "隐身术";

        const result = state.performCombatAction("scroll");

        expect(result.escaped).toBe(true);
        expect(state.snapshot.player.scroll).toBe(null);
    });

    it("prevents invisibility in boss combat", () => {
        const state = new GameState();
        state.startCombat("测试Boss", 20, 5, true);
        state.snapshot.player.scroll = "隐身术";
        state.snapshot.player.hp = 20;

        const result = state.performCombatAction("scroll");

        expect(result.escaped).toBe(false);
        expect(state.snapshot.player.scroll).toBe("隐身术");
        expect(state.snapshot.player.hp).toBe(20);
    });
});
