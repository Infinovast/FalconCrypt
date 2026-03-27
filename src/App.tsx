import { useEffect, useMemo, useRef, useState } from "react";
import { GameCanvas } from "./components/GameCanvas";
import {
    FLOOR,
    MONSTER_SEGMENT_MAX,
    RESOURCE_SEGMENT_MAX,
    RESOURCE_THRESHOLD_RULES,
    ROOM_ADD,
    THRESHOLD_DISABLED,
    XP_LEVEL_SEGMENT_MAX,
    XP_MAX,
    XP_PROGRESS_SEGMENT_MAX,
} from "./game/constants";
import { gameState } from "./game/state";
import type { ResourcePulseTone } from "./animations/combatAnimation";
import type { RoomIntroKind } from "./animations/roomAnimation";
import type { CharacterTuple, CombatActionType } from "./game/types";
import type { ThresholdRule } from "./game/constants";
import type { RoomEventType } from "./game/types";

type Stage = "menu" | "character" | "explore" | "event" | "combat";

type SegmentedResourceProps = {
    icon: string;
    label: string;
    value: number;
    max: number;
    segments?: number;
    tone?: "hp" | "shield" | "enemy";
    threshold: ThresholdRule;
};

type IconStripResourceProps = {
    icon: string;
    label: string;
    value: number;
    unit: number;
    maxValue?: number;
    segments?: number;
    tone?: "coin" | "path" | "food";
    threshold: ThresholdRule;
};

type LogCategory = "room" | "combat" | "resource" | "system";

type CategorizedLog = {
    id: string;
    text: string;
    category: LogCategory;
};

const LOG_SECTION_ORDER: LogCategory[] = ["room", "combat", "resource", "system"];

const LOG_SECTION_TITLES: Record<LogCategory, string> = {
    room: "房间",
    combat: "战斗",
    resource: "资源",
    system: "系统",
};

const ROOM_LOG_MARKERS = [
    "进入房间",
    "触发事件",
    "分支",
    "路线",
    "宝箱",
    "陷阱",
    "商人",
    "篝火",
    "铸锻",
    "雕像",
    "矿洞",
];

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

const RESOURCE_LOG_MARKERS = [
    "HP",
    "Coin",
    "Food",
    "Def",
    "XP",
    "ATK",
    "升级",
    "恢复",
    "损失",
    "伤害",
    "奖励",
    "卷轴",
];

const classifyLog = (line: string): LogCategory => {
    if (ROOM_LOG_MARKERS.some((marker) => line.includes(marker))) {
        return "room";
    }
    if (COMBAT_LOG_MARKERS.some((marker) => line.includes(marker))) {
        return "combat";
    }
    if (RESOURCE_LOG_MARKERS.some((marker) => line.includes(marker))) {
        return "resource";
    }
    return "system";
};

const calcScaledSegments = (cap: number, maxSegments = RESOURCE_SEGMENT_MAX): number => {
    const safeCap = Math.max(1, cap);
    return Math.min(maxSegments, Math.max(1, Math.ceil(safeCap)));
};

const buildLogBuckets = (logs: string[]): Record<LogCategory, CategorizedLog[]> => {
    const initial: Record<LogCategory, CategorizedLog[]> = {
        room: [],
        combat: [],
        resource: [],
        system: [],
    };

    logs.forEach((text, idx) => {
        const category = classifyLog(text);
        initial[category].push({
            id: `${idx}-${text}`,
            text,
            category,
        });
    });

    LOG_SECTION_ORDER.forEach((key) => {
        initial[key] = initial[key].slice(-10).reverse();
    });

    return initial;
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

const DISABLED_THRESHOLD_RULE: ThresholdRule = {
    warning: THRESHOLD_DISABLED,
    critical: THRESHOLD_DISABLED,
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

function SegmentedResource({ icon, label, value, max, segments, tone = "hp", threshold }: SegmentedResourceProps): JSX.Element {
    const safeMax = Math.max(1, max);
    const clampedValue = Math.max(0, Math.min(value, safeMax));
    const fillRatio = clampedValue / safeMax;
    const segmentCount = Math.min(RESOURCE_SEGMENT_MAX, Math.max(1, Math.floor(segments ?? safeMax)));
    const filledCount = Math.round(fillRatio * segmentCount);
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
            <div
                className="segment-bar"
                role="img"
                aria-label={`${label} ${Math.max(0, value)} / ${safeMax}`}
                style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: segmentCount }, (_, idx) => (
                    <span key={`${label}-${idx}`} className={idx < filledCount ? "segment on" : "segment"} />
                ))}
            </div>
        </div>
    );
}

