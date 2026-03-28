import { describe, expect, it, vi, afterEach } from "vitest";
import { BOSS_BY_FLOOR, CHARS } from "./constants";
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

    it("never generates two consecutive same room types on a floor", () => {
        const state = new GameState();
        state.generateMap();

        const expectedRoomCounts = [4, 5, 6, 7];
        expectedRoomCounts.forEach((count, floorIdx) => {
            const floor = floorIdx + 1;
            for (let idx = 2; idx <= count; idx += 1) {
                const prev = state.snapshot.dungeon.map[`${floor}-${idx - 1}`];
                const curr = state.snapshot.dungeon.map[`${floor}-${idx}`];
                expect(curr.eventType).not.toBe(prev.eventType);
            }
        });
    });

    it("never generates duplicate options inside a branch room", () => {
        const state = new GameState();
        state.generateMap();

        Object.values(state.snapshot.dungeon.map).forEach((room) => {
            if (room.eventType !== "branch_event" || !room.branches) return;
            const branchEventTypes = room.branches.map((branch) => branch[1]);
            expect(new Set(branchEventTypes).size).toBe(branchEventTypes.length);
        });
    });

    it("keeps 2/3 options when a branch room is revealed by scouting", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "怪物",
                eventType: "monster_event",
                revealed: true,
            },
            "1-2": {
                key: "1-2",
                floor: 1,
                index: 2,
                name: "分叉口",
                eventType: "branch_event",
                branches: [
                    ["篝火", "bonfire_event"],
                    ["宝箱", "chest_event"],
                    ["雕像", "statue_event"],
                ],
                revealed: false,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.getCurrentRoomEvent();

        expect(state.snapshot.dungeon.map["1-2"].revealed).toBe(true);
        expect(state.snapshot.dungeon.map["1-2"].branches?.length).toBe(3);

        state.snapshot.dungeon.roomIdx = 2;
        const branchActions = state.getRoomActions("branch_event").filter((action) => action.id.startsWith("branch_"));
        const revealedLabels = branchActions.filter((action) => !action.label.endsWith("?")).length;
        const hiddenLabels = branchActions.filter((action) => action.label.endsWith("?")).length;

        expect(revealedLabels).toBe(1);
        expect(hiddenLabels).toBe(2);
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

    it("purchase does not complete room and marks item sold out", () => {
        const state = new GameState();
        state.snapshot.player.coin = 99;
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

        state.getCurrentRoomEvent();
        const inventory = state.getShopInventoryView();
        const buyAction =
            inventory.buy.find((item) => !item.disabledReason && item.id !== "shop_buy_coin_bag") ??
            inventory.buy.find((item) => !item.disabledReason);
        expect(buyAction).toBeDefined();

        const coinBefore = state.snapshot.player.coin;
        const result = state.resolveRoomAction("shop_event", buyAction!.id);

        expect(result.complete).toBe(false);
        expect(state.snapshot.player.coin).toBeLessThan(coinBefore);

        const after = state.getShopInventoryView();
        const changedItem = after.buy.find((item) => item.id === buyAction!.id);
        expect(changedItem?.disabledReason).toBe("已售出");
    });

    it("selling food does not complete room and updates resources", () => {
        const state = new GameState();
        state.snapshot.player.food = 2;
        state.snapshot.player.coin = 0;
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

        state.getCurrentRoomEvent();
        const result = state.resolveRoomAction("shop_event", "shop_sell_food");

        expect(result.complete).toBe(false);
        expect(state.snapshot.player.food).toBe(1);
        expect(state.snapshot.player.coin).toBe(1);
    });

    it("leaving shop completes room", () => {
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

        state.getCurrentRoomEvent();
        const leaveResult = state.resolveRoomAction("shop_event", "leave");

        expect(leaveResult.complete).toBe(true);
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
        expect(state.snapshot.combat.frozenEnemyTurns).toBe(1);
        expect(state.snapshot.player.scroll).toBe(null);
    });

    it("skill does not end turn", () => {
        const state = new GameState();
        state.startCombat("测试怪", 30, 5, false);
        state.snapshot.player.character = CHARS[4];
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;

        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const result = state.performCombatAction("skill");

        expect(result.playerDied).toBe(false);
        expect(result.victory).toBe(false);
        expect(state.snapshot.player.hp).toBe(20);
    });

    it("fireball scroll does not end turn", () => {
        const state = new GameState();
        state.startCombat("测试怪", 100, 5, false);
        state.snapshot.player.scroll = "火球术";
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;

        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const result = state.performCombatAction("scroll");

        expect(result.playerDied).toBe(false);
        expect(result.victory).toBe(false);
        expect(state.snapshot.player.hp).toBe(20);
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

    it("thief gains scroll after boss victory", () => {
        const state = new GameState();
        state.snapshot.player.character = CHARS[2];
        state.snapshot.player.scroll = null;

        state.startCombat("测试Boss", 10, 2, true);
        state.finishCombat(true);

        expect(state.snapshot.player.scroll).not.toBeNull();
    });

    it("queues pending scroll instead of replacing immediately", () => {
        const state = new GameState();
        state.snapshot.player.character = CHARS[2];
        state.snapshot.player.scroll = "治疗术";

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.startCombat("测试Boss", 10, 2, true);
        state.finishCombat(true);

        expect(state.snapshot.player.scroll).toBe("治疗术");
        expect(state.snapshot.player.pendingScroll).toBe("火球术");
    });

    it("applies pending scroll only after confirm", () => {
        const state = new GameState();
        state.snapshot.player.scroll = "治疗术";
        state.snapshot.player.pendingScroll = "火球术";

        state.resolveScrollReplacement(true);

        expect(state.snapshot.player.scroll).toBe("火球术");
        expect(state.snapshot.player.pendingScroll).toBe(null);
    });

    it("keeps current scroll after decline", () => {
        const state = new GameState();
        state.snapshot.player.scroll = "治疗术";
        state.snapshot.player.pendingScroll = "火球术";

        state.resolveScrollReplacement(false);

        expect(state.snapshot.player.scroll).toBe("治疗术");
        expect(state.snapshot.player.pendingScroll).toBe(null);
    });

    it("boss combat uses floor-specific boss name", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 3;

        state.startRoomCombat("boss_event");

        expect(state.snapshot.combat.monsterName).toBe(BOSS_BY_FLOOR[2]);
        expect(state.snapshot.combat.isBoss).toBe(true);
    });

    it("grants random xp reward after combat based on floor range", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 3;
        state.snapshot.player.hp = 20;

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.startCombat("测试怪", 20, 3, false);
        state.finishCombat(true);

        expect(state.snapshot.player.xp).toBe(3);
    });

    it("does not grant post-combat xp reward when player is dead", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 3;
        state.snapshot.player.hp = 0;

        state.startCombat("测试怪", 20, 3, false);
        state.finishCombat(false);

        expect(state.snapshot.player.xp).toBe(0);
    });

    it("queued bonus chest always has at least one reward", () => {
        const state = new GameState();
        vi.spyOn(Math, "random").mockReturnValue(0);

        state.queueBonusChest(1);
        const result = state.resolveRoomAction("chest_event", "open");

        expect(result.complete).toBe(true);
        expect(state.snapshot.logs.some((line) => line.includes("宝箱开启，奖励"))).toBe(true);
        expect(state.snapshot.logs.some((line) => line.includes("宝箱是空的"))).toBe(false);
    });
});

