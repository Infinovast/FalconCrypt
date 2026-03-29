import {
    BOSS_BY_FLOOR,
    BRANCH_REORDER_SUCCESS_RATE,
    BRANCH_ROOM,
    CHARACTER_OPTION_COUNT,
    CHEST_REWARD_POOL,
    CHARS,
    FLOOR,
    MONSTER_POOL,
    NEXT_FLOOR_REVEAL_RATE,
    NEXT_ROOM_REVEAL_RATE,
    ROOM_ADD,
    ROOMS,
    ROOMS_WEIGHT,
    SCROLL_LIST,
    SHOP_BUY_POOL,
    ROOM_RANGES,
    SKILL_POINT_MAX,
    SKILL_SP_COST,
    XP_MAX,
} from "./constants";
import type {
    CharacterTuple,
    CombatActionResult,
    CombatActionType,
    GameSnapshot,
    MapRoomView,
    RoomAction,
    RoomEventType,
    RoomNode,
    RoomTuple,
    ShopInventoryView,
    ScrollType,
    TrapType,
} from "./types";

export type DeveloperScalarField =
    | "hp"
    | "coin"
    | "defense"
    | "defenseMax"
    | "food"
    | "scroll"
    | "extraAtk"
    | "xp"
    | "xpLevel"
    | "skillPoint"
    | "monsterHp"
    | "monsterAtk"
    | "tempExtraAtk"
    | "tempMonsterAtkDelta"
    | "floor"
    | "roomIdx";

const randomInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const DEVELOPER_SCROLL_CYCLE: Array<ScrollType | null> = [null, ...SCROLL_LIST];

const weightedChoice = <T>(items: T[], weights: number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0);
    let cursor = Math.random() * total;
    for (let i = 0; i < items.length; i += 1) {
        cursor -= weights[i];
        if (cursor <= 0) return items[i];
    }
    return items[items.length - 1];
};

const sample = <T>(arr: T[], count: number): T[] => {
    const clone = [...arr];
    for (let i = clone.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i);
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone.slice(0, Math.max(0, count));
};

type RoomActionResult = {
    complete: boolean;
    combat?: {
        monsterName: string;
        hp: number;
        atk: number;
        isBoss?: boolean;
    };
    nextEventType?: RoomEventType;
};

type ShopBuyStockItem = {
    id: string;
    name: string;
    cost: number;
    value: (typeof SHOP_BUY_POOL)[number]["value"];
    soldOut: boolean;
};

type FinalizeRoomResult = {
    ignored: boolean;
    playerDied: boolean;
    dungeonCleared: boolean;
};

const ROOM_EVENT_NAMES: Record<string, string> = {
    monster_event: "怪物",
    boss_event: "Boss",
    branch_event: "分叉口",
    chest_event: "宝箱",
    trap_event: "陷阱",
    shop_event: "商人",
    bonfire_event: "篝火",
    forge_event: "铸锻间",
    statue_event: "雕像",
    mine_event: "矿洞",
};

const COMBAT_LOG_MARKERS = [
    "遭遇",
    "造成伤害",
    "反击",
    "寒冰效果",
    "暴击",
    "净化生效",
    "血祭生效",
    "挑衅生效",
    "击败",
    "脱离战斗",
    "Boss",
    "阵亡",
    "无法释放暴击",
    "无法使用技能",
    "无法使用卷轴",
    "火球术",
    "冻结敌人",
    "治疗术",
    "隐身术",
];

const TRAP_NAMES: Record<TrapType, string> = {
    fire: "烈焰喷口",
    acid: "酸雾",
    rock: "滚石",
    spike: "尖刺",
    pit: "深坑",
};

