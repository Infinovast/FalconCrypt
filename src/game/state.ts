import {
    BOSS_BY_FLOOR,
    BRANCH_REORDER_SUCCESS_RATE,
    BRANCH_ROOM,
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
} from "./types";

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
    soldOut: boolean;
};

type FinalizeRoomResult = {
    ignored: boolean;
    playerDied: boolean;
    dungeonCleared: boolean;
};

const ROOM_EVENT_NAMES: Record<string, string> = {
    branch_event: "分叉口",
    chest_event: "宝箱房",
    trap_event: "陷阱房",
    shop_event: "商人房",
    bonfire_event: "篝火房",
    forge_event: "铸锻房",
    statue_event: "雕像房",
    mine_event: "矿洞房",
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

export class GameState {
    private chosenChars: CharacterTuple[] = [];
    private shopRoomKey: string | null = null;
    private shopBuyStock: ShopBuyStockItem[] = [];
    private skipRoomConsequenceOnce = false;

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
            frozenEnemyTurns: 0,
            tempExtraAtk: 0,
            tempMonsterAtkDelta: 0,
            pendingFoodCost: 0,
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
        };
        this.snapshot.dungeon = { floor: 1, roomIdx: 1, map: {} };
        this.snapshot.combat = {
            monsterName: "",
            monsterHp: 0,
            monsterAtk: 0,
            skillPoint: SKILL_POINT_MAX,
            isBoss: false,
            frozenEnemyTurns: 0,
            tempExtraAtk: 0,
            tempMonsterAtkDelta: 0,
            pendingFoodCost: 0,
        };
        this.snapshot.logs = [];
        this.shopRoomKey = null;
        this.shopBuyStock = [];
        this.skipRoomConsequenceOnce = false;
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

        for (let floor = 1; floor <= FLOOR; floor += 1) {
            const roomCount = floor + ROOM_ADD;
            for (let room = 1; room <= roomCount; room += 1) {
                const key = `${floor}-${room}`;
                const tuple = room < roomCount ? weightedChoice(nonBossRooms, nonBossWeights) : ROOMS[ROOMS.length - 1];
                nextMap[key] = {
                    key,
                    floor,
                    index: room,
                    name: tuple[0],
                    eventType: tuple[1] as RoomEventType,
                    revealed: tuple[1] === "boss_event",
                    reorderedByBranch: false,
                };
            }

            const replaceCount = randomInt(0, Math.min(floor, 2));
            const candidateIndexes = Array.from({ length: roomCount - 1 }, (_, i) => i + 1);
            for (let i = candidateIndexes.length - 1; i > 0; i -= 1) {
                const j = randomInt(0, i);
                [candidateIndexes[i], candidateIndexes[j]] = [candidateIndexes[j], candidateIndexes[i]];
            }
            candidateIndexes.slice(0, replaceCount).forEach((roomIdx) => {
                const key = `${floor}-${roomIdx}`;
                const branches: RoomTuple[] = [];
                const branchCount = randomInt(2, 3);
                while (branches.length < branchCount) {
                    branches.push(weightedChoice(nonBossRooms, nonBossWeights));
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
        return [
            { id: "attack", label: "普通攻击" },
            {
                id: "critical",
                label: `暴击 (-${SKILL_SP_COST.critical} SP)`,
                disabledReason: this.getCriticalDisabledReason(),
            },
            {
                id: "skill",
                label: `角色技能: ${this.snapshot.player.skill || "-"}`,
                disabledReason: this.getRoleSkillDisabledReason(),
            },
            {
                id: "scroll",
                label: `使用卷轴: ${this.snapshot.player.scroll ?? "无"}`,
                disabledReason: this.getScrollDisabledReason(),
            },
        ];
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
                const branchActions = room.branches.map((branch, index) => ({
                    id: `branch_${index}`,
                    label: `选择分支 ${String.fromCharCode(65 + index)}: ${branch[0]}`,
                }));
                branchActions.push({ id: "leave", label: "放弃分支，继续前进" });
                return branchActions;
            }
            case "chest_event":
                return [{ id: "open", label: "打开宝箱" }];
            case "trap_event":
                return [
                    { id: "disarm", label: "解除陷阱" },
                    { id: "rush", label: "强行通过" },
                ];
            case "shop_event":
                return [{ id: "leave", label: "离开商人" }];
            case "bonfire_event":
                return [
                    { id: "heal", label: "治疗" },
                    { id: "cook", label: "加工食物" },
                    { id: "polish", label: "打磨武器" },
                    { id: "search", label: "搜索" },
                ];
            case "forge_event":
                return [
                    {
                        id: "weapon",
                        label: "升级武器 (-4 Coin)",
                        disabledReason: this.snapshot.player.coin < 4 ? "金币不足" : undefined,
                    },
                    {
                        id: "armor",
                        label: "锻造护甲 (-5 Coin)",
                        disabledReason:
                            this.snapshot.player.defenseMax >= 7
                                ? "护甲已达上限"
                                : this.snapshot.player.coin < 5
                                    ? "金币不足"
                                    : undefined,
                    },
                    { id: "leave", label: "离开铸锻" },
                ];
            case "statue_event":
                return [
                    { id: "pray", label: "祈祷" },
                    {
                        id: "offer",
                        label: "供奉后祈祷",
                        disabledReason: this.snapshot.player.coin <= 0 && this.snapshot.player.food <= 0 ? "无可供奉资源" : undefined,
                    },
                    { id: "leave", label: "离开雕像" },
                ];
            case "mine_event": {
                const noFoodNoHp = this.snapshot.player.food <= 0 && this.snapshot.player.hp <= 1;
                return [
                    {
                        id: "dig",
                        label: this.snapshot.player.food > 0 ? "挖掘 (-1 Food)" : "挖掘 (-HP)",
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
                disabledReason,
            };
        });

        const sell: RoomAction[] = [
            {
                id: "shop_sell_armor_shard",
                label: "出售护甲片 (+5 Coin)",
                disabledReason: this.snapshot.player.defenseMax > 1 ? undefined : "Def Max 过低",
            },
            {
                id: "shop_sell_food",
                label: "出售食物 (+1 Coin)",
                disabledReason: this.snapshot.player.food > 0 ? undefined : "无食物",
            },
            {
                id: "shop_sell_scroll",
                label: "出售卷轴 (+5 Coin)",
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
                    this.resolveChestRewards();
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
        this.snapshot.combat.frozenEnemyTurns = 0;
        this.snapshot.combat.tempExtraAtk = 0;
        this.snapshot.combat.tempMonsterAtkDelta = 0;
        this.snapshot.combat.pendingFoodCost = 0;
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
            damage -= blocked;
        }
        this.snapshot.player.hp = Math.max(0, this.snapshot.player.hp - damage);
        this.addLog(`${this.snapshot.combat.monsterName} 反击 ${actualAtk} (生效 ${damage})`);
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
        }

        if (this.snapshot.combat.monsterHp <= 0) {
            result.victory = true;
            return result;
        }

        if (!endTurn) return result;

        if (this.snapshot.combat.frozenEnemyTurns > 0) {
            this.snapshot.combat.frozenEnemyTurns -= 1;
            this.addLog("寒冰效果生效，敌人回合被跳过");
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

        if (this.snapshot.combat.pendingFoodCost > 0) {
            const cost = Math.min(this.snapshot.player.food, this.snapshot.combat.pendingFoodCost);
            this.snapshot.player.food -= cost;
            this.addLog(`净化结算，Food -${cost}`);
        }

        if (victory && wasBoss && this.snapshot.player.character?.[0] === "盗贼") {
            this.gainRandomScroll();
            this.addLog("盗贼被动触发：击败 Boss 获得卷轴");
        }

        this.snapshot.combat.monsterName = "";
        this.snapshot.combat.monsterHp = 0;
        this.snapshot.combat.monsterAtk = 0;
        this.snapshot.combat.skillPoint = SKILL_POINT_MAX;
        this.snapshot.combat.isBoss = false;
        this.snapshot.combat.frozenEnemyTurns = 0;
        this.snapshot.combat.tempExtraAtk = 0;
        this.snapshot.combat.tempMonsterAtkDelta = 0;
        this.snapshot.combat.pendingFoodCost = 0;
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

        if (this.snapshot.player.food > 0) {
            this.addFood(-1, "食物消耗");
            const heal = randomInt(ROOM_RANGES.roomConsequence.healMin, this.snapshot.dungeon.floor + 2);
            this.addHp(heal, "食物恢复");
        } else {
            const loss = randomInt(ROOM_RANGES.roomConsequence.hungerLossMin, this.snapshot.dungeon.floor + 2);
            this.addHp(-loss, "饥饿损失");
        }

        if (this.snapshot.player.defense < this.snapshot.player.defenseMax) {
            this.addDefense(1, "护甲恢复");
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

    clearCombatLogs(): void {
        this.snapshot.logs = this.snapshot.logs.filter(
            (line) => !COMBAT_LOG_MARKERS.some((marker) => line.includes(marker)),
        );
    }

    private randomFrom<T>(arr: T[]): T {
        return arr[randomInt(0, arr.length - 1)];
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
        this.snapshot.player.defense = Math.max(0, Math.min(this.snapshot.player.defenseMax, this.snapshot.player.defense + amount));
        this.addLog(this.formatResourceLog("Def", amount, source));
    }

    private addDefenseMax(amount: number, source?: string): void {
        this.snapshot.player.defenseMax = Math.max(1, this.snapshot.player.defenseMax + amount);
        this.snapshot.player.defense = Math.min(this.snapshot.player.defense, this.snapshot.player.defenseMax);
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
        this.addLog(`${trueDamage ? "真实" : ""}伤害 -${amount}`);
    }

    private gainRandomScroll(forceScroll?: ScrollType): void {
        const nextScroll = forceScroll ?? this.randomFrom([...SCROLL_LIST]);

        if (!this.snapshot.player.scroll) {
            this.snapshot.player.scroll = nextScroll;
            this.addLog(`获得卷轴: ${nextScroll}`);
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
        const multiplier = this.randomFrom([0.5, 1, 2]);
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
            this.snapshot.combat.tempMonsterAtkDelta -= reduction;
            this.snapshot.combat.pendingFoodCost += n;
            this.addLog(`净化生效：怪物攻击 -${reduction}，战后 Food -${n}`);
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

    private useScrollInCombat(): { spent: boolean; escaped: boolean } {
        const scroll = this.snapshot.player.scroll;
        const disabledReason = this.getScrollDisabledReason();
        if (!scroll || disabledReason) {
            this.addLog(`无法使用卷轴: ${disabledReason ?? "无卷轴"}`);
            return { spent: false, escaped: false };
        }

        if (scroll === "火球术") {
            const damage = randomInt(9, 14);
            this.snapshot.combat.monsterHp -= damage;
            this.addLog(`火球术造成 ${damage} 伤害`);
        } else if (scroll === "寒冰术") {
            this.snapshot.combat.frozenEnemyTurns = 1;
            this.addLog("寒冰术冻结敌人 1 回合");
        } else if (scroll === "治疗术") {
            const heal = this.snapshot.player.hp > 10 ? randomInt(4, 7) : randomInt(9, 13);
            this.addHp(heal);
            this.addLog(`治疗术恢复 ${heal} HP`);
        } else if (scroll === "隐身术") {
            this.snapshot.player.scroll = null;
            this.addLog("隐身术生效，脱离战斗");
            return { spent: true, escaped: true };
        }

        this.snapshot.player.scroll = null;
        return { spent: true, escaped: false };
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

    private resolveChestRewards(): void {
        const rewardPool = ["coin", "cloudy", "life", "whetstone", "poor_armor", "superior_armor", "scroll"];
        const rewardCount = randomInt(ROOM_RANGES.chestRewardCount.min, ROOM_RANGES.chestRewardCount.max);
        const picked = new Set<string>();
        while (picked.size < rewardCount) {
            picked.add(this.randomFrom(rewardPool));
        }
        if (picked.size === 0) {
            this.addLog("宝箱是空的");
            return;
        }

        this.addLog(`宝箱开启，奖励 ${picked.size} 项`);
        picked.forEach((reward) => {
            if (reward === "coin") {
                this.addCoin(randomInt(ROOM_RANGES.chestCoin.min, ROOM_RANGES.chestCoin.max), "宝箱金币");
            } else if (reward === "cloudy") {
                const delta = randomInt(ROOM_RANGES.cloudyPotion.min, ROOM_RANGES.cloudyPotion.max);
                const safeDelta = this.snapshot.player.hp + delta <= 0 ? 1 - this.snapshot.player.hp : delta;
                this.addHp(safeDelta, "浑浊药水");
            } else if (reward === "life") {
                this.addHp(6, "生命药水");
            } else if (reward === "whetstone") {
                this.snapshot.player.extraAtk += 1;
                this.addLog("磨刀石: ATK Extra +1");
            } else if (reward === "poor_armor") {
                this.addDefense(randomInt(ROOM_RANGES.poorArmor.min, ROOM_RANGES.poorArmor.max), "破损护甲");
            } else if (reward === "superior_armor") {
                this.addDefenseMax(2, "精良护甲");
            } else if (reward === "scroll") {
                this.gainRandomScroll();
            }
        });
    }

    private resolveTrapAction(actionId: string): RoomActionResult {
        const triggerChance =
            actionId === "disarm" ? ROOM_RANGES.trapTriggerRate.disarm : ROOM_RANGES.trapTriggerRate.rush;
        const triggered = Math.random() < triggerChance;
        const trap = this.randomFrom(["fire", "acid", "rock", "spike"]);

        if (!triggered) {
            this.addLog("陷阱解除成功");
            if (trap === "fire") {
                this.gainRandomScroll("火球术");
            } else if (trap === "acid") {
                this.snapshot.player.extraAtk += 1;
                this.addLog("磨刀石奖励: ATK Extra +1");
            } else if (trap === "rock") {
                this.addCoin(randomInt(ROOM_RANGES.trapReward.rockCoin.min, ROOM_RANGES.trapReward.rockCoin.max), "岩石奖励");
            } else {
                if (Math.random() < 0.5) {
                    this.addFood(randomInt(ROOM_RANGES.trapReward.spikeFood.min, ROOM_RANGES.trapReward.spikeFood.max), "尖刺奖励");
                } else {
                    this.addDefenseMax(2, "尖刺奖励");
                }
            }
            return { complete: true };
        }

        this.addLog("触发陷阱");
        if (trap === "fire") {
            this.applyDamage(randomInt(ROOM_RANGES.trapDamage.fireTrue.min, ROOM_RANGES.trapDamage.fireTrue.max), true);
        } else if (trap === "acid") {
            const loss = this.snapshot.player.defense;
            this.snapshot.player.defense = 0;
            this.addLog(`酸雾腐蚀，Def -${loss}`);
        } else if (trap === "rock") {
            this.applyDamage(randomInt(ROOM_RANGES.trapDamage.rock.min, ROOM_RANGES.trapDamage.rock.max));
        } else {
            this.applyDamage(randomInt(ROOM_RANGES.trapDamage.spike.min, ROOM_RANGES.trapDamage.spike.max));
        }

        if (Math.random() < ROOM_RANGES.trapCompensateRate) {
            this.addXp(randomInt(1, 3), "陷阱补偿");
            this.addLog("获得陷阱补偿");
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

            if (item.id === "small_hp") {
                this.addHp(5, item.name);
            } else if (item.id === "large_hp") {
                this.addHp(9, item.name);
            } else if (item.id === "whetstone") {
                this.snapshot.player.extraAtk += 1;
                this.addLog(`${item.name}: ATK Extra +1`);
            } else if (item.id === "poor_armor") {
                this.addDefense(randomInt(3, 6), item.name);
            } else if (item.id === "armor_shard") {
                this.addDefenseMax(1, item.name);
            } else if (item.id === "coin_bag") {
                this.addCoin(randomInt(1, 5), item.name);
            } else if (item.id === "small_ration") {
                this.addFood(2, item.name);
            } else if (item.id === "large_ration") {
                this.addFood(5, item.name);
            } else if (item.id === "scroll") {
                this.gainRandomScroll();
            }
            return { complete: false };
        }

        if (actionId === "shop_sell_armor_shard") {
            if (this.snapshot.player.defenseMax <= 1) {
                this.addLog("无法出售护甲片");
                return { complete: false };
            }
            this.addDefenseMax(-1, "出售护甲片");
            this.addCoin(5, "出售护甲片");
            this.addLog("完成: 出售护甲片");
            return { complete: false };
        }

        if (actionId === "shop_sell_food") {
            if (this.snapshot.player.food <= 0) {
                this.addLog("无法出售食物");
                return { complete: false };
            }
            this.addFood(-1, "出售食物");
            this.addCoin(1, "出售食物");
            this.addLog("完成: 出售食物");
            return { complete: false };
        }

        if (actionId === "shop_sell_scroll") {
            if (!this.snapshot.player.scroll) {
                this.addLog("无法出售卷轴");
                return { complete: false };
            }
            this.snapshot.player.scroll = null;
            this.addCoin(5, "出售卷轴");
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
        const stockSize = randomInt(6, 9);
        this.shopBuyStock = pool.slice(0, stockSize).map((item) => ({
            id: item.id,
            name: item.name,
            cost: item.cost,
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
            const delta = this.randomFrom([-1, 1, 1, 2]);
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

    private resolveForgeAction(actionId: string): RoomActionResult {
        if (actionId === "leave") return { complete: true };

        if (actionId === "weapon") {
            if (this.snapshot.player.coin < 4) {
                this.addLog("金币不足，无法升级武器");
                return { complete: false };
            }
            this.addCoin(-4, "铸锻升级武器");
            const delta = this.randomFrom([-1, 1, 1, 2]);
            this.snapshot.player.extraAtk = Math.max(0, this.snapshot.player.extraAtk + delta);
            this.addLog(`铸锻升级武器: ATK Extra ${delta >= 0 ? "+" : ""}${delta}`);
            return { complete: true };
        }

        if (this.snapshot.player.coin < 5) {
            this.addLog("金币不足，无法锻造护甲");
            return { complete: false };
        }
        if (this.snapshot.player.defenseMax >= 7) {
            this.addLog("Def Max 已达上限");
            return { complete: false };
        }

        this.addCoin(-5, "铸锻锻造护甲");
        this.addDefenseMax(1, "铸锻锻造护甲");
        this.addDefense(1, "铸锻锻造护甲");
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
                this.addFood(-1, "雕像供奉");
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
                this.snapshot.player.extraAtk += 1;
                this.addLog("雕像祝福: ATK Extra +1");
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
        if (Math.random() < 0.5) {
            this.applyDamage(
                randomInt(ROOM_RANGES.statueCurseTrueDamage.min, ROOM_RANGES.statueCurseTrueDamage.max),
                true,
            );
        } else {
            this.addXp(-1, "雕像诅咒");
        }
        return { complete: true };
    }

    private resolveMineAction(actionId: string): RoomActionResult {
        if (actionId === "leave") {
            return { complete: true };
        }

        if (this.snapshot.player.food > 0) {
            this.addFood(-1, "矿洞挖掘消耗");
        } else {
            if (this.snapshot.player.hp <= 1) {
                this.addLog("生命过低，无法继续挖掘");
                return { complete: false };
            }
            this.applyDamage(randomInt(ROOM_RANGES.mine.noFoodTrueDamage.min, ROOM_RANGES.mine.noFoodTrueDamage.max), true);
        }

        this.skipRoomConsequenceOnce = true;

        const roll = randomInt(1, 100);
        if (roll <= ROOM_RANGES.mine.chestRateUpper) {
            this.addLog("挖到埋藏宝箱");
            this.resolveChestRewards();
            return { complete: false };
        }
        if (roll <= ROOM_RANGES.mine.rareOreRateUpper) {
            if (Math.random() < 0.5) {
                this.snapshot.player.extraAtk += 1;
                this.addLog("矿洞稀有矿石: ATK Extra +1");
            } else {
                this.addDefenseMax(2, "矿洞稀有矿石");
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
            this.addLog(`侦查到同层线索: ${sameFloorKey}`);
        }

        const nextFloorKey = `${room.floor + 1}-${room.index}`;
        if (Math.random() < NEXT_FLOOR_REVEAL_RATE && this.snapshot.dungeon.map[nextFloorKey]) {
            this.revealRoomWithBranchRule(nextFloorKey);
            this.addLog(`侦查到下层线索: ${nextFloorKey}`);
        }
    }

    private revealRoomWithBranchRule(key: string): void {
        const room = this.snapshot.dungeon.map[key];
        if (!room) return;
        room.revealed = true;

        if (room.eventType === "branch_event" && room.branches && room.branches.length > 0) {
            const branch = this.randomFrom(room.branches);
            room.branches = [branch];
        }
    }

    private resolveBranchAction(actionId: string): RoomActionResult {
        const room = this.getCurrentRoomNode();

        if (actionId === "leave") {
            if (room) {
                room.chosenBranchName = undefined;
                room.chosenBranchEventType = undefined;
            }
            this.addLog("放弃分支，沿原路线前进");
            return { complete: true };
        }

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