describe("GameState room consequences", () => {
    it("can reduce hp to zero when starving", () => {
        const state = new GameState();
        state.snapshot.player.hp = 1;
        state.snapshot.player.food = 0;
        state.snapshot.dungeon.floor = 4;

        state.processRoomConsequences();

        expect(state.snapshot.player.hp).toBe(0);
    });

    it("levels up with overflow xp kept", () => {
        const state = new GameState();
        state.snapshot.player.xp = 17;
        state.snapshot.player.xpLevel = 1;
        state.snapshot.player.food = 1;
        state.snapshot.player.hp = 10;
        state.snapshot.dungeon.floor = 1;

        state.processRoomConsequences();

        expect(state.snapshot.player.xpLevel).toBe(3);
        expect(state.snapshot.player.xp).toBe(1);
    });

    it("skips one room consequence after mine dig", () => {
        const state = new GameState();
        state.snapshot.player.hp = 20;
        state.snapshot.player.food = 2;
        state.snapshot.player.defense = 0;
        state.snapshot.player.defenseMax = 3;
        state.snapshot.dungeon.floor = 2;

        vi.spyOn(Math, "random").mockReturnValue(0.99);

        const digResult = state.resolveRoomAction("mine_event", "dig");
        expect(digResult.complete).toBe(false);
        expect(state.snapshot.player.food).toBe(1);

        state.processRoomConsequences();
        expect(state.snapshot.player.food).toBe(1);
        expect(state.snapshot.player.defense).toBe(0);

        state.processRoomConsequences();
        expect(state.snapshot.player.food).toBe(0);
        expect(state.snapshot.player.defense).toBe(1);
    });

    it("applies normal consequence when leaving mine without digging", () => {
        const state = new GameState();
        state.snapshot.player.hp = 20;
        state.snapshot.player.food = 2;
        state.snapshot.player.defense = 0;
        state.snapshot.player.defenseMax = 3;
        state.snapshot.dungeon.floor = 2;

        state.resolveRoomAction("mine_event", "leave");
        state.processRoomConsequences();

        expect(state.snapshot.player.food).toBe(1);
        expect(state.snapshot.player.defense).toBe(1);
    });
});

