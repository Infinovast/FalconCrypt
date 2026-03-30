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
    it("frost scroll does not end turn immediately", () => {
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
        expect(state.snapshot.combat.skipCounterattackOnce).toBe(true);
        expect(state.snapshot.player.scroll).toBe(null);
        expect(state.snapshot.logs).toContain("寒冰术生效：下一次攻击后敌人本回合不反击");
    });

    it("frost scroll skips exactly one counterattack after player attack", () => {
        const state = new GameState();
        state.startCombat("测试怪", 20, 5, false);
        state.snapshot.player.scroll = "寒冰术";
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;

        vi.spyOn(Math, "random").mockReturnValue(0.5);

        state.performCombatAction("scroll");
        const attackResult = state.performCombatAction("attack");

        expect(attackResult.playerDied).toBe(false);
        expect(state.snapshot.player.hp).toBe(20);
        expect(state.snapshot.combat.skipCounterattackOnce).toBe(false);
        expect(state.snapshot.logs).toContain("寒冰效果生效，敌人冻住了本回合不反击");

        state.performCombatAction("attack");

        expect(state.snapshot.player.hp).toBeLessThan(20);
    });

    it("heal scroll can be used in explore stage", () => {
        const state = new GameState();
        state.snapshot.player.scroll = "治疗术";
        state.snapshot.player.hp = 8;

        vi.spyOn(Math, "random").mockReturnValue(0.5);

        const used = state.useHealScrollInExplore();

        expect(used).toBe(true);
        expect(state.snapshot.player.hp).toBeGreaterThan(8);
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

    it("hides passive skill button for passive classes", () => {
        const state = new GameState();
        state.snapshot.player.character = CHARS[0];
        state.snapshot.player.skill = CHARS[0][6];

        const actions = state.getCombatActions();

        expect(actions.some((action) => action.id === "skill")).toBe(false);
    });

    it("shows skill sp cost on active skill button", () => {
        const state = new GameState();
        state.snapshot.player.character = CHARS[1];
        state.snapshot.player.skill = CHARS[1][6];

        const actions = state.getCombatActions();
        const skillAction = actions.find((action) => action.id === "skill");

        expect(skillAction?.label).toBe("角色技能: 净化 (-4 SP)");
    });

    it("paladin skill consumes food immediately", () => {
        const state = new GameState();
        state.startCombat("测试怪", 30, 5, false);
        state.snapshot.player.character = CHARS[1];
        state.snapshot.player.food = 2;
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;

        vi.spyOn(Math, "random").mockReturnValue(0);

        const result = state.performCombatAction("skill");

        expect(result.playerDied).toBe(false);
        expect(result.victory).toBe(false);
        expect(state.snapshot.player.food).toBe(1);
        expect(state.snapshot.logs).toContain("净化: Food -1");
        expect(state.snapshot.logs).toContain("净化生效：怪物攻击 -1");
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

    it("discards duplicate scrolls automatically and logs it", () => {
        const state = new GameState();
        state.snapshot.player.character = CHARS[2];
        state.snapshot.player.scroll = "火球术";

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.startCombat("测试Boss", 10, 2, true);
        state.finishCombat(true);

        expect(state.snapshot.player.scroll).toBe("火球术");
        expect(state.snapshot.player.pendingScroll).toBe(null);
        expect(state.snapshot.logs).toContain("发现相同卷轴: 火球术，自动丢弃");
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

    it("developer scroll control cycles through all scrolls and none", () => {
        const state = new GameState();

        expect(state.snapshot.player.scroll).toBe(null);

        state.adjustDeveloperScalar("scroll", 1);
        expect(state.snapshot.player.scroll).toBe("火球术");

        state.adjustDeveloperScalar("scroll", 1);
        expect(state.snapshot.player.scroll).toBe("寒冰术");

        state.adjustDeveloperScalar("scroll", 1);
        expect(state.snapshot.player.scroll).toBe("治疗术");

        state.adjustDeveloperScalar("scroll", 1);
        expect(state.snapshot.player.scroll).toBe("隐身术");

        state.adjustDeveloperScalar("scroll", 1);
        expect(state.snapshot.player.scroll).toBe(null);

        state.adjustDeveloperScalar("scroll", -1);
        expect(state.snapshot.player.scroll).toBe("隐身术");
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

        expect(state.snapshot.player.xp).toBe(4);
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

    it("trap room exposes leave action after resolution", () => {
        const state = new GameState();
        vi.spyOn(Math, "random").mockReturnValue(0.99);

        const beforeActions = state.getRoomActions("trap_event");
        const result = state.resolveRoomAction("trap_event", "disarm");
        const afterActions = state.getRoomActions("trap_event");

        expect(beforeActions.some((action) => action.id === "leave")).toBe(true);
        expect(result.complete).toBe(true);
        expect(afterActions.some((action) => action.id === "leave")).toBe(true);
    });

    it("rushing through a trap does not grant disarm rewards on success", () => {
        const state = new GameState();
        state.snapshot.player.extraAtk = 0;
        vi.spyOn(Math, "random").mockReturnValue(0.99);

        const result = state.resolveRoomAction("trap_event", "rush");

        expect(result.complete).toBe(true);
        expect(state.snapshot.player.extraAtk).toBe(0);
        expect(state.snapshot.logs.some((line) => line.includes("强行穿了过去"))).toBe(true);
        expect(state.snapshot.logs.some((line) => line.includes("ATK Extra"))).toBe(false);
    });

    it("logs trap name when entering a trap room", () => {
        const state = new GameState();
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "陷阱",
                eventType: "trap_event",
                revealed: false,
            },
        };

        const eventType = state.getCurrentRoomEvent();

        expect(eventType).toBe("trap_event");
        expect(state.snapshot.logs).toContain("进入房间: 陷阱");
        expect(state.snapshot.logs).toContain("你听见机关轻响，地面和墙缝里都藏着危险");
    });

    it("pit trap drops player to same room index on the next floor", () => {
        const state = new GameState();
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;
        state.snapshot.dungeon.floor = 2;
        state.snapshot.dungeon.roomIdx = 3;

        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.99)
            .mockReturnValueOnce(0.99)
            .mockReturnValueOnce(0.99);

        const result = state.resolveRoomAction("trap_event", "disarm");

        expect(result.complete).toBe(true);
        expect(result.roomAdvancedInternally).toBe(true);
        expect(state.snapshot.dungeon.floor).toBe(3);
        expect(state.snapshot.dungeon.roomIdx).toBe(3);
        expect(state.snapshot.player.hp).toBeLessThan(20);
        expect(state.snapshot.logs.some((line) => line.includes("陷阱显形: 深坑"))).toBe(true);
        expect(state.snapshot.logs.some((line) => line.includes("坠入下一层的同号房间"))).toBe(true);
    });

    it("pit trap on bottom floor only deals hp damage", () => {
        const state = new GameState();
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;
        state.snapshot.dungeon.floor = 4;
        state.snapshot.dungeon.roomIdx = 5;

        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.99)
            .mockReturnValueOnce(0.99)
            .mockReturnValueOnce(0.99);

        state.resolveRoomAction("trap_event", "disarm");

        expect(state.snapshot.dungeon.floor).toBe(4);
        expect(state.snapshot.dungeon.roomIdx).toBe(5);
        expect(state.snapshot.player.hp).toBeLessThan(20);
        expect(state.snapshot.logs.some((line) => line.includes("重重摔伤"))).toBe(true);
    });

    it("bonfire room exposes leave action after resolution", () => {
        const state = new GameState();
        vi.spyOn(Math, "random").mockReturnValue(0);

        const beforeActions = state.getRoomActions("bonfire_event");
        const result = state.resolveRoomAction("bonfire_event", "heal");
        const afterActions = state.getRoomActions("bonfire_event");

        expect(beforeActions.some((action) => action.id === "leave")).toBe(true);
        expect(result.complete).toBe(true);
        expect(afterActions.some((action) => action.id === "leave")).toBe(true);
    });

    it("forge room exposes leave action after resolution", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.extraAtk = 2;
        state.snapshot.player.defenseMax = 5;
        state.snapshot.player.defense = 5;
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        const beforeActions = state.getRoomActions("forge_event");
        const result = state.resolveRoomAction("forge_event", "weapon");
        const afterActions = state.getRoomActions("forge_event");

        expect(beforeActions.some((action) => action.id === "leave")).toBe(true);
        expect(result.complete).toBe(true);
        expect(afterActions.some((action) => action.id === "leave")).toBe(true);
    });

    it("forge room exposes leave action before any upgrade", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.extraAtk = 2;
        state.snapshot.player.defenseMax = 5;
        state.snapshot.player.defense = 5;
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        const actions = state.getRoomActions("forge_event");

        expect(actions.some((action) => action.id === "leave")).toBe(true);
    });

    it("thorns armor can reflect damage after enemy attack", () => {
        const state = new GameState();
        state.startCombat("测试怪", 20, 8, false);
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 0;
        state.snapshot.player.hasThornsArmor = true;

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.performCombatAction("attack");

        expect(state.snapshot.combat.monsterHp).toBeLessThan(20);
        expect(state.snapshot.logs.some((line) => line.includes("荆棘反伤生效"))).toBe(true);
    });

    it("heavy armor prevents non-true damage overflow while defense remains", () => {
        const state = new GameState();
        state.startCombat("测试怪", 20, 5, false);
        state.snapshot.player.hp = 20;
        state.snapshot.player.defense = 2;
        state.snapshot.player.hasHeavyArmor = true;

        vi.spyOn(Math, "random").mockReturnValue(0);

        state.performCombatAction("attack");

        expect(state.snapshot.player.defense).toBe(0);
        expect(state.snapshot.player.hp).toBe(20);
    });
});