function IconStripResource({ icon, label, value, unit, maxValue, segments, tone = "path", threshold }: IconStripResourceProps): JSX.Element {
    const safeUnit = Math.max(1, unit);
    const safeMax = Math.max(1, maxValue ?? value);
    const maxUnits = Math.min(RESOURCE_SEGMENT_MAX, Math.max(1, Math.ceil(segments ?? safeMax / safeUnit)));
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

type MonsterCompositeResourceProps = {
    hp: number;
    hpMax: number;
    atk: number;
    atkMax: number;
};

type ProgressCompositeResourceProps = {
    room: number;
    roomMax: number;
    floor: number;
    floorMax: number;
};

function XpCompositeResource({ xp, xpMax, xpLevel }: XpCompositeResourceProps): JSX.Element {
    const safeXpMax = Math.max(1, xpMax);
    const safeXp = Math.max(0, Math.min(xp, safeXpMax));
    const xpRatio = safeXp / safeXpMax;

    const safeLevel = Math.max(1, xpLevel);
    const levelScaleMax = XP_LEVEL_SEGMENT_MAX;
    const levelRatio = Math.max(0, Math.min(safeLevel, levelScaleMax)) / levelScaleMax;
    const xpSegments = XP_PROGRESS_SEGMENT_MAX;
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

function MonsterCompositeResource({ hp, hpMax, atk, atkMax }: MonsterCompositeResourceProps): JSX.Element {
    const safeHpMax = Math.max(1, hpMax);
    const safeAtkMax = Math.max(1, atkMax);
    const clampedHp = Math.max(0, Math.min(hp, safeHpMax));
    const clampedAtk = Math.max(0, Math.min(atk, safeAtkMax));
    const segments = MONSTER_SEGMENT_MAX;
    const hpFilled = Math.round((clampedHp / safeHpMax) * segments);
    const atkFilled = Math.round((clampedAtk / safeAtkMax) * segments);

    const hpDelta = useDeltaClass(hp);
    const atkDelta = useDeltaClass(atk);
    const deltaClass = hpDelta === "delta-down" || atkDelta === "delta-down" ? "delta-down" : hpDelta || atkDelta;

    return (
        <div className={`resource resource-monster ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        ☠
                    </span>
                    怪物
                </span>
            </div>
            <div className="monster-composite" role="img" aria-label={`怪物生命 ${clampedHp} / ${safeHpMax}，攻击 ${clampedAtk} / ${safeAtkMax}`}>
                <div className="monster-row">
                    <span className="monster-tag">生命</span>
                    <div className="monster-segment-bar">
                        {Array.from({ length: segments }, (_, idx) => (
                            <span
                                key={`monster-hp-${idx}`}
                                className={idx < hpFilled ? "segment monster-segment-hp on" : "segment monster-segment-hp"}
                            />
                        ))}
                    </div>
                    <span className="monster-value">
                        {clampedHp}/{safeHpMax}
                    </span>
                </div>
                <div className="monster-row">
                    <span className="monster-tag">ATK</span>
                    <div className="monster-segment-bar">
                        {Array.from({ length: segments }, (_, idx) => (
                            <span
                                key={`monster-atk-${idx}`}
                                className={idx < atkFilled ? "segment monster-segment-atk on" : "segment monster-segment-atk"}
                            />
                        ))}
                    </div>
                    <span className="monster-value">
                        {clampedAtk}/{safeAtkMax}
                    </span>
                </div>
            </div>
        </div>
    );
}

function ProgressCompositeResource({ room, roomMax, floor, floorMax }: ProgressCompositeResourceProps): JSX.Element {
    const safeRoomMax = Math.max(1, roomMax);
    const safeFloorMax = Math.max(1, floorMax);
    const clampedRoom = Math.max(0, Math.min(room, safeRoomMax));
    const clampedFloor = Math.max(0, Math.min(floor, safeFloorMax));

    const roomSegments = safeRoomMax;
    const floorSegments = safeFloorMax;
    const roomFilled = Math.round((clampedRoom / safeRoomMax) * roomSegments);
    const floorFilled = Math.round((clampedFloor / safeFloorMax) * floorSegments);

    const roomDelta = useDeltaClass(room);
    const floorDelta = useDeltaClass(floor);
    const deltaClass = roomDelta === "delta-down" || floorDelta === "delta-down" ? "delta-down" : roomDelta || floorDelta;

    return (
        <div className={`resource resource-progress ${deltaClass}`}>
            <div className="resource-head">
                <span className="resource-label">
                    <span className="resource-icon" aria-hidden="true">
                        🧭
                    </span>
                    进度
                </span>
            </div>
            <div className="progress-composite" role="img" aria-label={`房间 ${clampedRoom} / ${safeRoomMax}，层数 ${clampedFloor} / ${safeFloorMax}`}>
                <div className="progress-row progress-row-thin">
                    <span className="progress-tag">房间</span>
                    <div className="progress-segment-grid" style={{ gridTemplateColumns: `repeat(${roomSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: roomSegments }, (_, idx) => (
                            <span
                                key={`progress-room-${idx}`}
                                className={idx < roomFilled ? "progress-segment progress-segment-room on" : "progress-segment progress-segment-room"}
                            />
                        ))}
                    </div>
                    <span className="progress-value">
                        {clampedRoom}/{safeRoomMax}
                    </span>
                </div>

                <div className="progress-row progress-row-thick">
                    <span className="progress-tag">层数</span>
                    <div className="progress-segment-grid" style={{ gridTemplateColumns: `repeat(${floorSegments}, minmax(0, 1fr))` }}>
                        {Array.from({ length: floorSegments }, (_, idx) => (
                            <span
                                key={`progress-floor-${idx}`}
                                className={idx < floorFilled ? "progress-segment progress-segment-floor on" : "progress-segment progress-segment-floor"}
                            />
                        ))}
                    </div>
                    <span className="progress-value">
                        {clampedFloor}/{safeFloorMax}
                    </span>
                </div>
            </div>
        </div>
    );
}

export function App(): JSX.Element {
    const [stage, setStage] = useState<Stage>("menu");
    const [tick, setTick] = useState(0);
    const [combatIntroTriggerKey, setCombatIntroTriggerKey] = useState(0);
    const [combatActionTriggerKey, setCombatActionTriggerKey] = useState(0);
    const [combatActionType, setCombatActionType] = useState<CombatActionType>("attack");
    const [roomIntroTriggerKey, setRoomIntroTriggerKey] = useState(0);
    const [roomIntroType, setRoomIntroType] = useState<RoomIntroKind>("branch_event");
    const [resourcePulseTriggerKey, setResourcePulseTriggerKey] = useState(0);
    const [resourcePulseTone, setResourcePulseTone] = useState<ResourcePulseTone>("gain");
    const [resourcePulsePower, setResourcePulsePower] = useState(0.55);
    const [charOptions, setCharOptions] = useState<CharacterTuple[]>([]);
    const [hoveredChar, setHoveredChar] = useState<CharacterTuple | null>(null);
    const [activeEvent, setActiveEvent] = useState<RoomEventType | null>(null);
    const [activeRoomKey, setActiveRoomKey] = useState<string | null>(null);
    const [buttonsAnimating, setButtonsAnimating] = useState(false);
    const hpPeakRef = useRef(1);
    const foodPeakRef = useRef(1);
    const coinPeakRef = useRef(1);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const actionAnimTimerRef = useRef<number | null>(null);
    const prevStageRef = useRef<Stage>("menu");

    const snapshot = gameState.snapshot;
    const resourceSnapshotRef = useRef({
        hp: snapshot.player.hp,
        defense: snapshot.player.defense,
        food: snapshot.player.food,
        coin: snapshot.player.coin,
        xp: snapshot.player.xp,
    });
    const previewChar = stage === "character" ? hoveredChar : null;
    const displayCharacter = previewChar ?? snapshot.player.character;
    const displayHp = previewChar ? previewChar[1] : snapshot.player.hp;
    const displayDefense = previewChar ? previewChar[3] : snapshot.player.defense;
    const displayFood = previewChar ? previewChar[4] : snapshot.player.food;
    const displayCoin = previewChar ? previewChar[2] : snapshot.player.coin;
    const combatTempExtraAtk = !previewChar && stage === "combat" ? snapshot.combat.tempExtraAtk : 0;
    const displayExtraAtk = previewChar ? previewChar[5] : snapshot.player.extraAtk + combatTempExtraAtk;
    const hasTempExtraAtkInDisplay =
        !previewChar &&
        stage === "combat" &&
        snapshot.combat.tempExtraAtk !== 0 &&
        displayExtraAtk > 0;

    useEffect(() => {
        if (stage === "character") return;
        hpPeakRef.current = Math.max(hpPeakRef.current, snapshot.player.hp);
        foodPeakRef.current = Math.max(foodPeakRef.current, snapshot.player.food);
        coinPeakRef.current = Math.max(coinPeakRef.current, snapshot.player.coin);
    }, [snapshot.player.hp, snapshot.player.food, snapshot.player.coin, stage]);

    const hpHistoryCap = previewChar ? Math.max(1, previewChar[1]) : Math.max(1, hpPeakRef.current, snapshot.player.hp);
    const defHistoryCap = previewChar ? Math.max(1, previewChar[3]) : Math.max(1, snapshot.player.defenseMax);
    const foodHistoryCap = previewChar ? Math.max(1, previewChar[4]) : Math.max(1, foodPeakRef.current, snapshot.player.food);
    const coinHistoryCap = previewChar ? Math.max(1, previewChar[2]) : Math.max(1, coinPeakRef.current, snapshot.player.coin);

    const hpSegments = calcScaledSegments(hpHistoryCap);
    const defSegments = calcScaledSegments(defHistoryCap);
    const foodSegments = calcScaledSegments(foodHistoryCap);
    const coinSegments = calcScaledSegments(coinHistoryCap);

    const pendingScroll = snapshot.player.pendingScroll;
    const displayScroll = previewChar
        ? previewChar[0] === "盗贼"
            ? "随机卷轴"
            : "-"
        : pendingScroll
            ? `${snapshot.player.scroll ?? "-"} (待替换 ${pendingScroll})`
            : snapshot.player.scroll ?? "-";
    const dangerLevel = useMemo(() => Math.min(5, snapshot.dungeon.floor), [snapshot.dungeon.floor, tick]);
    const playerHpMax = hpHistoryCap;
    const defenseMax = defHistoryCap;
    const foodMax = foodHistoryCap;
    const atkMin = snapshot.player.xpLevel;
    const atkMax = 2 * snapshot.player.xpLevel + 4;
    const monsterMax = snapshot.combat.monsterName
        ? Math.max(18 + snapshot.dungeon.floor * 4, snapshot.combat.monsterHp, 1)
        : 1;
    const monsterAtkMax = snapshot.combat.monsterName
        ? Math.max(snapshot.dungeon.floor + 6, snapshot.combat.monsterAtk, 1)
        : 1;
    const coinMax = coinHistoryCap;
    const floorMax = Math.max(FLOOR, snapshot.dungeon.floor, 1);
    const currentFloorRoomCount = snapshot.dungeon.floor + ROOM_ADD;
    const roomMax = Math.max(snapshot.dungeon.floor + ROOM_ADD, snapshot.dungeon.roomIdx, 1);
    const exploreEnterLabel =
        snapshot.dungeon.roomIdx === 1
            ? "进入房间"
            : snapshot.dungeon.roomIdx === currentFloorRoomCount
                ? "开启Boss房"
                : "下个房间";
    const showFullMap = displayCharacter?.[0] === "术士";
    const currentFloorMap = gameState.getMapRoomsForFloor(snapshot.dungeon.floor, showFullMap);
    const nextFloor = Math.min(FLOOR, snapshot.dungeon.floor + 1);
    const nextFloorMap = gameState.getMapRoomsForFloor(nextFloor, showFullMap);
    const shopInventory = stage === "event" && activeEvent === "shop_event" ? gameState.getShopInventoryView() : null;
    const logBuckets = buildLogBuckets(snapshot.logs.slice(-48));
    const thresholdRule = (rule: ThresholdRule): ThresholdRule => (stage === "menu" ? DISABLED_THRESHOLD_RULE : rule);

    const refresh = () => setTick((v) => v + 1);

    useEffect(() => {
        return () => {
            if (actionAnimTimerRef.current !== null) {
                window.clearTimeout(actionAnimTimerRef.current);
                actionAnimTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (prevStageRef.current !== "combat" && stage === "combat") {
            setCombatIntroTriggerKey((key) => key + 1);
        }
        prevStageRef.current = stage;
    }, [stage]);

    useEffect(() => {
        if (stage === "menu" || stage === "character") {
            resourceSnapshotRef.current = {
                hp: snapshot.player.hp,
                defense: snapshot.player.defense,
                food: snapshot.player.food,
                coin: snapshot.player.coin,
                xp: snapshot.player.xp,
            };
            return;
        }

        const prev = resourceSnapshotRef.current;
        const next = {
            hp: snapshot.player.hp,
            defense: snapshot.player.defense,
            food: snapshot.player.food,
            coin: snapshot.player.coin,
            xp: snapshot.player.xp,
        };

        const deltas = [
            next.hp - prev.hp,
            next.defense - prev.defense,
            next.food - prev.food,
            next.coin - prev.coin,
            next.xp - prev.xp,
        ];
        const positive = deltas.filter((v) => v > 0).reduce((sum, v) => sum + v, 0);
        const negative = deltas.filter((v) => v < 0).reduce((sum, v) => sum + Math.abs(v), 0);
        const totalAbs = deltas.reduce((sum, v) => sum + Math.abs(v), 0);

        if (totalAbs > 0) {
            const tone: ResourcePulseTone = positive > 0 && negative > 0 ? "mixed" : positive > 0 ? "gain" : "loss";
            const power = Math.min(1, 0.26 + totalAbs / 20);
            setResourcePulseTone(tone);
            setResourcePulsePower(power);
            setResourcePulseTriggerKey((key) => key + 1);
        }

        resourceSnapshotRef.current = next;
    }, [snapshot.player.hp, snapshot.player.defense, snapshot.player.food, snapshot.player.coin, snapshot.player.xp, stage]);

    const runActionWithButtonAnimation = (clickedActionId: string, action: () => void) => {
        if (buttonsAnimating) return;

        const root = actionsRef.current;
        const allButtons = root ? Array.from(root.querySelectorAll<HTMLButtonElement>("button")) : [];
        if (allButtons.length === 0) {
            action();
            return;
        }

        setButtonsAnimating(true);
        allButtons.forEach((btn) => {
            const isClicked = btn.dataset.actionId === clickedActionId;
            if (btn.disabled || isClicked) {
                btn.classList.add("btn-exit-fade");
            } else {
                btn.classList.add("btn-exit-fall");
            }
        });

        actionAnimTimerRef.current = window.setTimeout(() => {
            action();
            setButtonsAnimating(false);
            window.requestAnimationFrame(() => {
                const latestButtons = actionsRef.current ? Array.from(actionsRef.current.querySelectorAll<HTMLButtonElement>("button")) : [];
                latestButtons.forEach((btn) => {
                    btn.classList.remove("btn-exit-fade", "btn-exit-fall");
                });
            });
            actionAnimTimerRef.current = null;
        }, 260);
    };

    const triggerAction = (actionId: string, action: () => void, withExitAnimation = true) => {
        if (withExitAnimation) {
            runActionWithButtonAnimation(actionId, action);
            return;
        }
        if (buttonsAnimating) return;
        action();
    };

    const finalizeRoomFlow = () => {
        if (!activeRoomKey) {
            return;
        }

        const result = gameState.finalizeCurrentRoom(activeRoomKey);
        if (result.ignored) {
            refresh();
            return;
        }

        if (result.playerDied) {
            gameState.addLog("你在房间结算后倒下，本轮结束");
            setActiveRoomKey(null);
            setActiveEvent(null);
            setStage("menu");
            return;
        }

        if (result.dungeonCleared) {
            gameState.addLog("你击败了地牢终焉，获得鹰魂结晶！");
            setActiveRoomKey(null);
            setActiveEvent(null);
            setStage("menu");
            return;
        }

        setActiveRoomKey(null);
        setActiveEvent(null);
        setStage("explore");
    };

    const startNewRun = () => {
        gameState.reset();
        setCharOptions(gameState.getCharacterOptions());
        gameState.addLog("提示：鼠标悬停在角色按钮上可预览角色信息");
        hpPeakRef.current = 1;
        foodPeakRef.current = 1;
        coinPeakRef.current = 1;
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setStage("character");
        refresh();
    };

    const confirmCharacter = (index: number) => {
        const selected = charOptions[index];
        if (selected) {
            hpPeakRef.current = Math.max(1, selected[1]);
            foodPeakRef.current = Math.max(1, selected[4]);
            coinPeakRef.current = Math.max(1, selected[2]);
        }
        gameState.pickCharacter(index);
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setStage("explore");
        refresh();
    };

    const enterRoom = () => {
        const roomKey = `${snapshot.dungeon.floor}-${snapshot.dungeon.roomIdx}`;
        gameState.clearLogs();
        const evt = gameState.getCurrentRoomEvent();
        if (!evt) return;
        const introType = evt as RoomEventType;
        setRoomIntroType(introType);
        setRoomIntroTriggerKey((key) => key + 1);
        setActiveRoomKey(roomKey);
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

        if (result.nextEventType) {
            if (result.nextEventType === "monster_event" || result.nextEventType === "boss_event") {
                gameState.startRoomCombat(result.nextEventType);
                setStage("combat");
            } else {
                setActiveEvent(result.nextEventType);
                gameState.addLog(`分支落点: ${gameState.getEventTitle(result.nextEventType)}`);
            }
            refresh();
            return;
        }

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
        setCombatActionType(actionType);
        setCombatActionTriggerKey((key) => key + 1);
        if (actionType === "attack" || actionType === "critical") {
            gameState.clearCombatLogs();
        }
        const result = gameState.performCombatAction(actionType);

        if (result.victory) {
            gameState.addLog(`击败 ${snapshot.combat.monsterName}`);
            gameState.finishCombat(true);
            finalizeRoomFlow();
        } else if (result.escaped) {
            gameState.finishCombat(false);
            finalizeRoomFlow();
        } else if (result.playerDied) {
            gameState.addLog("你已阵亡，本次游戏结束");
            gameState.finishCombat(false);
            setActiveEvent(null);
            setStage("menu");
        }
        refresh();
    };

    const resolvePendingScroll = (accept: boolean) => {
        gameState.resolveScrollReplacement(accept);
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
                                <div key={room.key} className="map-room-node">
                                    <span
                                        className={`map-room ${room.revealed ? "is-revealed" : ""} ${room.isCurrent ? "is-current" : ""} ${room.reorderedByBranch ? "is-reordered" : ""}`}
                                    >
                                        {room.floor}-{room.index} {room.display}
                                    </span>
                                    {room.chosenBranchName && (
                                        <>
                                            <span className="map-branch-link" aria-hidden="true" />
                                            <span className="map-room map-room-branch is-revealed">{room.chosenBranchName}</span>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="map-floor">
                        <div className="map-floor-title">下一层 F{nextFloor}</div>
                        <div className="map-room-list">
                            {nextFloorMap.map((room) => (
                                <div key={room.key} className="map-room-node">
                                    <span className={`map-room ${room.revealed ? "is-revealed" : ""} ${room.reorderedByBranch ? "is-reordered" : ""}`}>
                                        {room.floor}-{room.index} {room.display}
                                    </span>
                                    {room.chosenBranchName && (
                                        <>
                                            <span className="map-branch-link" aria-hidden="true" />
                                            <span className="map-room map-room-branch is-revealed">{room.chosenBranchName}</span>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <header className="panel-title">日志</header>
                <div className="log-grid" aria-label="按类别分组日志">
                    {LOG_SECTION_ORDER.map((section) => (
                        <section key={section} className={`log-lane log-lane-${section}`}>
                            <header className="log-lane-head">
                                <span className="log-lane-title">{LOG_SECTION_TITLES[section]}</span>
                                <span className="log-lane-count">{logBuckets[section].length}</span>
                            </header>
                            <div className="log-lane-list">
                                {logBuckets[section].length === 0 ? (
                                    <div className="log-empty">暂无</div>
                                ) : (
                                    logBuckets[section].map((entry) => (
                                        <div key={entry.id} className={`log-entry log-entry-${entry.category}`}>
                                            {entry.text}
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    ))}
                </div>
                <div className="actions" ref={actionsRef}>
                    {pendingScroll ? (
                        <>
                            <button data-action-id="pending-scroll-accept" onClick={() => triggerAction("pending-scroll-accept", () => resolvePendingScroll(true))}>
                                替换为 {pendingScroll}
                            </button>
                            <button data-action-id="pending-scroll-keep" onClick={() => triggerAction("pending-scroll-keep", () => resolvePendingScroll(false))}>
                                保留当前卷轴
                            </button>
                        </>
                    ) : (
                        <>
                            {stage === "menu" && (
                                <button data-action-id="start-new-run" onClick={() => triggerAction("start-new-run", startNewRun)}>
                                    开始冒险
                                </button>
                            )}
                            {stage === "character" &&
                                charOptions.map((c, i) => (
                                    <button
                                        key={c[0]}
                                        data-action-id={`character-${i}`}
                                        onClick={() => triggerAction(`character-${i}`, () => confirmCharacter(i))}
                                        onMouseEnter={() => setHoveredChar(c)}
                                        onMouseLeave={() => setHoveredChar(null)}
                                        onFocus={() => setHoveredChar(c)}
                                        onBlur={() => setHoveredChar(null)}
                                    >
                                        选择 {c[0]} / {c[6]}
                                    </button>
                                ))}
                            {stage === "explore" && (
                                <button data-action-id="enter-room" onClick={() => triggerAction("enter-room", enterRoom)}>
                                    {exploreEnterLabel}
                                </button>
                            )}
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
                                                        data-action-id={action.id}
                                                        onClick={() => triggerAction(action.id, () => executeRoomAction(action.id), false)}
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
                                                        data-action-id={action.id}
                                                        onClick={() => triggerAction(action.id, () => executeRoomAction(action.id), false)}
                                                        disabled={Boolean(action.disabledReason)}
                                                        title={action.disabledReason}
                                                    >
                                                        {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button data-action-id="shop-leave" onClick={() => triggerAction("shop-leave", () => executeRoomAction("leave"))}>
                                            离开商人
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {activeEvent === "mine_event" && (
                                            <div className="event-tip">提示：本房间只要执行过挖掘，离开后将跳过通用房间结算。</div>
                                        )}
                                        {gameState.getRoomActions(activeEvent).map((action) => (
                                            <button
                                                key={action.id}
                                                data-action-id={action.id}
                                                onClick={() => triggerAction(action.id, () => executeRoomAction(action.id))}
                                                disabled={Boolean(action.disabledReason)}
                                                title={action.disabledReason}
                                            >
                                                {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                                            </button>
                                        ))}
                                    </>
                                ))}
                            {stage === "combat" &&
                                gameState.getCombatActions().map((action) => (
                                    <button
                                        key={action.id}
                                        data-action-id={action.id}
                                        onClick={() => triggerAction(action.id, () => handleCombatAction(action.id as CombatActionType), false)}
                                        disabled={Boolean(action.disabledReason)}
                                        title={action.disabledReason}
                                    >
                                        {action.disabledReason ? `${action.label} (${action.disabledReason})` : action.label}
                                    </button>
                                ))}
                        </>
                    )}
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
                            {displayExtraAtk > 0 ? (
                                <span className={`atk-bonus ${hasTempExtraAtkInDisplay ? "atk-bonus-temp" : ""}`}>+{displayExtraAtk}</span>
                            ) : (
                                ""
                            )}
                        </strong>
                    </div>
                </div>

                <div className="resource-stack">
                    <SegmentedResource
                        icon="❤"
                        label="生命"
                        value={displayHp}
                        max={playerHpMax}
                        segments={hpSegments}
                        tone="hp"
                        threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.hp)}
                    />
                    <SegmentedResource
                        icon="🛡"
                        label="护甲"
                        value={displayDefense}
                        max={defenseMax}
                        segments={defSegments}
                        tone="shield"
                        threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.shield)}
                    />
                    {stage === "combat" && (
                        <IconStripResource
                            icon="✦"
                            label="技能点"
                            value={snapshot.combat.skillPoint}
                            unit={1}
                            maxValue={12}
                            tone="path"
                            threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.path)}
                        />
                    )}
                    <IconStripResource
                        icon="🍖"
                        label="食物"
                        value={displayFood}
                        unit={1}
                        maxValue={foodMax}
                        segments={foodSegments}
                        tone="food"
                        threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.food)}
                    />
                    <IconStripResource
                        icon="🪙"
                        label="金币"
                        value={displayCoin}
                        unit={1}
                        maxValue={coinMax}
                        segments={coinSegments}
                        tone="coin"
                        threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.coin)}
                    />
                    {stage === "combat" && (
                        <MonsterCompositeResource
                            hp={snapshot.combat.monsterHp || 0}
                            hpMax={monsterMax}
                            atk={snapshot.combat.monsterAtk || 0}
                            atkMax={monsterAtkMax}
                        />
                    )}
                    <XpCompositeResource xp={snapshot.player.xp} xpMax={XP_MAX} xpLevel={snapshot.player.xpLevel} />
                    <ProgressCompositeResource room={snapshot.dungeon.roomIdx} roomMax={roomMax} floor={snapshot.dungeon.floor} floorMax={floorMax} />
                </div>

                <header className="panel-title mt">动画</header>
                <GameCanvas
                    dangerLevel={dangerLevel}
                    combatIntroTriggerKey={combatIntroTriggerKey}
                    combatActionTriggerKey={combatActionTriggerKey}
                    combatActionType={combatActionType}
                    roomIntroTriggerKey={roomIntroTriggerKey}
                    roomIntroType={roomIntroType}
                    resourcePulseTriggerKey={resourcePulseTriggerKey}
                    resourcePulseTone={resourcePulseTone}
                    resourcePulsePower={resourcePulsePower}
                />
            </section>
        </main>
    );
}