describe("GameState branch feedback", () => {
    it("writes path-oriented logs when choosing a branch", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "分叉口",
                eventType: "branch_event",
                branches: [
                    ["宝箱", "chest_event"],
                    ["篝火", "bonfire_event"],
                ],
                revealed: true,
            },
            "1-2": {
                key: "1-2",
                floor: 1,
                index: 2,
                name: "怪物",
                eventType: "monster_event",
                revealed: false,
            },
            "1-3": {
                key: "1-3",
                floor: 1,
                index: 3,
                name: "商人",
                eventType: "shop_event",
                revealed: false,
            },
            "1-4": {
                key: "1-4",
                floor: 1,
                index: 4,
                name: "BOSS",
                eventType: "boss_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        const result = state.resolveRoomAction("branch_event", "branch_0");

        expect(result.complete).toBe(false);
        expect(result.nextEventType).toBe("chest_event");
        expect(state.snapshot.dungeon.map["1-1"].chosenBranchName).toBe("宝箱");
        expect(state.snapshot.logs.some((msg) => msg.includes("你沿着分支前进"))).toBe(true);
        expect(state.snapshot.logs.some((msg) => msg.includes("路线变化"))).toBe(true);
    });

    it("keeps boss at final room and clears non-boss reveals after reorder", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "分叉口",
                eventType: "branch_event",
                branches: [
                    ["宝箱", "chest_event"],
                    ["篝火", "bonfire_event"],
                ],
                revealed: true,
            },
            "1-2": {
                key: "1-2",
                floor: 1,
                index: 2,
                name: "宝箱",
                eventType: "chest_event",
                revealed: true,
            },
            "1-3": {
                key: "1-3",
                floor: 1,
                index: 3,
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
            "1-4": {
                key: "1-4",
                floor: 1,
                index: 4,
                name: "BOSS",
                eventType: "boss_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.resolveRoomAction("branch_event", "branch_0");

        expect(state.snapshot.dungeon.map["1-4"].eventType).toBe("boss_event");
        expect(state.snapshot.dungeon.map["1-4"].revealed).toBe(true);
        expect(state.snapshot.dungeon.map["1-2"].reorderedByBranch).toBe(true);
        expect(state.snapshot.dungeon.map["1-3"].reorderedByBranch).toBe(true);
        expect(state.snapshot.dungeon.map["1-2"].revealed).toBe(false);
        expect(state.snapshot.dungeon.map["1-3"].revealed).toBe(false);
    });

    it("exposes chosen branch and reordered markers in map view", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "分叉口",
                eventType: "branch_event",
                branches: [
                    ["篝火", "bonfire_event"],
                    ["宝箱", "chest_event"],
                ],
                revealed: true,
                reorderedByBranch: false,
            },
            "1-2": {
                key: "1-2",
                floor: 1,
                index: 2,
                name: "雕像",
                eventType: "statue_event",
                revealed: true,
                reorderedByBranch: false,
            },
            "1-3": {
                key: "1-3",
                floor: 1,
                index: 3,
                name: "商人",
                eventType: "shop_event",
                revealed: true,
                reorderedByBranch: false,
            },
            "1-4": {
                key: "1-4",
                floor: 1,
                index: 4,
                name: "BOSS",
                eventType: "boss_event",
                revealed: true,
                reorderedByBranch: false,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);
        state.resolveRoomAction("branch_event", "branch_0");

        const floorMap = state.getMapRoomsForFloor(1, false);
        const branch = floorMap.find((room) => room.key === "1-1");
        const next = floorMap.find((room) => room.key === "1-2");

        expect(branch?.chosenBranchName).toBe("篝火");
        expect(next?.reorderedByBranch).toBe(true);
    });
});

