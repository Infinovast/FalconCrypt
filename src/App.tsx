import { useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { FLOOR, RESOURCE_THRESHOLD_RULES, ROOM_ADD, THRESHOLD_DISABLED, XP_MAX } from "./game/constants";
import { gameState } from "./game/state";
import type { CharacterTuple, CombatActionType } from "./game/types";
import type { ThresholdRule } from "./game/constants";
import type { RoomEventType } from "./game/types";

type Stage = "menu" | "character" | "explore" | "event" | "combat";

type SegmentedResourceProps = {
    icon: string;
    label: string;
    value: number;
    max: number;
    tone?: "hp" | "shield" | "enemy";
    threshold: ThresholdRule;
};

type IconStripResourceProps = {
    icon: string;
    label: string;
    value: number;
    unit: number;
    maxValue?: number;
    tone?: "coin" | "path" | "food";
    threshold: ThresholdRule;
};

const calcLevelClass = (ratio: number, threshold: ThresholdRule): string => {
    if (threshold.warning === THRESHOLD_DISABLED || threshold.critical === THRESHOLD_DISABLED) {
        return "";
    }
    const warning = Math.max(0, Math.min(1, threshold.warning));
    const critical = Math.max(0, Math.min(1, threshold.critical));
    if (ratio <= critical) return "is-critical";
    if (ratio <= warning) return "is-warning";
    return "is-safe";
};

function useDeltaClass(value: number): "" | "delta-up" | "delta-down" {
    const prevRef = useRef(value);
    const [deltaClass, setDeltaClass] = useState<"" | "delta-up" | "delta-down">("");

    useEffect(() => {
        if (value === prevRef.current) return;
        setDeltaClass(value > prevRef.current ? "delta-up" : "delta-down");
        const timer = window.setTimeout(() => setDeltaClass(""), 420);
        prevRef.current = value;
        return () => window.clearTimeout(timer);
    }, [value]);

    return deltaClass;
}

function SegmentedResource({ icon, label, value, max, tone = "hp", threshold }: SegmentedResourceProps): JSX.Element {
    const safeMax = Math.max(1, max);
    const clampedValue = Math.max(0, Math.min(value, safeMax));
    const fillRatio = clampedValue / safeMax;
    const segments = Math.min(20, Math.max(10, safeMax));
    const filledCount = Math.round(fillRatio * segments);
    const levelClass = calcLevelClass(fillRatio, threshold);
    const deltaClass = useDeltaClass(value);

    return (
        <div className={`resource resource-${tone} ${levelClass} ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        {icon}
                    </span>
                    {label}
                </span>
                <strong className="resource-value">
                    {Math.max(0, value)}/{safeMax}
                </strong>
            </div>
            <div className="segment-bar" role="img" aria-label={`${label} ${Math.max(0, value)} / ${safeMax}`}>
                {Array.from({ length: segments }, (_, idx) => (
                    <span key={`${label}-${idx}`} className={idx < filledCount ? "segment on" : "segment"} />
                ))}
            </div>
        </div>
    );
}

function IconStripResource({ icon, label, value, unit, maxValue, tone = "path", threshold }: IconStripResourceProps): JSX.Element {
    const safeUnit = Math.max(1, unit);
    const safeMax = Math.max(1, maxValue ?? value);
    const maxUnits = Math.min(20, Math.max(6, Math.ceil(safeMax / safeUnit)));
    const ratio = Math.max(0, Math.min(value, safeMax)) / safeMax;
    const capped = Math.round(ratio * maxUnits);
    const levelClass = calcLevelClass(ratio, threshold);
    const deltaClass = useDeltaClass(value);

    return (
        <div className={`resource resource-${tone} ${levelClass} ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        {icon}
                    </span>
                    {label}
                </span>
                <strong className="resource-value">
                    {value}/{safeMax}
                </strong>
            </div>
            <div className="icon-strip" role="img" aria-label={`${label} ${value} / ${safeMax}`}>
                {Array.from({ length: maxUnits }, (_, idx) => (
                    <span key={`${label}-icon-${idx}`} className={idx < capped ? "icon-node on" : "icon-node"} />
                ))}
            </div>
        </div>
    );
}

type XpCompositeResourceProps = {
    xp: number;
    xpMax: number;
    xpLevel: number;
};

function XpCompositeResource({ xp, xpMax, xpLevel }: XpCompositeResourceProps): JSX.Element {
    const safeXpMax = Math.max(1, xpMax);
    const safeXp = Math.max(0, Math.min(xp, safeXpMax));
    const xpRatio = safeXp / safeXpMax;

    const safeLevel = Math.max(1, xpLevel);
    const levelScaleMax = 5;
    const levelRatio = Math.max(0, Math.min(safeLevel, levelScaleMax)) / levelScaleMax;
    const xpSegments = 14;
    const levelSegments = levelScaleMax;
    const xpFilled = Math.round(xpRatio * xpSegments);
    const levelFilled = Math.round(levelRatio * levelSegments);

    const xpDelta = useDeltaClass(xp);
    const levelDelta = useDeltaClass(xpLevel);
    const deltaClass = xpDelta === "delta-down" || levelDelta === "delta-down" ? "delta-down" : xpDelta || levelDelta;

    return (
        <div className={`resource resource-xp ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        ✧
                    </span>
                    经验
                </span>
            </div>
            <div className="xp-composite" role="img" aria-label={`经验 XP ${safeXp} / ${safeXpMax}，等级 ${safeLevel} / ${levelScaleMax}`}>
                <div className="xp-lane xp-lane-thin">
                    <span className="xp-lane-tag">XP</span>
                    <div className="xp-segment-grid" style={{ gridTemplateColumns: `repeat(${xpSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: xpSegments }, (_, idx) => (
                            <span key={`xp-${idx}`} className={idx < xpFilled ? "xp-segment xp-segment-progress on" : "xp-segment xp-segment-progress"} />
                        ))}
                    </div>
                    <span className="xp-lane-value">
                        {safeXp}/{safeXpMax}
                    </span>
                </div>
                <div className="xp-lane xp-lane-thick">
                    <span className="xp-lane-tag">Lv</span>
                    <div className="xp-segment-grid" style={{ gridTemplateColumns: `repeat(${levelSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: levelSegments }, (_, idx) => (
                            <span key={`lv-${idx}`} className={idx < levelFilled ? "xp-segment xp-segment-level on" : "xp-segment xp-segment-level"} />
                        ))}
                    </div>
                    <span className="xp-lane-value">
                        {safeLevel}/{levelScaleMax}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function App(): JSX.Element {
    const [stage, setStage] = useState<Stage>("menu");
    const [tick, setTick] = useState(0);
    const [charOptions, setCharOptions] = useState<CharacterTuple[]>([]);
    const [hoveredChar, setHoveredChar] = useState<CharacterTuple | null>(null);
    const [activeEvent, setActiveEvent] = useState<RoomEventType | null>(null);

    const snapshot = gameState.snapshot;
    const previewChar = stage === "character" ? hoveredChar : null;
    const displayCharacter = previewChar ?? snapshot.player.character;
    const displayHp = previewChar ? previewChar[1] : snapshot.player.hp;
    const displayDefenseMax = previewChar ? previewChar[3] : snapshot.player.defenseMax;
    const displayDefense = previewChar ? previewChar[3] : snapshot.player.defense;
    const displayFood = previewChar ? previewChar[4] : snapshot.player.food;
    const displayCoin = previewChar ? previewChar[2] : snapshot.player.coin;
    const displayExtraAtk = previewChar ? previewChar[5] : snapshot.player.extraAtk;
    const displayScroll = previewChar ? (previewChar[0] === "盗贼" ? "随机卷轴" : "-") : snapshot.player.scroll ?? "-";
    const dangerLevel = useMemo(() => Math.min(5, snapshot.dungeon.floor), [snapshot.dungeon.floor, tick]);
    const playerHpMax = Math.max(displayCharacter?.[1] ?? 1, displayHp, 1);
    const defenseMax = Math.max(1, displayDefenseMax);
    const foodMax = Math.max(displayCharacter?.[4] ?? 1, displayFood, 1);
    const atkMin = snapshot.player.xpLevel;
    const atkMax = 2 * snapshot.player.xpLevel + 4;
    const monsterMax = snapshot.combat.monsterName
        ? Math.max(18 + snapshot.dungeon.floor * 4, snapshot.combat.monsterHp, 1)
        : 1;
    const coinMax = Math.max(20, displayCoin, 1);
    const floorMax = Math.max(FLOOR, snapshot.dungeon.floor, 1);
    const roomMax = Math.max(snapshot.dungeon.floor + ROOM_ADD, snapshot.dungeon.roomIdx, 1);
    const showFullMap = displayCharacter?.[0] === "术士";
    const currentFloorMap = gameState.getMapRoomsForFloor(snapshot.dungeon.floor, showFullMap);
    const nextFloor = Math.min(FLOOR, snapshot.dungeon.floor + 1);
    const nextFloorMap = gameState.getMapRoomsForFloor(nextFloor, showFullMap);
    const shopInventory = stage === "event" && activeEvent === "shop_event" ? gameState.getShopInventoryView() : null;

    const refresh = () => setTick((v) => v + 1);

    const finalizeRoomFlow = () => {
        gameState.processRoomConsequences();
        if (snapshot.player.hp <= 0) {
            gameState.addLog("你在房间结算后倒下，本轮结束");
            setActiveEvent(null);
            setStage("menu");
            return;
        }

        gameState.moveNextRoom();
        if (snapshot.dungeon.floor > FLOOR) {
            gameState.addLog("你击败了地牢终焉，获得鹰魂结晶！");
            setActiveEvent(null);
            setStage("menu");
            return;
        }

        setActiveEvent(null);
        setStage("explore");
    };

    const startNewRun = () => {
        gameState.reset();
        setCharOptions(gameState.getCharacterOptions());
        setHoveredChar(null);
        setActiveEvent(null);
        setStage("character");
        refresh();
    };

    const confirmCharacter = (index: number) => {
        gameState.pickCharacter(index);
        setHoveredChar(null);
        setActiveEvent(null);
        setStage("explore");
        refresh();
    };

    const enterRoom = () => {
        const evt = gameState.getCurrentRoomEvent();
        if (!evt) return;
        if (evt === "monster_event" || evt === "boss_event") {
            gameState.startRoomCombat(evt);
            setStage("combat");
        } else {
            setActiveEvent(evt as RoomEventType);
            setStage("event");
            gameState.addLog(`触发事件: ${gameState.getEventTitle(evt)}`);
        }
        refresh();
    };

    const executeRoomAction = (actionId: string) => {
        if (!activeEvent) return;
        const result = gameState.resolveRoomAction(activeEvent, actionId);

        if (result.combat) {
            gameState.startCombat(result.combat.monsterName, result.combat.hp, result.combat.atk, result.combat.isBoss);
            setStage("combat");
            refresh();
            return;
        }

        if (result.complete) {
            finalizeRoomFlow();
        }
        refresh();
    };

    const handleCombatAction = (actionType: CombatActionType) => {
        const result = gameState.performCombatAction(actionType);

        if (result.victory) {
            gameState.addLog(`击败 ${snapshot.combat.monsterName}`);
            gameState.finishCombat(true);
            finalizeRoomFlow();
        } else if (result.escaped) {
            gameState.finishCombat(false);
            finalizeRoomFlow();
        } else if (result.playerDied) {
            gameState.addLog("你已阵亡，本轮结束");
            gameState.finishCombat(false);
            setActiveEvent(null);
            setStage("menu");
        }
        refresh();
    };

    return (
        <main className="shell">
            <section className="left-panel">
                <header className="panel-title">地图面板</header>
                <div className="map-panel">
                    <div className="map-floor">
                        <div className="map-floor-title">当前层 F{snapshot.dungeon.floor}</div>
                        <div className="map-room-list">
                            {currentFloorMap.map((room) => (
                                <span
                                    key={room.key}
                                    className={`map-room ${room.revealed ? "is-revealed" : ""} ${room.isCurrent ? "is-current" : ""}`}
                                >
                                    {room.floor}-{room.index} {room.display}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="map-floor">
                        <div className="map-floor-title">下一层 F{nextFloor}</div>
                        <div className="map-room-list">
                            {nextFloorMap.map((room) => (
                                <span key={room.key} className={`map-room ${room.revealed ? "is-revealed" : ""}`}>
                                    {room.floor}-{room.index} {room.display}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <header className="panel-title">战斗/事件日志</header>
                <div className="log-box log-box-main">
                    {snapshot.logs.slice(-24).map((line, idx) => (
                        <div key={`${line}-${idx}`}>{line}</div>
                    ))}
                </div>
                <div className="actions">
                    {stage === "menu" && <button onClick={startNewRun}>开始冒险</button>}
                    {stage === "character" &&
                        charOptions.map((c, i) => (
                            <button
                                key={c[0]}
                                onClick={() => confirmCharacter(i)}
                                onMouseEnter={() => setHoveredChar(c)}
                                onMouseLeave={() => setHoveredChar(null)}
                                onFocus={() => setHoveredChar(c)}
                                onBlur={() => setHoveredChar(null)}
                            >
                                选择 {c[0]} / {c[6]}
                            </button>
                        ))}
                    {stage === "explore" && <button onClick={enterRoom}>进入房间</button>}
                    {stage === "event" &&
                        activeEvent &&
                        (activeEvent === "shop_event" && shopInventory ? (
                            <div className="shop-board">
                                <div className="shop-section">
                                    <div className="shop-title">买入</div>
                                    <div className="shop-list">
                                        {shopInventory.buy.map((action) => (
                                            <button
                                                key={action.id}
                                                onClick={() => executeRoomAction(action.id)}
                                                disabled={Boolean(action.disabledReason)}
                                                title={action.disabledReason}
                                            >
                                                {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="shop-section">
                                    <div className="shop-title">卖出</div>
                                    <div className="shop-list">
                                        {shopInventory.sell.map((action) => (
                                            <button
                                                key={action.id}
                                                onClick={() => executeRoomAction(action.id)}
                                                disabled={Boolean(action.disabledReason)}
                                                title={action.disabledReason}
                                            >
                                                {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={() => executeRoomAction("leave")}>离开商人</button>
                            </div>
                        ) : (
                            gameState.getRoomActions(activeEvent).map((action) => (
                                <button
                                    key={action.id}
                                    onClick={() => executeRoomAction(action.id)}
                                    disabled={Boolean(action.disabledReason)}
                                    title={action.disabledReason}
                                >
                                    {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                                </button>
                            ))
                        ))}
                    {stage === "combat" &&
                        gameState.getCombatActions().map((action) => (
                            <button
                                key={action.id}
                                onClick={() => handleCombatAction(action.id as CombatActionType)}
                                disabled={Boolean(action.disabledReason)}
                                title={action.disabledReason}
                            >
                                {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                            </button>
                        ))}
                </div>
            </section>

            <section className="right-panel">
                <header className="panel-title">状态面板</header>
                <div className="status-overview">
                    <div className="overview-chip">
                        <span>阶段</span>
                        <strong>{stage}</strong>
                    </div>
                    <div className="overview-chip">
                        <span>角色</span>
                        <strong>{displayCharacter?.[0] ?? "-"}</strong>
                    </div>
                    <div className="overview-chip">
                        <span>{previewChar ? "技能" : stage === "event" ? "事件" : "怪物"}</span>
                        <strong>
                            {previewChar
                                ? previewChar[6]
                                : stage === "event" && activeEvent
                                    ? gameState.getEventTitle(activeEvent)
                                    : snapshot.combat.monsterName || "-"}
                        </strong>
                    </div>
                    <div className="overview-chip">
                        <span>卷轴</span>
                        <strong>{displayScroll}</strong>
                    </div>
                    <div className="overview-chip">
                        <span>攻击</span>
                        <strong className="atk-line">
                            <span className="atk-main">[{atkMin}~{atkMax}]</span>
                            {displayExtraAtk > 0 ? <span className="atk-bonus">+{displayExtraAtk}</span> : ""}
                        </strong>
                    </div>
                </div>

                <div className="resource-stack">
                    <SegmentedResource
                        icon="❤"
                        label="生命"
                        value={displayHp}
                        max={playerHpMax}
                        tone="hp"
                        threshold={RESOURCE_THRESHOLD_RULES.hp}
                    />
                    <SegmentedResource
                        icon="🛡"
                        label="防御"
                        value={displayDefense}
                        max={defenseMax}
                        tone="shield"
                        threshold={RESOURCE_THRESHOLD_RULES.shield}
                    />
                    <IconStripResource
                        icon="🍖"
                        label="食物"
                        value={displayFood}
                        unit={1}
                        maxValue={foodMax}
                        tone="food"
                        threshold={RESOURCE_THRESHOLD_RULES.food}
                    />
                    <XpCompositeResource xp={snapshot.player.xp} xpMax={XP_MAX} xpLevel={snapshot.player.xpLevel} />
                    {stage === "combat" && (
                        <SegmentedResource
                            icon="☠"
                            label="怪物生命"
                            value={snapshot.combat.monsterHp || 0}
                            max={monsterMax}
                            tone="enemy"
                            threshold={RESOURCE_THRESHOLD_RULES.enemy}
                        />
                    )}
                    <IconStripResource
                        icon="🪙"
                        label="金币"
                        value={displayCoin}
                        unit={2}
                        maxValue={coinMax}
                        tone="coin"
                        threshold={RESOURCE_THRESHOLD_RULES.coin}
                    />
                    <IconStripResource
                        icon="🗺"
                        label="层数"
                        value={snapshot.dungeon.floor}
                        unit={1}
                        maxValue={floorMax}
                        tone="path"
                        threshold={RESOURCE_THRESHOLD_RULES.path}
                    />
                    <IconStripResource
                        icon="🚪"
                        label="房间"
                        value={snapshot.dungeon.roomIdx}
                        unit={1}
                        maxValue={roomMax}
                        tone="path"
                        threshold={RESOURCE_THRESHOLD_RULES.path}
                    />
                    {stage === "combat" && (
                        <IconStripResource
                            icon="✦"
                            label="技能点"
                            value={snapshot.combat.skillPoint}
                            unit={1}
                            maxValue={12}
                            tone="path"
                            threshold={RESOURCE_THRESHOLD_RULES.path}
                        />
                    )}
                </div>

                <header className="panel-title mt">战斗动画</header>
                <GameCanvas dangerLevel={dangerLevel} />
            </section>
        </main>
    );
}