export class GameState {
    private chosenChars: CharacterTuple[] = [];
    private shopRoomKey: string | null = null;
    private shopBuyStock: ShopBuyStockItem[] = [];
    private skipRoomConsequenceOnce = false;
    private queuedChestMinRewards = 0;

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
            scroll: null,
            pendingScroll: null,
            hasThornsArmor: false,
            hasHeavyArmor: false,
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
            isBoss: false,
            skipCounterattackOnce: false,
            tempExtraAtk: 0,
            tempMonsterAtkDelta: 0,
            forgeUpgradeType: null,
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
            scroll: null,
            pendingScroll: null,
            hasThornsArmor: false,
            hasHeavyArmor: false,
        };
        this.snapshot.dungeon = { floor: 1, roomIdx: 1, map: {} };
        this.snapshot.combat = {
            monsterName: "",
            monsterHp: 0,
            monsterAtk: 0,
            skillPoint: SKILL_POINT_MAX,
            isBoss: false,
            skipCounterattackOnce: false,
            tempExtraAtk: 0,
            tempMonsterAtkDelta: 0,
            forgeUpgradeType: null,
        };
        this.snapshot.logs = [];
        this.shopRoomKey = null;
        this.shopBuyStock = [];
        this.skipRoomConsequenceOnce = false;
        this.queuedChestMinRewards = 0;
    }

    getCharacterOptions(): CharacterTuple[] {
        this.chosenChars = sample(CHARS, CHARACTER_OPTION_COUNT);
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
        if (selected[0] === "盗贼") {
            this.gainRandomScroll();
            this.addLog("盗贼被动触发：开局获得随机卷轴");
        }
        this.addLog(`已选择角色: ${selected[0]} / 技能: ${selected[6]}`);
        this.generateMap();
    }

    generateMap(): void {
        const nextMap: Record<string, RoomNode> = {};
        const nonBossRooms = ROOMS.filter((room) => room[1] !== "boss_event");
        const nonBossWeights = ROOMS_WEIGHT.slice(0, nonBossRooms.length);

        const pickNonRepeatingRoom = (prevEventType: RoomEventType | null): RoomTuple => {
            let picked = weightedChoice(nonBossRooms, nonBossWeights);
            if (!prevEventType) return picked;

            let guard = 0;
            while (picked[1] === prevEventType && guard < 24) {
                picked = weightedChoice(nonBossRooms, nonBossWeights);
                guard += 1;
            }

            if (picked[1] === prevEventType) {
                const fallback = nonBossRooms.find((room) => room[1] !== prevEventType);
                return fallback ?? picked;
            }

            return picked;
        };

        for (let floor = 1; floor <= FLOOR; floor += 1) {
            const roomCount = floor + ROOM_ADD;
            let prevEventType: RoomEventType | null = null;
            for (let room = 1; room <= roomCount; room += 1) {
                const key = `${floor}-${room}`;
                const tuple = room < roomCount ? pickNonRepeatingRoom(prevEventType) : ROOMS[ROOMS.length - 1];
                const tupleEventType = tuple[1] as RoomEventType;
                nextMap[key] = {
                    key,
                    floor,
                    index: room,
                    name: tuple[0],
                    eventType: tupleEventType,
                    revealed: tupleEventType === "boss_event",
                    reorderedByBranch: false,
                };
                prevEventType = tupleEventType;
            }

            const replaceCount = randomInt(0, Math.min(floor, 2));
            const candidateIndexes = Array.from({ length: roomCount - 1 }, (_, i) => i + 1);
            for (let i = candidateIndexes.length - 1; i > 0; i -= 1) {
                const j = randomInt(0, i);
                [candidateIndexes[i], candidateIndexes[j]] = [candidateIndexes[j], candidateIndexes[i]];
            }
            const branchIndexes: number[] = [];
            candidateIndexes.forEach((roomIdx) => {
                if (branchIndexes.length >= replaceCount) return;
                if (branchIndexes.some((idx) => Math.abs(idx - roomIdx) === 1)) return;
                branchIndexes.push(roomIdx);
            });

            branchIndexes.forEach((roomIdx) => {
                const key = `${floor}-${roomIdx}`;
                const branches: RoomTuple[] = [];
                const branchCount = randomInt(ROOM_RANGES.branch.optionCount.min, ROOM_RANGES.branch.optionCount.max);
                const pickedEvents = new Set<string>();
                let guard = 0;

                while (branches.length < branchCount && guard < 32) {
                    const picked = weightedChoice(nonBossRooms, nonBossWeights);
                    if (!pickedEvents.has(picked[1])) {
                        branches.push(picked);
                        pickedEvents.add(picked[1]);
                    }
                    guard += 1;
                }

                if (branches.length < branchCount) {
                    const fallback = nonBossRooms.filter((room) => !pickedEvents.has(room[1]));
                    while (branches.length < branchCount && fallback.length > 0) {
                        const idx = randomInt(0, fallback.length - 1);
                        const [picked] = fallback.splice(idx, 1);
                        branches.push(picked);
                        pickedEvents.add(picked[1]);
                    }
                }
                nextMap[key] = {
                    key,
                    floor,
                    index: roomIdx,
                    name: BRANCH_ROOM[0],
                    eventType: "branch_event",
                    branches,
                    revealed: false,
                    reorderedByBranch: false,
                };
            });
        }
        this.snapshot.dungeon.map = nextMap;
        this.addLog("地图已生成");
    }

    getCurrentRoomEvent(): RoomEventType | null {
        const { floor, roomIdx, map } = this.snapshot.dungeon;
        const room = map[`${floor}-${roomIdx}`];
        if (!room) return null;

        room.revealed = true;
        this.tryRevealNeighbors(room);

        this.addLog(`进入房间: ${room.name}`);
        if (room.eventType === "trap_event") {
            this.addLog("你听见机关轻响，地面和墙缝里都藏着危险");
        }
        if (room.eventType === "shop_event") {
            this.ensureShopInventory();
        }
        return room.eventType;
    }

    getMapRoomsForFloor(floor: number, showAll = false): MapRoomView[] {
        const roomCount = floor + ROOM_ADD;
        const views: MapRoomView[] = [];
        for (let idx = 1; idx <= roomCount; idx += 1) {
            const key = `${floor}-${idx}`;
            const room = this.snapshot.dungeon.map[key];
            if (!room) continue;
            const revealed = showAll || room.revealed;
            views.push({
                key,
                floor,
                index: idx,
                isCurrent: this.snapshot.dungeon.floor === floor && this.snapshot.dungeon.roomIdx === idx,
                revealed,
                display: revealed ? room.name : "?",
                chosenBranchName: revealed && room.eventType === "branch_event" ? room.chosenBranchName : undefined,
                reorderedByBranch: room.reorderedByBranch === true,
            });
        }
        return views;
    }

    getEventTitle(eventType: string): string {
        return ROOM_EVENT_NAMES[eventType] ?? "事件房";
    }

    getCombatActions(): RoomAction[] {
        const actions: RoomAction[] = [
            { id: "attack", label: "普通攻击" },
            {
                id: "critical",
                label: `暴击 (-${SKILL_SP_COST.critical} SP)`,
                displayLabel: "暴击",
                costBadges: [{ resource: "skillPoint", amount: -SKILL_SP_COST.critical }],
                disabledReason: this.getCriticalDisabledReason(),
            },
        ];

        const role = this.snapshot.player.character?.[0];
        const skillName = this.snapshot.player.skill || "-";
        if (role !== "术士" && role !== "盗贼") {
            const skillCost =
                role === "圣骑士"
                    ? SKILL_SP_COST.paladin
                    : role === "祭司"
                        ? SKILL_SP_COST.priest
                        : role === "刺客"
                            ? SKILL_SP_COST.assassin
                            : null;

            actions.push({
                id: "skill",
                label: skillCost ? `角色技能: ${skillName} (-${skillCost} SP)` : `角色技能: ${skillName}`,
                displayLabel: `角色技能: ${skillName}`,
                costBadges: skillCost ? [{ resource: "skillPoint", amount: -skillCost }] : undefined,
                disabledReason: this.getRoleSkillDisabledReason(),
            });
        }

        actions.push({
            id: "scroll",
            label: `使用卷轴: ${this.snapshot.player.scroll ?? "无"}`,
            displayLabel: `使用卷轴: ${this.snapshot.player.scroll ?? "无"}`,
            costBadges: this.snapshot.player.scroll ? [{ resource: "scroll", amount: -1 }] : undefined,
            disabledReason: this.getScrollDisabledReason(),
        });

        return actions;
    }

    resolveScrollReplacement(accept: boolean): void {
        const pending = this.snapshot.player.pendingScroll;
        if (!pending) return;

        if (accept) {
            const prev = this.snapshot.player.scroll;
            this.snapshot.player.scroll = pending;
            this.addLog(prev ? `卷轴替换: ${prev} -> ${pending}` : `获得卷轴: ${pending}`);
        } else {
            this.addLog(`放弃卷轴: ${pending}`);
        }
        this.snapshot.player.pendingScroll = null;
    }

    getRoomActions(eventType: RoomEventType): RoomAction[] {
        switch (eventType) {
            case "branch_event": {
                const room = this.getCurrentRoomNode();
                if (!room?.branches || room.branches.length === 0) {
                    return [{ id: "leave", label: "继续前进" }];
                }
                return room.branches.map((branch, index) => ({
                    id: `branch_${index}`,
                    label: `选择分支 ${String.fromCharCode(65 + index)}: ${room.revealedBranchIndexes?.includes(index) ? branch[0] : "?"
                        }`,
                }));
            }
            case "chest_event":
                return [
                    {
                        id: "open",
                        label: "打开宝箱",
                        rewardBadges: [
                            { resource: "coin", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.trapReward.rockCoin.max } },
                            { resource: "food", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.trapReward.spikeFood.max } },
                            { resource: "defenseMax", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.trapReward.spikeDefMax } },
                            { resource: "extraAtk", hint: "plusmaybe", range: { min: 0, max: 1 } },
                        ],
                    },
                    { id: "leave", label: "离开宝箱" },
                ];
            case "trap_event":
                return [
                    {
                        id: "disarm",
                        label: "解除陷阱",
                        rewardBadges: [{ resource: "extraAtk", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.trapReward.acidExtraAtk } }],
                    },
                    {
                        id: "rush",
                        label: "强行通过",
                    },
                    { id: "leave", label: "离开陷阱" },
                ];
            case "shop_event":
                return [{ id: "leave", label: "离开商人" }];
            case "bonfire_event":
                return [
                    {
                        id: "heal",
                        label: "治疗",
                        rewardBadges: [{ resource: "hp", hint: "plusplus", range: { min: ROOM_RANGES.bonfire.heal.min, max: ROOM_RANGES.bonfire.heal.max } }],
                    },
                    {
                        id: "cook",
                        label: "加工食物",
                        rewardBadges: [{ resource: "food", hint: "plusplus", range: { min: ROOM_RANGES.bonfire.cook.min, max: ROOM_RANGES.bonfire.cook.max } }],
                    },
                    {
                        id: "polish",
                        label: "打磨武器",
                        rewardBadges: [{ resource: "extraAtk", hint: "plusminus", range: { min: Math.min(...ROOM_RANGES.bonfire.polishDeltaPool), max: Math.max(...ROOM_RANGES.bonfire.polishDeltaPool) } }],
                    },
                    {
                        id: "search",
                        label: "搜索",
                        rewardBadges: [
                            { resource: "food", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.bonfire.foundFood.max } },
                            { resource: "coin", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.bonfire.foundCoin.max } },
                        ],
                    },
                    { id: "leave", label: "离开篝火" },
                ];
            case "forge_event":
                return this.getForgeActions();
            case "statue_event":
                return [
                    {
                        id: "pray",
                        label: "祈祷",
                        rewardBadges: [
                            { resource: "hp", hint: "plusminus", range: { min: -ROOM_RANGES.statueCurseTrueDamage.max, max: ROOM_RANGES.statueBless.hp.max } },
                            { resource: "xp", hint: "plusminus", range: { min: -ROOM_RANGES.statue.curseXpLoss, max: ROOM_RANGES.statueBless.xp.jackpot } },
                            { resource: "defense", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.statueBless.def.max } },
                            { resource: "extraAtk", hint: "plusmaybe", range: { min: 0, max: ROOM_RANGES.statue.blessAtkGain } },
                        ],
                    },
                    {
                        id: "offer",
                        label: "供奉后祈祷",
                        displayLabel: "供奉后祈祷",
                        costBadges:
                            this.snapshot.player.coin > 0
                                ? [{ resource: "coin", amount: -Math.min(this.snapshot.player.coin, ROOM_RANGES.statueOfferCoin.min) }]
                                : this.snapshot.player.food > 0
                                    ? [{ resource: "food", amount: -ROOM_RANGES.statue.offerFoodCost }]
                                    : undefined,
                        disabledReason: this.snapshot.player.coin <= 0 && this.snapshot.player.food <= 0 ? "无可供奉资源" : undefined,
                    },
                    { id: "leave", label: "离开雕像" },
                ];
            case "mine_event": {
                const noFoodNoHp =
                    this.snapshot.player.food <= 0 && this.snapshot.player.hp < ROOM_RANGES.mine.minHpRequiredWithoutFood;
                return [
                    {
                        id: "dig",
                        label: this.snapshot.player.food > 0 ? `挖掘 (-${ROOM_RANGES.mine.digFoodCost} Food)` : "挖掘 (-HP)",
                        displayLabel: "挖掘",
                        costBadges:
                            this.snapshot.player.food > 0
                                ? [{ resource: "food", amount: -ROOM_RANGES.mine.digFoodCost }]
                                : [{ resource: "hp", amount: -ROOM_RANGES.mine.noFoodTrueDamage.min }],
                        disabledReason: noFoodNoHp ? "生命过低" : undefined,
                    },
                    { id: "leave", label: "离开矿洞" },
                ];
            }
            default:
                return [{ id: "leave", label: "继续前进" }];
        }
    }

    getShopInventoryView(): ShopInventoryView {
        this.ensureShopInventory();

        const buy = this.shopBuyStock.map((item) => {
            const disabledReason = this.getShopBuyDisabledReason(item);
            return {
                id: `shop_buy_${item.id}`,
                label: `${item.name} (-${item.cost} Coin)`,
                displayLabel: item.name,
                costBadges: [{ resource: "coin" as const, amount: -item.cost }],
                disabledReason,
            };
        });

        const sell: RoomAction[] = [
            {
                id: "shop_sell_armor_shard",
                label: `出售护甲片 (+${ROOM_RANGES.shop.sell.armorShard.coinGain} Coin)`,
                displayLabel: "出售护甲片",
                rewardBadges: [{ resource: "coin" as const, amount: ROOM_RANGES.shop.sell.armorShard.coinGain }],
                disabledReason: this.snapshot.player.defenseMax > ROOM_RANGES.shop.sell.armorShard.minDefMax ? undefined : "Def Max 过低",
            },
            {
                id: "shop_sell_food",
                label: `出售食物 (+${ROOM_RANGES.shop.sell.food.coinGain} Coin)`,
                displayLabel: "出售食物",
                rewardBadges: [{ resource: "coin" as const, amount: ROOM_RANGES.shop.sell.food.coinGain }],
                disabledReason: this.snapshot.player.food > 0 ? undefined : "无食物",
            },
            {
                id: "shop_sell_scroll",
                label: `出售卷轴 (+${ROOM_RANGES.shop.sell.scrollCoinGain} Coin)`,
                displayLabel: "出售卷轴",
                rewardBadges: [{ resource: "coin" as const, amount: ROOM_RANGES.shop.sell.scrollCoinGain }],
                disabledReason: this.snapshot.player.scroll ? undefined : "无卷轴",
            },
        ];

        return { buy, sell };
    }

    resolveRoomAction(eventType: RoomEventType, actionId: string): RoomActionResult {
        switch (eventType) {
            case "branch_event":
                return this.resolveBranchAction(actionId);
            case "chest_event":
                if (actionId === "open") {
                    this.resolveChestRewards(this.queuedChestMinRewards);
                    this.queuedChestMinRewards = 0;
                }
                return { complete: true };
            case "trap_event":
                return this.resolveTrapAction(actionId);
            case "shop_event":
                return this.resolveShopAction(actionId);
            case "bonfire_event":
                return this.resolveBonfireAction(actionId);
            case "forge_event":
                return this.resolveForgeAction(actionId);
            case "statue_event":
                return this.resolveStatueAction(actionId);
            case "mine_event":
                return this.resolveMineAction(actionId);
            default:
                return { complete: true };
        }
    }

    moveNextRoom(): void {
        this.snapshot.dungeon.roomIdx += 1;
        const roomLimit = this.snapshot.dungeon.floor + ROOM_ADD;
        if (this.snapshot.dungeon.roomIdx > roomLimit) {
            this.snapshot.dungeon.floor += 1;
            this.snapshot.dungeon.roomIdx = 1;
        }
        this.snapshot.combat.forgeUpgradeType = null;
    }

    finalizeCurrentRoom(expectedRoomKey: string): FinalizeRoomResult {
        const currentKey = `${this.snapshot.dungeon.floor}-${this.snapshot.dungeon.roomIdx}`;
        if (currentKey !== expectedRoomKey) {
            this.addLog("房间结算请求已过期，忽略重复结算");
            return { ignored: true, playerDied: false, dungeonCleared: false };
        }

        this.processRoomConsequences();
        if (this.snapshot.player.hp <= 0) {
            return { ignored: false, playerDied: true, dungeonCleared: false };
        }

        this.moveNextRoom();
        return {
            ignored: false,
            playerDied: false,
            dungeonCleared: this.snapshot.dungeon.floor > FLOOR,
        };
    }

    startRoomCombat(eventType: RoomEventType): void {
        if (eventType === "boss_event") {
            const boss = this.generateBossEncounter(this.snapshot.dungeon.floor);
            this.startCombat(boss.monsterName, boss.hp, boss.atk, true);
            return;
        }
        const enemy = this.generateMonsterEncounter(this.snapshot.dungeon.floor);
        this.startCombat(enemy.monsterName, enemy.hp, enemy.atk, false);
    }

    startCombat(monsterName: string, hp: number, atk: number, isBoss = false): void {
        this.snapshot.combat.monsterName = monsterName;
        this.snapshot.combat.monsterHp = hp;
        this.snapshot.combat.monsterAtk = atk;
        this.snapshot.combat.skillPoint = SKILL_POINT_MAX;
        this.snapshot.combat.isBoss = isBoss;
        this.snapshot.combat.skipCounterattackOnce = false;
        this.snapshot.combat.tempExtraAtk = 0;
        this.snapshot.combat.tempMonsterAtkDelta = 0;
        this.snapshot.combat.forgeUpgradeType = null;
        this.addLog(`遭遇 ${monsterName}`);
    }

    playerAttack(multiplier = 1): number {
        const minAtk = this.snapshot.player.xpLevel;
        const maxAtk = 2 * this.snapshot.player.xpLevel + 4;
        const rawDamage = randomInt(minAtk, maxAtk) + this.snapshot.player.extraAtk + this.snapshot.combat.tempExtraAtk;
        const damage = Math.max(0, Math.round(rawDamage * multiplier));
        this.snapshot.combat.monsterHp -= damage;
        this.addLog(`造成伤害 ${damage}`);
        return damage;
    }

    monsterAttackPlayer(): number {
        const atkBase = Math.max(0, this.snapshot.combat.monsterAtk + this.snapshot.combat.tempMonsterAtkDelta);
        const actualAtk = atkBase < 4 ? atkBase : atkBase + randomInt(-1, 1);
        let damage = Math.max(0, actualAtk);

        if (this.snapshot.player.defense > 0) {
            const blocked = Math.min(this.snapshot.player.defense, damage);
            this.snapshot.player.defense -= blocked;
            if (!this.snapshot.player.hasHeavyArmor) {
                damage -= blocked;
            } else {
                damage = blocked > 0 ? 0 : damage;
            }
        }
        this.snapshot.player.hp = Math.max(0, this.snapshot.player.hp - damage);
        this.addLog(`${this.snapshot.combat.monsterName} 反击 ${actualAtk} (生效 ${damage})`);

        if (
            this.snapshot.player.hasThornsArmor &&
            actualAtk > 0 &&
            Math.random() < ROOM_RANGES.forge.thornsReflectRate
        ) {
            const reflectDamage = Math.max(1, Math.floor(actualAtk * ROOM_RANGES.forge.thornsReflectRatio));
            this.snapshot.combat.monsterHp = Math.max(0, this.snapshot.combat.monsterHp - reflectDamage);
            this.addLog(`荆棘反伤生效：${this.snapshot.combat.monsterName} 受到 ${reflectDamage} 伤害`);
        }

        return damage;
    }

    performCombatAction(actionType: CombatActionType): CombatActionResult {
        const result: CombatActionResult = { playerDied: false, victory: false, escaped: false };
        let endTurn = false;

        if (actionType === "attack") {
            this.playerAttack();
            endTurn = true;
        } else if (actionType === "critical") {
            endTurn = this.useCritical();
        } else if (actionType === "skill") {
            this.useRoleSkill();
        } else if (actionType === "scroll") {
            const scrollResult = this.useScrollInCombat();
            if (scrollResult.escaped) {
                result.escaped = true;
                return result;
            }
            endTurn = scrollResult.endTurn;
        }

        if (this.snapshot.combat.monsterHp <= 0) {
            result.victory = true;
            return result;
        }

        if (!endTurn) return result;

        if (this.snapshot.combat.skipCounterattackOnce) {
            this.snapshot.combat.skipCounterattackOnce = false;
            this.addLog("寒冰效果生效，敌人冻住了本回合不反击");
            return result;
        }

        this.monsterAttackPlayer();
        if (this.snapshot.player.hp <= 0) {
            result.playerDied = true;
        }
        return result;
    }

    finishCombat(victory: boolean): void {
        const wasBoss = this.snapshot.combat.isBoss;

        if (victory && wasBoss && this.snapshot.player.character?.[0] === "盗贼") {
            this.gainRandomScroll();
            this.addLog("盗贼被动触发：击败 Boss 获得卷轴");
        }

        if (this.snapshot.player.hp > 0) {
            const floor = Math.max(1, this.snapshot.dungeon.floor);
            const reward = randomInt(floor + 1, Math.min(floor + 3, 6));
            this.addXp(reward, "战斗结算");
        }

        this.snapshot.combat.monsterName = "";
        this.snapshot.combat.monsterHp = 0;
        this.snapshot.combat.monsterAtk = 0;
        this.snapshot.combat.skillPoint = SKILL_POINT_MAX;
        this.snapshot.combat.isBoss = false;
        this.snapshot.combat.skipCounterattackOnce = false;
        this.snapshot.combat.tempExtraAtk = 0;
        this.snapshot.combat.tempMonsterAtkDelta = 0;
        this.snapshot.combat.forgeUpgradeType = null;
    }

    processRoomConsequences(): void {
        if (this.skipRoomConsequenceOnce) {
            this.skipRoomConsequenceOnce = false;
            this.addLog("本房间已执行矿洞挖掘，跳过通用结算");
            return;
        }

        if (this.snapshot.player.xp >= XP_MAX) {
            const gained = Math.floor(this.snapshot.player.xp / XP_MAX);
            this.snapshot.player.xp %= XP_MAX;
            this.snapshot.player.xpLevel += gained;
            this.addLog(`升级 XP Level +${gained}`);
        }

        // 完成房间后通用结算
        if (this.snapshot.player.food > 0) {
            this.addFood(-ROOM_RANGES.roomConsequence.foodCost, "食物消耗");
            const heal = randomInt(ROOM_RANGES.roomConsequence.healMin, this.snapshot.dungeon.floor + 2);
            this.addHp(heal, "食物回血");
        } else {
            const loss = randomInt(ROOM_RANGES.roomConsequence.hungerLossMin, this.snapshot.dungeon.floor + 2);
            this.addHp(-loss, "饥饿损失");
        }

        if (this.snapshot.player.defense < this.snapshot.player.defenseMax) {
            this.addDefense(ROOM_RANGES.roomConsequence.defenseRecover, "护甲恢复");
        }
    }

    addLog(message: string): void {
        this.snapshot.logs.push(message);
        if (this.snapshot.logs.length > 60) {
            this.snapshot.logs.shift();
        }
    }

    clearLogs(): void {
        this.snapshot.logs = [];
    }

    adjustDeveloperScalar(field: DeveloperScalarField, delta: number): void {
        const step = delta > 0 ? 1 : delta < 0 ? -1 : 0;
        if (step === 0) return;

        switch (field) {
            case "hp":
                this.snapshot.player.hp = Math.max(0, this.snapshot.player.hp + step);
                break;
            case "coin":
                this.snapshot.player.coin = Math.max(0, this.snapshot.player.coin + step);
                break;
            case "defense": {
                const next = this.snapshot.player.defense + step;
                this.snapshot.player.defense = Math.max(0, Math.min(next, this.snapshot.player.defenseMax));
                break;
            }
            case "defenseMax": {
                const next = Math.max(1, this.snapshot.player.defenseMax + step);
                this.snapshot.player.defenseMax = next;
                this.snapshot.player.defense = Math.min(this.snapshot.player.defense, next);
                break;
            }
            case "food":
                this.snapshot.player.food = Math.max(0, this.snapshot.player.food + step);
                break;
            case "scroll": {
                const currentIndex = DEVELOPER_SCROLL_CYCLE.indexOf(this.snapshot.player.scroll);
                const safeIndex = currentIndex >= 0 ? currentIndex : 0;
                const nextIndex = (safeIndex + step + DEVELOPER_SCROLL_CYCLE.length) % DEVELOPER_SCROLL_CYCLE.length;
                this.snapshot.player.scroll = DEVELOPER_SCROLL_CYCLE[nextIndex];
                break;
            }
            case "extraAtk":
                this.snapshot.player.extraAtk = Math.max(0, this.snapshot.player.extraAtk + step);
                break;
            case "xp":
                this.snapshot.player.xp = Math.max(0, this.snapshot.player.xp + step);
                break;
            case "xpLevel":
                this.snapshot.player.xpLevel = Math.max(1, this.snapshot.player.xpLevel + step);
                break;
            case "skillPoint":
                this.snapshot.combat.skillPoint = Math.max(0, Math.min(SKILL_POINT_MAX, this.snapshot.combat.skillPoint + step));
                break;
            case "monsterHp":
                this.snapshot.combat.monsterHp = Math.max(0, this.snapshot.combat.monsterHp + step);
                break;
            case "monsterAtk":
                this.snapshot.combat.monsterAtk = Math.max(0, this.snapshot.combat.monsterAtk + step);
                break;
            case "tempExtraAtk":
                this.snapshot.combat.tempExtraAtk = Math.max(0, this.snapshot.combat.tempExtraAtk + step);
                break;
            case "tempMonsterAtkDelta":
                this.snapshot.combat.tempMonsterAtkDelta += step;
                break;
            case "floor":
                this.setDeveloperFloor(this.snapshot.dungeon.floor + step);
                break;
            case "roomIdx":
                this.setDeveloperRoomIndex(this.snapshot.dungeon.roomIdx + step);
                break;
            default:
                break;
        }
    }

    setDeveloperNextRoomType(eventType: RoomEventType): void {
        const room = this.getDeveloperNextRoomNode();
        if (!room) return;

        room.eventType = eventType;
        room.name = this.getEventTitle(eventType);
        delete room.chosenBranchName;
        delete room.chosenBranchEventType;
        delete room.revealedBranchIndexes;
        room.reorderedByBranch = false;

        if (eventType === "branch_event") {
            room.branches = this.buildDeveloperBranches();
        } else {
            delete room.branches;
        }

        if (eventType === "forge_event") {
            this.snapshot.combat.forgeUpgradeType = null;
        }
    }

    getDeveloperNextRoomType(): RoomEventType | null {
        return this.getDeveloperNextRoomNode()?.eventType ?? null;
    }

    getDeveloperNextRoomKey(): string | null {
        return this.getDeveloperNextRoomNode()?.key ?? null;
    }

    clearCombatLogs(): void {
        this.snapshot.logs = this.snapshot.logs.filter(
            (line) => !COMBAT_LOG_MARKERS.some((marker) => line.includes(marker)),
        );
    }

    useHealScrollInExplore(): boolean {
        if (this.snapshot.player.scroll !== "治疗术") {
            this.addLog("无法使用卷轴: 无治疗术");
            return false;
        }

        const heal = this.snapshot.player.hp > 10 ? randomInt(4, 7) : randomInt(9, 13);
        this.addHp(heal, "治疗术");
        this.addLog(`治疗术恢复 ${heal} HP`);
        this.snapshot.player.scroll = null;
        return true;
    }

    queueBonusChest(minRewards = 1): void {
        const nextMin = Math.max(0, Math.floor(minRewards));
        this.queuedChestMinRewards = Math.max(this.queuedChestMinRewards, nextMin);
    }

    private randomFrom<T>(arr: T[]): T {
        return arr[randomInt(0, arr.length - 1)];
    }

    private setDeveloperFloor(nextFloor: number): void {
        const clampedFloor = Math.max(1, Math.min(FLOOR, nextFloor));
        const roomCount = clampedFloor + ROOM_ADD;
        this.snapshot.dungeon.floor = clampedFloor;
        this.snapshot.dungeon.roomIdx = Math.max(1, Math.min(this.snapshot.dungeon.roomIdx, roomCount));
    }

    private setDeveloperRoomIndex(nextRoomIdx: number): void {
        const roomCount = this.snapshot.dungeon.floor + ROOM_ADD;
        this.snapshot.dungeon.roomIdx = Math.max(1, Math.min(roomCount, nextRoomIdx));
    }

    private getDeveloperNextRoomNode(): RoomNode | null {
        const { floor, roomIdx, map } = this.snapshot.dungeon;
        const roomCount = floor + ROOM_ADD;

        let targetFloor = floor;
        let targetIndex = roomIdx + 1;

        if (targetIndex > roomCount) {
            if (floor >= FLOOR) return null;
            targetFloor = floor + 1;
            targetIndex = 1;
        }

        return map[`${targetFloor}-${targetIndex}`] ?? null;
    }

    private buildDeveloperBranches(): RoomTuple[] {
        const nonBossRooms = ROOMS.filter((room) => room[1] !== "boss_event");
        const result: RoomTuple[] = [];
        const used = new Set<string>();

        while (result.length < 2 && used.size < nonBossRooms.length) {
            const picked = this.randomFrom(nonBossRooms);
            if (used.has(picked[1])) continue;
            result.push([picked[0], picked[1]]);
            used.add(picked[1]);
        }

        return result.length > 0 ? result : [["怪物", "monster_event"]];
    }

    private formatResourceLog(label: string, amount: number, source?: string): string {
        const valueText = `${label} ${amount >= 0 ? "+" : ""}${amount}`;
        return source ? `${source}: ${valueText}` : valueText;
    }

    private addXp(amount: number, source?: string): void {
        this.snapshot.player.xp = Math.max(0, this.snapshot.player.xp + amount);
        this.addLog(this.formatResourceLog("XP", amount, source));
    }

    private addCoin(amount: number, source?: string): void {
        this.snapshot.player.coin = Math.max(0, this.snapshot.player.coin + amount);
        this.addLog(this.formatResourceLog("Coin", amount, source));
    }

    private addFood(amount: number, source?: string): void {
        this.snapshot.player.food = Math.max(0, this.snapshot.player.food + amount);
        this.addLog(this.formatResourceLog("Food", amount, source));
    }

    private addHp(amount: number, source?: string): void {
        this.snapshot.player.hp = Math.max(0, this.snapshot.player.hp + amount);
        this.addLog(this.formatResourceLog("HP", amount, source));
    }

    private addDefense(amount: number, source?: string): void {
        this.snapshot.player.defense = Math.max(0, this.snapshot.player.defense + amount);
        this.addLog(this.formatResourceLog("Def", amount, source));
    }

    private addDefenseMax(amount: number, source?: string): void {
        this.snapshot.player.defenseMax = Math.max(1, this.snapshot.player.defenseMax + amount);
        this.addLog(this.formatResourceLog("Def Max", amount, source));
    }

    private applyDamage(amount: number, trueDamage = false): void {
        let remain = Math.max(0, amount);
        if (!trueDamage && this.snapshot.player.defense > 0) {
            const blocked = Math.min(this.snapshot.player.defense, remain);
            this.snapshot.player.defense -= blocked;
            remain -= blocked;
        }
        if (remain > 0) {
            this.snapshot.player.hp = Math.max(0, this.snapshot.player.hp - remain);
        }
        this.addLog(`${trueDamage ? "真实" : ""}伤害: HP -${amount}`);
    }

    private gainRandomScroll(forceScroll?: ScrollType): void {
        const nextScroll = forceScroll ?? this.randomFrom([...SCROLL_LIST]);

        if (!this.snapshot.player.scroll) {
            this.snapshot.player.scroll = nextScroll;
            this.addLog(`获得卷轴: ${nextScroll}`);
            return;
        }

        if (this.snapshot.player.scroll === nextScroll) {
            this.addLog(`发现相同卷轴: ${nextScroll}，自动丢弃`);
            return;
        }

        this.snapshot.player.pendingScroll = nextScroll;
        this.addLog(`发现新卷轴: ${nextScroll}，请选择是否替换当前卷轴`);
    }

    private getCriticalDisabledReason(): string | undefined {
        return this.snapshot.combat.skillPoint < SKILL_SP_COST.critical ? "SP 不足" : undefined;
    }

    private getRoleSkillDisabledReason(): string | undefined {
        const role = this.snapshot.player.character?.[0];
        if (!role) return "未选择角色";
        if (role === "术士" || role === "盗贼") {
            return "该职业为被动技能";
        }
        if (role === "圣骑士") {
            if (this.snapshot.combat.skillPoint < SKILL_SP_COST.paladin) return "SP 不足";
            if (this.snapshot.player.food <= 0) return "Food 不足";
            return undefined;
        }
        if (role === "祭司") {
            if (this.snapshot.combat.skillPoint < SKILL_SP_COST.priest) return "SP 不足";
            if (this.snapshot.player.hp <= 1) return "生命过低";
            return undefined;
        }
        if (role === "刺客") {
            if (this.snapshot.combat.skillPoint < SKILL_SP_COST.assassin) return "SP 不足";
            return undefined;
        }
        return "技能不可用";
    }

    private getScrollDisabledReason(): string | undefined {
        if (!this.snapshot.player.scroll) return "无卷轴";
        if (this.snapshot.player.scroll === "隐身术" && this.snapshot.combat.isBoss) return "Boss 战不可隐身";
        return undefined;
    }

    private useCritical(): boolean {
        if (this.getCriticalDisabledReason()) {
            this.addLog("无法释放暴击");
            return false;
        }

        this.snapshot.combat.skillPoint -= SKILL_SP_COST.critical;
        const multiplier = this.randomFrom([0.25, 0.5, 1.5, 2, 2.5]);
        this.addLog(`暴击倍率 x${multiplier}`);
        this.playerAttack(multiplier);
        return true;
    }

    private useRoleSkill(): boolean {
        const role = this.snapshot.player.character?.[0];
        const disabledReason = this.getRoleSkillDisabledReason();
        if (!role || disabledReason) {
            this.addLog(`无法使用技能: ${disabledReason ?? "未知原因"}`);
            return false;
        }

        if (role === "圣骑士") {
            this.snapshot.combat.skillPoint -= SKILL_SP_COST.paladin;
            const n = randomInt(1, Math.min(2, this.snapshot.player.food));
            const reduction = randomInt(n, n + 1);
            this.addFood(-n, "净化");
            this.snapshot.combat.tempMonsterAtkDelta -= reduction;
            this.addLog(`净化生效：怪物攻击 -${reduction}`);
            return true;
        }

        if (role === "祭司") {
            this.snapshot.combat.skillPoint -= SKILL_SP_COST.priest;
            const hpCost = randomInt(3, 5);
            const applied = Math.min(hpCost, Math.max(0, this.snapshot.player.hp - 1));
            this.snapshot.player.hp -= applied;
            const gain = randomInt(1, 3);
            this.snapshot.combat.tempExtraAtk += gain;
            this.addLog(`血祭生效：HP -${applied}，临时 ATK Extra +${gain}`);
            return true;
        }

        if (role === "刺客") {
            this.snapshot.combat.skillPoint -= SKILL_SP_COST.assassin;
            const enemyGain = randomInt(1, 2);
            const atkGain = randomInt(2, 4);
            this.snapshot.combat.tempMonsterAtkDelta += enemyGain;
            this.snapshot.combat.tempExtraAtk += atkGain;
            this.addLog(`挑衅生效：怪物攻击 +${enemyGain}，临时 ATK Extra +${atkGain}`);
            return true;
        }

        return false;
    }

    private useScrollInCombat(): { spent: boolean; escaped: boolean; endTurn: boolean } {
        const scroll = this.snapshot.player.scroll;
        const disabledReason = this.getScrollDisabledReason();
        if (!scroll || disabledReason) {
            this.addLog(`无法使用卷轴: ${disabledReason ?? "无卷轴"}`);
            return { spent: false, escaped: false, endTurn: false };
        }

        if (scroll === "火球术") {
            const damage = randomInt(9, 14);
            this.snapshot.combat.monsterHp -= damage;
            this.addLog(`火球术造成 ${damage} 伤害`);
        } else if (scroll === "寒冰术") {
            this.snapshot.combat.skipCounterattackOnce = true;
            this.addLog("寒冰术生效：下一次攻击后敌人本回合不反击");
        } else if (scroll === "治疗术") {
            const heal = this.snapshot.player.hp > 10 ? randomInt(4, 7) : randomInt(9, 13);
            this.addHp(heal);
            this.addLog(`治疗术恢复 ${heal} HP`);
        } else if (scroll === "隐身术") {
            this.snapshot.player.scroll = null;
            this.addLog("隐身术生效，脱离战斗");
            return { spent: true, escaped: true, endTurn: false };
        }

        this.snapshot.player.scroll = null;
        return { spent: true, escaped: false, endTurn: false };
    }

    private generateMonsterEncounter(floor: number): { monsterName: string; hp: number; atk: number } {
        const template = this.randomFrom(MONSTER_POOL);
        const baseHp = floor * 4 + randomInt(2, 5);
        const baseAtk = floor + randomInt(1, 2);
        return {
            monsterName: template.name,
            hp: Math.max(4, baseHp + template.hpOffset),
            atk: Math.max(1, baseAtk + template.atkOffset),
        };
    }

    private generateBossEncounter(floor: number): { monsterName: string; hp: number; atk: number } {
        const index = Math.max(0, Math.min(BOSS_BY_FLOOR.length - 1, floor - 1));
        const bossName = BOSS_BY_FLOOR[index];

        const growth = this.snapshot.player.xpLevel + this.snapshot.player.extraAtk + this.snapshot.player.defenseMax * 0.5;
        const hpScale = floor >= 2 ? 1 + Math.min(0.25, growth * 0.015) : 1;
        const atkScale = floor >= 2 ? 1 + Math.min(0.2, growth * 0.01) : 1;

        const hp = Math.round((floor * 14 + 18) * hpScale);
        const atk = Math.max(2, Math.round((floor + 3) * atkScale));

        return {
            monsterName: bossName,
            hp,
            atk,
        };
    }

    private resolveChestRewards(minRewards = 0): void {
        const rewardPool = CHEST_REWARD_POOL.map((reward) => reward.id);
        const minCount = Math.max(ROOM_RANGES.chestRewardCount.min, minRewards);
        const maxCount = Math.max(minCount, ROOM_RANGES.chestRewardCount.max);
        const rewardCount = randomInt(minCount, maxCount);
        const picked = new Set<string>();
        while (picked.size < rewardCount) {
            picked.add(this.randomFrom(rewardPool));
        }
        if (picked.size === 0) {
            this.addLog("宝箱是空的");
            return;
        }

        this.addLog(`宝箱开启，奖励 ${picked.size} 项`);
        picked.forEach((rewardId) => {
            const reward = CHEST_REWARD_POOL.find((item) => item.id === rewardId);
            if (!reward) return;

            const { value } = reward;

            if (value.coin) {
                this.addCoin(randomInt(value.coin.min, value.coin.max), reward.name);
            }

            if (value.hpRange) {
                const delta = randomInt(value.hpRange.min, value.hpRange.max);
                const safeDelta = this.snapshot.player.hp + delta <= 0 ? 1 - this.snapshot.player.hp : delta;
                this.addHp(safeDelta, reward.name);
            }

            if (typeof value.hp === "number") {
                this.addHp(value.hp, reward.name);
            }

            if (value.defense) {
                this.addDefense(randomInt(value.defense.min, value.defense.max), reward.name);
            }

            if (typeof value.defenseMax === "number") {
                this.addDefenseMax(value.defenseMax, reward.name);
            }

            if (typeof value.extraAtk === "number") {
                this.snapshot.player.extraAtk += value.extraAtk;
                this.addLog(`${reward.name}: ATK Extra +${value.extraAtk}`);
            }

            if (value.grantsScroll) {
                this.gainRandomScroll();
            }
        });
    }

    private resolveTrapAction(actionId: string): RoomActionResult {
        const triggerChance =
            actionId === "disarm" ? ROOM_RANGES.trapTriggerRate.disarm : ROOM_RANGES.trapTriggerRate.rush;
        const triggered = Math.random() < triggerChance;
        const trap = this.randomFrom([...ROOM_RANGES.trapTypes]) as TrapType;
        const trapName = TRAP_NAMES[trap];

        this.addLog(`陷阱显形: ${trapName}`);

        if (!triggered) {
            if (actionId === "disarm") {
                this.addLog(`${trapName}已被拆除，你顺手回收了可用残件`);
                if (trap === "fire") {
                    this.gainRandomScroll("火球术");
                } else if (trap === "acid") {
                    this.snapshot.player.extraAtk += ROOM_RANGES.trapReward.acidExtraAtk;
                    this.addLog(`酸雾残液被你炼成涂层: ATK Extra +${ROOM_RANGES.trapReward.acidExtraAtk}`);
                } else if (trap === "rock") {
                    this.addCoin(randomInt(ROOM_RANGES.trapReward.rockCoin.min, ROOM_RANGES.trapReward.rockCoin.max), "滚石机构零件");
                } else if (trap === "spike") {
                    if (Math.random() < ROOM_RANGES.trapReward.spikeFoodRate) {
                        this.addFood(randomInt(ROOM_RANGES.trapReward.spikeFood.min, ROOM_RANGES.trapReward.spikeFood.max), "尖刺机关补给");
                    } else {
                        this.addDefenseMax(ROOM_RANGES.trapReward.spikeDefMax, "尖刺机关补强");
                    }
                } else {
                    this.addLog("你避开了深坑边缘，但没有可回收的战利品");
                }
            } else {
                this.addLog(`你抓住${trapName}运作的空档，强行穿了过去`);
            }
            return { complete: true };
        }

        this.addLog(`${trapName}被触发，机关全面启动`);
        if (trap === "fire") {
            const damage = randomInt(ROOM_RANGES.trapDamage.fireTrue.min, ROOM_RANGES.trapDamage.fireTrue.max);
            this.addLog(`烈焰从墙孔喷出，灼烧你 ${damage} 点生命`);
            this.applyDamage(damage, true);
        } else if (trap === "acid") {
            const loss = this.snapshot.player.defense;
            this.snapshot.player.defense = 0;
            this.addLog(`酸雾扑面而来，护甲被腐蚀殆尽: Def -${loss}`);
        } else if (trap === "rock") {
            const damage = randomInt(ROOM_RANGES.trapDamage.rock.min, ROOM_RANGES.trapDamage.rock.max);
            this.addLog(`滚石砸落，压得你踉跄后退: HP -${damage}`);
            this.applyDamage(damage);
        } else if (trap === "spike") {
            const damage = randomInt(ROOM_RANGES.trapDamage.spike.min, ROOM_RANGES.trapDamage.spike.max);
            this.addLog(`地刺猛然弹起，贯穿你的落脚点: HP -${damage}`);
            this.applyDamage(damage);
        } else {
            const damage = randomInt(ROOM_RANGES.trapDamage.pit.min, ROOM_RANGES.trapDamage.pit.max);
            const isBottomFloor = this.snapshot.dungeon.floor >= FLOOR;
            this.addLog(isBottomFloor ? `脚下塌陷成深坑，你重重摔伤: HP -${damage}` : `脚下塌陷成深坑，你摔向下层: HP -${damage}`);
            this.applyDamage(damage);
            if (!isBottomFloor) {
                this.snapshot.dungeon.floor = Math.min(FLOOR, this.snapshot.dungeon.floor + 1);
                const roomCount = this.snapshot.dungeon.floor + ROOM_ADD;
                this.snapshot.dungeon.roomIdx = Math.min(this.snapshot.dungeon.roomIdx, roomCount);
                this.addLog(`你坠入下一层的同号房间: B${this.snapshot.dungeon.floor}-${this.snapshot.dungeon.roomIdx}`);
            }
        }

        if (Math.random() < ROOM_RANGES.trapCompensateRate) {
            this.addXp(randomInt(ROOM_RANGES.trapCompensateXp.min, ROOM_RANGES.trapCompensateXp.max), "陷阱补偿");
            this.addLog("你在险境中稳住了节奏，战斗技巧有所精进");
        }
        return { complete: true };
    }

    private resolveShopAction(actionId: string): RoomActionResult {
        if (actionId === "leave") {
            this.shopRoomKey = null;
            this.shopBuyStock = [];
            return { complete: true };
        }

        if (actionId.startsWith("shop_buy_")) {
            this.ensureShopInventory();
            const targetId = actionId.replace("shop_buy_", "");
            const item = this.shopBuyStock.find((entry) => entry.id === targetId);
            if (!item) {
                this.addLog("商品不存在");
                return { complete: false };
            }
            const disabledReason = this.getShopBuyDisabledReason(item);
            if (disabledReason) {
                this.addLog(`无法购买 ${item.name}: ${disabledReason}`);
                return { complete: false };
            }

            this.addCoin(-item.cost, `购买 ${item.name}`);
            this.addLog(`购买: ${item.name}`);
            item.soldOut = true;

            if (typeof item.value.hp === "number") {
                this.addHp(item.value.hp, item.name);
            }
            if (item.value.defense) {
                this.addDefense(randomInt(item.value.defense.min, item.value.defense.max), item.name);
            }
            if (typeof item.value.defenseMax === "number") {
                this.addDefenseMax(item.value.defenseMax, item.name);
            }
            if (typeof item.value.extraAtk === "number") {
                this.snapshot.player.extraAtk += item.value.extraAtk;
                this.addLog(`${item.name}: ATK Extra +${item.value.extraAtk}`);
            }
            if (item.value.coin) {
                this.addCoin(randomInt(item.value.coin.min, item.value.coin.max), item.name);
            }
            if (typeof item.value.food === "number") {
                this.addFood(item.value.food, item.name);
            }
            if (item.value.grantsScroll) {
                this.gainRandomScroll();
            }
            return { complete: false };
        }

        if (actionId === "shop_sell_armor_shard") {
            if (this.snapshot.player.defenseMax <= ROOM_RANGES.shop.sell.armorShard.minDefMax) {
                this.addLog("无法出售护甲片");
                return { complete: false };
            }
            this.addDefenseMax(-ROOM_RANGES.shop.sell.armorShard.defMaxCost, "出售护甲片");
            this.addCoin(ROOM_RANGES.shop.sell.armorShard.coinGain, "出售护甲片");
            this.addLog("完成: 出售护甲片");
            return { complete: false };
        }

        if (actionId === "shop_sell_food") {
            if (this.snapshot.player.food <= 0) {
                this.addLog("无法出售食物");
                return { complete: false };
            }
            this.addFood(-ROOM_RANGES.shop.sell.food.foodCost, "出售食物");
            this.addCoin(ROOM_RANGES.shop.sell.food.coinGain, "出售食物");
            this.addLog("完成: 出售食物");
            return { complete: false };
        }

        if (actionId === "shop_sell_scroll") {
            if (!this.snapshot.player.scroll) {
                this.addLog("无法出售卷轴");
                return { complete: false };
            }
            this.snapshot.player.scroll = null;
            this.addCoin(ROOM_RANGES.shop.sell.scrollCoinGain, "出售卷轴");
            this.addLog("完成: 出售卷轴");
            return { complete: false };
        }

        this.addLog("未知商店操作");
        return { complete: false };
    }

    private ensureShopInventory(): void {
        const room = this.getCurrentRoomNode();
        if (!room) return;
        const currentKey = room.key;
        if (this.shopRoomKey === currentKey && this.shopBuyStock.length > 0) {
            return;
        }

        const pool = [...SHOP_BUY_POOL];
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = randomInt(0, i);
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const stockSize = randomInt(ROOM_RANGES.shop.stockSize.min, ROOM_RANGES.shop.stockSize.max);
        this.shopBuyStock = pool.slice(0, stockSize).map((item) => ({
            id: item.id,
            name: item.name,
            cost: item.cost,
            value: item.value,
            soldOut: false,
        }));
        this.shopRoomKey = currentKey;
        this.addLog(`商人上架 ${stockSize} 件商品`);
    }

    private getShopBuyDisabledReason(item: ShopBuyStockItem): string | undefined {
        if (item.soldOut) return "已售出";
        if (item.id === "scroll" && this.snapshot.player.scroll) return "已有卷轴";
        if (this.snapshot.player.coin < item.cost) return "金币不足";
        return undefined;
    }

    private resolveBonfireAction(actionId: string): RoomActionResult {
        if (actionId === "heal") {
            this.addHp(randomInt(ROOM_RANGES.bonfire.heal.min, ROOM_RANGES.bonfire.heal.max), "篝火治疗");
            return { complete: true };
        }
        if (actionId === "cook") {
            this.addFood(randomInt(ROOM_RANGES.bonfire.cook.min, ROOM_RANGES.bonfire.cook.max), "篝火烹饪");
            return { complete: true };
        }
        if (actionId === "polish") {
            const delta = this.randomFrom([...ROOM_RANGES.bonfire.polishDeltaPool]);
            this.snapshot.player.extraAtk = Math.max(0, this.snapshot.player.extraAtk + delta);
            this.addLog(`篝火打磨: ATK Extra ${delta >= 0 ? "+" : ""}${delta}`);
            return { complete: true };
        }

        const branchCount = randomInt(ROOM_RANGES.bonfire.searchBranchCount.min, ROOM_RANGES.bonfire.searchBranchCount.max);
        const branchPool = ["find_food", "find_coin", "weak_monster"];
        const rolled = new Set<string>();
        while (rolled.size < branchCount) {
            rolled.add(this.randomFrom(branchPool));
        }
        this.addLog(`篝火搜索触发 ${rolled.size} 个事件`);

        if (rolled.has("find_food")) {
            this.addFood(randomInt(ROOM_RANGES.bonfire.foundFood.min, ROOM_RANGES.bonfire.foundFood.max), "篝火搜索(食物)");
        }
        if (rolled.has("find_coin")) {
            this.addCoin(randomInt(ROOM_RANGES.bonfire.foundCoin.min, ROOM_RANGES.bonfire.foundCoin.max), "篝火搜索(金币)");
        }
        if (rolled.has("weak_monster")) {
            return {
                complete: false,
                combat: {
                    monsterName: "余烬怪",
                    hp: randomInt(ROOM_RANGES.bonfire.weakMonsterHp.min, ROOM_RANGES.bonfire.weakMonsterHp.max),
                    atk: randomInt(ROOM_RANGES.bonfire.weakMonsterAtk.min, ROOM_RANGES.bonfire.weakMonsterAtk.max),
                },
            };
        }

        return { complete: true };
    }

    getCurrentForgeUpgradeType(): "thorns" | "heavy" | null {
        const room = this.getCurrentRoomNode();
        if (room?.eventType !== "forge_event") return null;
        if (!this.snapshot.combat.forgeUpgradeType) {
            const availableUpgradePool = ROOM_RANGES.forge.upgradePool.filter((upgradeType) => {
                if (upgradeType === "thorns") return !this.snapshot.player.hasThornsArmor;
                if (upgradeType === "heavy") return !this.snapshot.player.hasHeavyArmor;
                return true;
            });

            this.snapshot.combat.forgeUpgradeType = this.randomFrom([
                ...(availableUpgradePool.length ? availableUpgradePool : ROOM_RANGES.forge.upgradePool),
            ]);
        }
        return this.snapshot.combat.forgeUpgradeType;
    }

    private getForgeActions(): RoomAction[] {
        const upgradeType = this.getCurrentForgeUpgradeType();
        const actions: RoomAction[] = [
            {
                id: "weapon",
                label: `升级武器 (-${ROOM_RANGES.forge.weaponCost} Coin)`,
                displayLabel: "升级武器",
                costBadges: [{ resource: "coin", amount: -ROOM_RANGES.forge.weaponCost }],
                disabledReason: this.snapshot.player.coin < ROOM_RANGES.forge.weaponCost ? "金币不足" : undefined,
            },
            {
                id: "armor",
                label: `锻造护甲 (-${ROOM_RANGES.forge.armorCost} Coin)`,
                displayLabel: "锻造护甲",
                costBadges: [{ resource: "coin", amount: -ROOM_RANGES.forge.armorCost }],
                disabledReason:
                    this.snapshot.player.defenseMax >= ROOM_RANGES.forge.armorDefMaxCap
                        ? "护甲已达上限"
                        : this.snapshot.player.coin < ROOM_RANGES.forge.armorCost
                            ? "金币不足"
                            : undefined,
            },
        ];

        if (upgradeType === "thorns") {
            actions.push({
                id: "forge_armor_thorns",
                label: `改造护甲-荆棘 (-${ROOM_RANGES.forge.thornsCostExtraAtk} ATK Extra / -${ROOM_RANGES.forge.thornsCostCoin} Coin)`,
                displayLabel: "改造护甲-荆棘",
                costBadges: [
                    { resource: "extraAtk", amount: -ROOM_RANGES.forge.thornsCostExtraAtk, label: "ATK Extra" },
                    { resource: "coin", amount: -ROOM_RANGES.forge.thornsCostCoin },
                ],
                disabledReason: this.getForgeUpgradeDisabledReason("thorns"),
            });
        } else if (upgradeType === "heavy") {
            actions.push({
                id: "forge_armor_heavy",
                label: `改造护甲-重甲 (-${ROOM_RANGES.forge.heavyArmorCostDefMax} Def Max / -${ROOM_RANGES.forge.heavyArmorCostCoin} Coin)`,
                displayLabel: "改造护甲-重甲",
                costBadges: [
                    { resource: "defenseMax", amount: -ROOM_RANGES.forge.heavyArmorCostDefMax, label: "Def Max" },
                    { resource: "coin", amount: -ROOM_RANGES.forge.heavyArmorCostCoin },
                ],
                disabledReason: this.getForgeUpgradeDisabledReason("heavy"),
            });
        }

        actions.push({ id: "leave", label: "离开铸锻" });
        return actions;
    }

    private getForgeUpgradeDisabledReason(upgradeType: "thorns" | "heavy"): string | undefined {
        if (upgradeType === "thorns") {
            if (this.snapshot.player.hasThornsArmor) return "已拥有荆棘";
            if (this.snapshot.player.extraAtk < ROOM_RANGES.forge.thornsCostExtraAtk) return "ATK Extra 不足";
            if (this.snapshot.player.coin < ROOM_RANGES.forge.thornsCostCoin) return "金币不足";
            return undefined;
        }

        if (this.snapshot.player.hasHeavyArmor) return "已拥有重甲";
        if (this.snapshot.player.defenseMax <= ROOM_RANGES.forge.heavyArmorCostDefMax) return "Def Max 过低";
        if (this.snapshot.player.coin < ROOM_RANGES.forge.heavyArmorCostCoin) return "金币不足";
        return undefined;
    }

    private resolveForgeAction(actionId: string): RoomActionResult {
        if (actionId === "leave") return { complete: true };

        if (actionId === "weapon") {
            if (this.snapshot.player.coin < ROOM_RANGES.forge.weaponCost) {
                this.addLog("金币不足，无法升级武器");
                return { complete: false };
            }
            this.addCoin(-ROOM_RANGES.forge.weaponCost, "铸锻升级武器");
            const delta = this.randomFrom([...ROOM_RANGES.forge.weaponDeltaPool]);
            this.snapshot.player.extraAtk = Math.max(0, this.snapshot.player.extraAtk + delta);
            this.addLog(`铸锻升级武器: ATK Extra ${delta >= 0 ? "+" : ""}${delta}`);
            this.addXp(randomInt(ROOM_RANGES.forge.xpGain.min, ROOM_RANGES.forge.xpGain.max), "铸锻奖励");
            return { complete: true };
        }

        if (actionId === "forge_armor_thorns") {
            const disabledReason = this.getForgeUpgradeDisabledReason("thorns");
            if (disabledReason) {
                this.addLog(`无法改造为荆棘: ${disabledReason}`);
                return { complete: false };
            }
            this.snapshot.player.extraAtk = Math.max(0, this.snapshot.player.extraAtk - ROOM_RANGES.forge.thornsCostExtraAtk);
            this.addLog(`荆棘改造: ATK Extra -${ROOM_RANGES.forge.thornsCostExtraAtk}`);
            this.addCoin(-ROOM_RANGES.forge.thornsCostCoin, "铸锻改造-荆棘");
            this.snapshot.player.hasThornsArmor = true;
            this.addLog("护甲改造完成：获得荆棘效果");
            this.addXp(randomInt(ROOM_RANGES.forge.xpGain.min, ROOM_RANGES.forge.xpGain.max), "铸锻奖励");
            return { complete: true };
        }

        if (actionId === "forge_armor_heavy") {
            const disabledReason = this.getForgeUpgradeDisabledReason("heavy");
            if (disabledReason) {
                this.addLog(`无法改造为重甲: ${disabledReason}`);
                return { complete: false };
            }
            this.addDefenseMax(-ROOM_RANGES.forge.heavyArmorCostDefMax, "重甲改造");
            this.addCoin(-ROOM_RANGES.forge.heavyArmorCostCoin, "铸锻改造-重甲");
            this.snapshot.player.hasHeavyArmor = true;
            this.addLog("护甲改造完成：获得重甲效果");
            this.addXp(randomInt(ROOM_RANGES.forge.xpGain.min, ROOM_RANGES.forge.xpGain.max), "铸锻奖励");
            return { complete: true };
        }

        if (this.snapshot.player.coin < ROOM_RANGES.forge.armorCost) {
            this.addLog("金币不足，无法锻造护甲");
            return { complete: false };
        }
        if (this.snapshot.player.defenseMax >= ROOM_RANGES.forge.armorDefMaxCap) {
            this.addLog("Def Max 已达上限");
            return { complete: false };
        }

        this.addCoin(-ROOM_RANGES.forge.armorCost, "铸锻锻造护甲");
        this.addDefenseMax(ROOM_RANGES.forge.armorDefMaxGain, "铸锻锻造护甲");
        this.addDefense(ROOM_RANGES.forge.armorDefGain, "铸锻锻造护甲");
        this.addXp(randomInt(ROOM_RANGES.forge.xpGain.min, ROOM_RANGES.forge.xpGain.max), "铸锻奖励");
        return { complete: true };
    }

    private resolveStatueAction(actionId: string): RoomActionResult {
        if (actionId === "leave") return { complete: true };

        let blessChance: number = ROOM_RANGES.statueBlessRate.normal;
        if (actionId === "offer") {
            if (this.snapshot.player.coin > 0) {
                const cost = randomInt(
                    ROOM_RANGES.statueOfferCoin.min,
                    Math.min(ROOM_RANGES.statueOfferCoin.max, this.snapshot.player.coin),
                );
                this.addCoin(-cost, "雕像供奉");
            } else if (this.snapshot.player.food > 0) {
                this.addFood(-ROOM_RANGES.statue.offerFoodCost, "雕像供奉");
            } else {
                this.addLog("无可供奉资源");
                return { complete: false };
            }
            blessChance = ROOM_RANGES.statueBlessRate.offer;
        }

        if (Math.random() < blessChance) {
            const blessing = this.randomFrom(["hp", "def", "atk", "xp"]);
            this.addLog("获得祝福");
            if (blessing === "hp") {
                this.addHp(randomInt(ROOM_RANGES.statueBless.hp.min, ROOM_RANGES.statueBless.hp.max), "雕像祝福");
            } else if (blessing === "def") {
                this.addDefense(randomInt(ROOM_RANGES.statueBless.def.min, ROOM_RANGES.statueBless.def.max), "雕像祝福");
            } else if (blessing === "atk") {
                this.snapshot.player.extraAtk += ROOM_RANGES.statue.blessAtkGain;
                this.addLog(`雕像祝福: ATK Extra +${ROOM_RANGES.statue.blessAtkGain}`);
            } else {
                this.addXp(
                    Math.random() < ROOM_RANGES.statueBless.xp.jackpotRate
                        ? ROOM_RANGES.statueBless.xp.jackpot
                        : randomInt(ROOM_RANGES.statueBless.xp.min, ROOM_RANGES.statueBless.xp.max),
                    "雕像祝福",
                );
            }
            return { complete: true };
        }

        this.addLog("遭受诅咒");
        if (Math.random() < ROOM_RANGES.statue.curseTypeRate) {
            this.applyDamage(
                randomInt(ROOM_RANGES.statueCurseTrueDamage.min, ROOM_RANGES.statueCurseTrueDamage.max),
                true,
            );
        } else {
            this.addXp(-ROOM_RANGES.statue.curseXpLoss, "雕像诅咒");
        }
        return { complete: true };
    }

    private resolveMineAction(actionId: string): RoomActionResult {
        if (actionId === "leave") {
            return { complete: true };
        }

        if (this.snapshot.player.food > 0) {
            this.addFood(-ROOM_RANGES.mine.digFoodCost, "矿洞挖掘消耗");
        } else {
            if (this.snapshot.player.hp < ROOM_RANGES.mine.minHpRequiredWithoutFood) {
                this.addLog("生命过低，无法继续挖掘");
                return { complete: false };
            }
            this.applyDamage(randomInt(ROOM_RANGES.mine.noFoodTrueDamage.min, ROOM_RANGES.mine.noFoodTrueDamage.max), true);
        }

        this.skipRoomConsequenceOnce = true;

        const roll = randomInt(1, ROOM_RANGES.mine.rollMax);
        if (roll <= ROOM_RANGES.mine.chestRateUpper) {
            this.addLog("挖到埋藏宝箱");
            this.resolveChestRewards();
            return { complete: false };
        }
        if (roll <= ROOM_RANGES.mine.rareOreRateUpper) {
            if (Math.random() < ROOM_RANGES.mine.rareOreAtkRate) {
                this.snapshot.player.extraAtk += ROOM_RANGES.mine.rareOreAtkGain;
                this.addLog(`矿洞稀有矿石: ATK Extra +${ROOM_RANGES.mine.rareOreAtkGain}`);
            } else {
                this.addDefenseMax(ROOM_RANGES.mine.rareOreDefMaxGain, "矿洞稀有矿石");
            }
            return { complete: false };
        }
        if (roll <= ROOM_RANGES.mine.normalOreRateUpper) {
            this.addCoin(randomInt(ROOM_RANGES.mine.normalCoin.min, ROOM_RANGES.mine.normalCoin.max), "矿洞普通矿石");
            return { complete: false };
        }
        if (roll <= ROOM_RANGES.mine.plantRateUpper) {
            this.addFood(randomInt(ROOM_RANGES.mine.plantFood.min, ROOM_RANGES.mine.plantFood.max), "矿洞植物");
            this.addHp(randomInt(ROOM_RANGES.mine.plantHp.min, ROOM_RANGES.mine.plantHp.max), "矿洞植物");
            return { complete: false };
        }
        if (roll <= ROOM_RANGES.mine.larvaRateUpper) {
            return {
                complete: false,
                combat: {
                    monsterName: "幼年岩虫",
                    hp: randomInt(ROOM_RANGES.mine.larvaHp.min, ROOM_RANGES.mine.larvaHp.max),
                    atk: randomInt(ROOM_RANGES.mine.larvaAtk.min, ROOM_RANGES.mine.larvaAtk.max),
                },
            };
        }

        this.addLog("只挖出一堆废石");
        return { complete: false };
    }

    private getCurrentRoomNode(): RoomNode | null {
        const { floor, roomIdx, map } = this.snapshot.dungeon;
        return map[`${floor}-${roomIdx}`] ?? null;
    }

    private tryRevealNeighbors(room: RoomNode): void {
        const sameFloorKey = `${room.floor}-${room.index + 1}`;
        if (Math.random() < NEXT_ROOM_REVEAL_RATE && this.snapshot.dungeon.map[sameFloorKey]) {
            this.revealRoomWithBranchRule(sameFloorKey);
            this.addLog(`侦查到下个房间线索: ${sameFloorKey}`);
        }

        const nextFloorKey = `${room.floor + 1}-${room.index}`;
        if (Math.random() < NEXT_FLOOR_REVEAL_RATE && this.snapshot.dungeon.map[nextFloorKey]) {
            this.revealRoomWithBranchRule(nextFloorKey);
            this.addLog(`侦查到下层房间线索: ${nextFloorKey}`);
        }
    }

    private revealRoomWithBranchRule(key: string): void {
        const room = this.snapshot.dungeon.map[key];
        if (!room) return;
        room.revealed = true;

        if (room.eventType === "branch_event" && room.branches && room.branches.length > 0) {
            if (!room.revealedBranchIndexes || room.revealedBranchIndexes.length === 0) {
                const revealedIdx = randomInt(0, room.branches.length - 1);
                room.revealedBranchIndexes = [revealedIdx];
            }
        }
    }

    private resolveBranchAction(actionId: string): RoomActionResult {
        const room = this.getCurrentRoomNode();

        if (!room?.branches || room.branches.length === 0) {
            return { complete: true };
        }

        const selectedIdx = Number(actionId.replace("branch_", ""));
        const selected = room.branches[selectedIdx];
        if (!selected) {
            this.addLog("分支选择无效");
            return { complete: false };
        }

        const selectedEventType = selected[1] as RoomEventType;
        room.chosenBranchName = selected[0];
        room.chosenBranchEventType = selectedEventType;
        this.addLog(`你沿着分支前进: ${selected[0]}`);

        if (selectedEventType === "shop_event") {
            this.ensureShopInventory();
        }

        if (Math.random() < BRANCH_REORDER_SUCCESS_RATE) {
            this.reorderCurrentFloorFutureRooms();
            this.addLog("路线变化：后续房间顺序被扰动");
        } else {
            this.addLog("路线保持：后续房间顺序未变化");
        }
        return { complete: false, nextEventType: selectedEventType };
    }

    private reorderCurrentFloorFutureRooms(): void {
        const floor = this.snapshot.dungeon.floor;
        const roomCount = floor + ROOM_ADD;
        const currentIdx = this.snapshot.dungeon.roomIdx;
        const futureEnd = roomCount - 1;
        if (currentIdx >= futureEnd) return;

        const futureIdxs = Array.from({ length: futureEnd - currentIdx }, (_, i) => currentIdx + 1 + i);
        const futureRooms = futureIdxs.map((idx) => this.snapshot.dungeon.map[`${floor}-${idx}`]).filter(Boolean);

        for (let i = futureRooms.length - 1; i > 0; i -= 1) {
            const j = randomInt(0, i);
            [futureRooms[i], futureRooms[j]] = [futureRooms[j], futureRooms[i]];
        }

        futureIdxs.forEach((idx, order) => {
            const source = futureRooms[order];
            if (!source) return;
            const key = `${floor}-${idx}`;
            this.snapshot.dungeon.map[key] = {
                ...source,
                key,
                floor,
                index: idx,
                revealed: source.eventType === "boss_event",
                reorderedByBranch: true,
            };
        });
    }
}

export const gameState = new GameState();