describe("GameState forge actions", () => {
    it("forge actions grant xp reward", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.extraAtk = 2;
        state.snapshot.player.defenseMax = 5;
        state.snapshot.player.defense = 5;
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        const result = state.resolveRoomAction("forge_event", "weapon");

        expect(result.complete).toBe(true);
        expect(state.snapshot.player.xp).toBe(1);
    });

    it("forge room exposes one random armor upgrade option", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.extraAtk = 2;
        state.snapshot.player.defenseMax = 5;
        state.snapshot.player.defense = 5;
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        const actions = state.getRoomActions("forge_event");

        expect(actions.some((action) => action.id === "forge_armor_thorns")).toBe(true);
        expect(actions.some((action) => action.id === "forge_armor_heavy")).toBe(false);
    });

    it("forge room only offers the other armor upgrade when one is already owned", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.extraAtk = 2;
        state.snapshot.player.defenseMax = 5;
        state.snapshot.player.defense = 5;
        state.snapshot.player.hasThornsArmor = true;
        state.snapshot.dungeon.floor = 1;
        state.snapshot.dungeon.roomIdx = 1;
        state.snapshot.dungeon.map = {
            "1-1": {
                key: "1-1",
                floor: 1,
                index: 1,
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
        };

        vi.spyOn(Math, "random").mockReturnValue(0);

        const actions = state.getRoomActions("forge_event");

        expect(actions.some((action) => action.id === "forge_armor_thorns")).toBe(false);
        expect(actions.some((action) => action.id === "forge_armor_heavy")).toBe(true);
    });

    it("resets forge armor option when developer switches the next room to forge", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.extraAtk = 2;
        state.snapshot.player.defenseMax = 5;
        state.snapshot.player.defense = 5;
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
                name: "铸锻",
                eventType: "forge_event",
                revealed: true,
            },
            "1-3": {
                key: "1-3",
                floor: 1,
                index: 3,
                name: "怪物",
                eventType: "monster_event",
                revealed: true,
            },
        };

        state.snapshot.combat.forgeUpgradeType = "thorns";
        state.setDeveloperNextRoomType("forge_event");

        expect(state.snapshot.combat.forgeUpgradeType).toBeNull();
        expect(state.getDeveloperNextRoomType()).toBe("forge_event");
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

    it("defense gain can exceed defense max", () => {
        const state = new GameState();
        state.snapshot.player.coin = 20;
        state.snapshot.player.defense = 2;
        state.snapshot.player.defenseMax = 1;
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
        state.resolveRoomAction("shop_event", "shop_buy_poor_armor");

        expect(state.snapshot.player.defense).toBeGreaterThan(state.snapshot.player.defenseMax);
    });

    it("lowering defense max does not clamp current defense", () => {
        const state = new GameState();
        state.snapshot.player.defense = 6;
        state.snapshot.player.defenseMax = 2;
        state.snapshot.player.coin = 0;

        state.resolveRoomAction("shop_event", "shop_sell_armor_shard");

        expect(state.snapshot.player.defense).toBe(6);
        expect(state.snapshot.player.defenseMax).toBe(1);
    });

    it("natural defense recovery stops when defense reaches defense max or above", () => {
        const state = new GameState();
        state.snapshot.player.hp = 20;
        state.snapshot.player.food = 2;
        state.snapshot.player.defense = 3;
        state.snapshot.player.defenseMax = 2;
        state.snapshot.dungeon.floor = 2;

        state.resolveRoomAction("mine_event", "leave");
        state.processRoomConsequences();

        expect(state.snapshot.player.food).toBe(1);
        expect(state.snapshot.player.defense).toBe(3);
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

    it("can clear logs and keep only victory system notes after dungeon clear", () => {
        const state = new GameState();
        state.addLog("旧日志 A");
        state.addLog("旧日志 B");
        state.clearLogs();
        state.addLog("你击败了地牢终焉，获得鹰魂结晶！");
        state.addLog("系统提示：本轮冒险已通关，鹰魂结晶已纳入战利记录。");

        expect(state.snapshot.logs).toEqual([
            "你击败了地牢终焉，获得鹰魂结晶！",
            "系统提示：本轮冒险已通关，鹰魂结晶已纳入战利记录。",
        ]);
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