describe("GameState room finalize flow", () => {
    it("ignores stale finalize request and prevents double advance", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.player.hp = 20;
        state.snapshot.player.food = 1;

        const first = state.finalizeCurrentRoom("1-1");
        const second = state.finalizeCurrentRoom("1-1");

        expect(first.ignored).toBe(false);
        expect(second.ignored).toBe(true);
        expect(state.snapshot.dungeon.floor).toBe(1);
        expect(state.snapshot.dungeon.roomIdx).toBe(2);
    });

    it("does not advance when player dies during room finalize", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 4;
        state.snapshot.dungeon.roomIdx = 3;
        state.snapshot.player.hp = 1;
        state.snapshot.player.food = 0;

        vi.spyOn(Math, "random").mockReturnValue(0);

        const result = state.finalizeCurrentRoom("4-3");

        expect(result.ignored).toBe(false);
        expect(result.playerDied).toBe(true);
        expect(result.dungeonCleared).toBe(false);
        expect(state.snapshot.dungeon.floor).toBe(4);
        expect(state.snapshot.dungeon.roomIdx).toBe(3);
    });

    it("marks dungeon cleared after final room finalize", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 4;
        state.snapshot.dungeon.roomIdx = 7;
        state.snapshot.player.hp = 20;
        state.snapshot.player.food = 1;

        const result = state.finalizeCurrentRoom("4-7");

        expect(result.ignored).toBe(false);
        expect(result.playerDied).toBe(false);
        expect(result.dungeonCleared).toBe(true);
        expect(state.snapshot.dungeon.floor).toBe(5);
        expect(state.snapshot.dungeon.roomIdx).toBe(1);
    });

    it("clears only combat logs", () => {
        const state = new GameState();
        state.snapshot.logs = [
            "进入房间: 怪物",
            "遭遇 蜘蛛",
            "造成伤害 5",
            "Coin +3",
            "地图已生成",
            "你已阵亡，本次游戏结束",
        ];

        state.clearCombatLogs();

        expect(state.snapshot.logs).toContain("进入房间: 怪物");
        expect(state.snapshot.logs).toContain("Coin +3");
        expect(state.snapshot.logs).toContain("地图已生成");
        expect(state.snapshot.logs.some((line) => line.includes("遭遇"))).toBe(false);
        expect(state.snapshot.logs.some((line) => line.includes("造成伤害"))).toBe(false);
        expect(state.snapshot.logs.some((line) => line.includes("阵亡"))).toBe(false);
    });
});
