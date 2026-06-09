import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ActionPanel } from "./components/ActionPanel";
import { DeveloperPanel } from "./components/DeveloperPanel";
import type { DeveloperControl } from "./components/DeveloperPanel";
import { GameCanvas } from "./components/GameCanvas";
import { StatusSidebar } from "./components/StatusSidebar";
import {
    CRITICAL_TOOLTIP,
    FLOOR,
    ROOM_RANGES,
    ROOM_ADD,
    SCROLL_INFO,
    SKILL_SP_COST,
    STATUE_ACTION_TOOLTIPS,
    TRAP_ACTION_TOOLTIPS,
    XP_MAX,
} from "./game/constants";
import { gameState } from "./game/state";
import type { DeveloperScalarField } from "./game/state";
import type { CombatActionKind, ResourcePulseTone } from "./animations/combatAnimation";
import type { RoomIntroKind } from "./animations/roomAnimation";
import type { CharacterTuple, CombatActionType, RoomAction } from "./game/types";
import type { ThresholdRule } from "./game/constants";
import type { RoomEventType } from "./game/types";
import {
    addDeltaRange,
    applyActionBadgesToRanges,
    applySpendPreviewAsNegativeRanges,
    buildGainPreviewFromRanges,
    buildLogTimeline,
    calcDangerIndex,
    calcScaledSegments,
    DISABLED_THRESHOLD_RULE,
    getCharacterSkillHint,
    getChestRewardValueById,
    getShopBuyValueById,
    hasGainPreview,
    hasSpendPreview,
    isKnownScroll,
    mergeSpendPreview,
    mergeSpendPreviewFromBadge,
} from "./game/uiHelpers";
import type { ResourceDeltaRanges, ResourceGainPreview, ResourceSpendPreview, Stage, TooltipHint } from "./game/uiHelpers";

type VictoryFxShard = {
    left: string;
    delay: string;
    duration: string;
    drift: string;
    size: string;
    hue: string;
};

type VictoryShardStyle = CSSProperties & {
    "--victory-drift": string;
    "--victory-hue": string;
};

type LogTimelineGroupItem = {
    entry: ReturnType<typeof buildLogTimeline>[number];
    groupIndex: number;
    opacity: number;
};

const VICTORY_SHARDS: VictoryFxShard[] = [
    { left: "6%", delay: "0ms", duration: "3400ms", drift: "-42px", size: "10px", hue: "190" },
    { left: "14%", delay: "180ms", duration: "3000ms", drift: "28px", size: "14px", hue: "38" },
    { left: "22%", delay: "520ms", duration: "3600ms", drift: "-18px", size: "8px", hue: "158" },
    { left: "31%", delay: "110ms", duration: "3200ms", drift: "46px", size: "12px", hue: "332" },
    { left: "39%", delay: "760ms", duration: "3500ms", drift: "-34px", size: "9px", hue: "214" },
    { left: "48%", delay: "420ms", duration: "3100ms", drift: "24px", size: "16px", hue: "52" },
    { left: "57%", delay: "940ms", duration: "3700ms", drift: "-26px", size: "11px", hue: "174" },
    { left: "65%", delay: "260ms", duration: "3300ms", drift: "36px", size: "13px", hue: "286" },
    { left: "74%", delay: "680ms", duration: "3450ms", drift: "-22px", size: "10px", hue: "24" },
    { left: "83%", delay: "360ms", duration: "3050ms", drift: "31px", size: "15px", hue: "198" },
    { left: "91%", delay: "840ms", duration: "3550ms", drift: "-38px", size: "9px", hue: "120" },
];

export function App(): JSX.Element {
    const developerPanelDefaultPosition = { x: 24, y: 24 };
    const [stage, setStage] = useState<Stage>("menu");
    const [, setTick] = useState(0);
    const [showWelcomeFx, setShowWelcomeFx] = useState(false);
    const [showVictoryFx, setShowVictoryFx] = useState(false);
    const [victoryFxKey, setVictoryFxKey] = useState(0);
    const [combatIntroTriggerKey, setCombatIntroTriggerKey] = useState(0);
    const [combatActionTriggerKey, setCombatActionTriggerKey] = useState(0);
    const [combatActionType, setCombatActionType] = useState<CombatActionKind>("attack");
    const [roomIntroTriggerKey, setRoomIntroTriggerKey] = useState(0);
    const [roomIntroType, setRoomIntroType] = useState<RoomIntroKind>("branch_event");
    const [resourcePulseTriggerKey, setResourcePulseTriggerKey] = useState(0);
    const [resourcePulseTone, setResourcePulseTone] = useState<ResourcePulseTone>("gain");
    const [resourcePulsePower, setResourcePulsePower] = useState(0.55);
    const [charOptions, setCharOptions] = useState<CharacterTuple[]>([]);
    const [hoveredChar, setHoveredChar] = useState<CharacterTuple | null>(null);
    const [activeEvent, setActiveEvent] = useState<RoomEventType | null>(null);
    const [activeRoomKey, setActiveRoomKey] = useState<string | null>(null);
    const [pendingBossBonusChest, setPendingBossBonusChest] = useState(false);
    const [eventAwaitingLeave, setEventAwaitingLeave] = useState(false);
    const [buttonsAnimating, setButtonsAnimating] = useState(false);
    const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
    const [developerPanelPosition, setDeveloperPanelPosition] = useState(developerPanelDefaultPosition);
    const [developerPanelDragging, setDeveloperPanelDragging] = useState(false);
    const [hoveredSpendPreview, setHoveredSpendPreview] = useState<ResourceSpendPreview | null>(null);
    const [hoveredGainPreview, setHoveredGainPreview] = useState<ResourceGainPreview | null>(null);
    const hpPeakRef = useRef(1);
    const foodPeakRef = useRef(1);
    const coinPeakRef = useRef(1);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const actionAnimTimerRef = useRef<number | null>(null);
    const welcomeFxTimerRef = useRef<number | null>(null);
    const victoryFxTimerRef = useRef<number | null>(null);
    const prevStageRef = useRef<Stage>("menu");
    const developerPanelRef = useRef<HTMLElement | null>(null);
    const developerPanelDragOffsetRef = useRef({ x: 0, y: 0 });

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
    const defHistoryCap = previewChar
        ? Math.max(1, previewChar[3])
        : Math.max(1, snapshot.player.defenseMax, snapshot.player.defense);
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
    const playerHpMax = hpHistoryCap;
    const defenseMax = Math.max(1, previewChar ? previewChar[3] : snapshot.player.defenseMax);
    const defenseDisplayValue = `${Math.max(0, displayDefense)}/${defenseMax}`;
    const armorEffectCount = Number(snapshot.player.hasThornsArmor) + Number(snapshot.player.hasHeavyArmor);
    const armorEffectStars = armorEffectCount > 0 ? (
        <span className="armor-effect-stars" aria-label={`护甲效果 ${armorEffectCount} 个`}>
            {Array.from({ length: armorEffectCount }, (_, idx) => (
                <span key={`armor-effect-${idx}`} className="armor-effect-star" aria-hidden="true" />
            ))}
        </span>
    ) : null;
    const foodMax = foodHistoryCap;
    const atkMin = snapshot.player.xpLevel;
    const atkMax = 2 * snapshot.player.xpLevel + 4;
    const monsterMax = snapshot.combat.monsterName
        ? Math.max(18 + snapshot.dungeon.floor * 4, snapshot.combat.monsterHp, 1)
        : 1;
    const effectiveMonsterAtk = snapshot.combat.monsterName
        ? Math.max(0, snapshot.combat.monsterAtk + snapshot.combat.tempMonsterAtkDelta)
        : 0;
    const monsterAtkMax = snapshot.combat.monsterName
        ? Math.max(snapshot.dungeon.floor + 6, snapshot.combat.monsterAtk, effectiveMonsterAtk, 1)
        : 1;
    const coinMax = coinHistoryCap;
    const floorMax = Math.max(FLOOR, snapshot.dungeon.floor, 1);
    const currentFloorRoomCount = snapshot.dungeon.floor + ROOM_ADD;
    const roomMax = Math.max(snapshot.dungeon.floor + ROOM_ADD, snapshot.dungeon.roomIdx, 1);
    const dangerLevel = useMemo(
        () =>
            calcDangerIndex({
                stage,
                floor: snapshot.dungeon.floor,
                room: snapshot.dungeon.roomIdx,
                hp: displayHp,
                defense: displayDefense,
                food: displayFood,
                combat: {
                    monsterName: snapshot.combat.monsterName,
                    monsterHp: snapshot.combat.monsterHp,
                    monsterAtk: effectiveMonsterAtk,
                    isBoss: snapshot.combat.isBoss,
                },
            }),
        [
            stage,
            snapshot.dungeon.floor,
            snapshot.dungeon.roomIdx,
            displayHp,
            displayDefense,
            displayFood,
            snapshot.combat.monsterName,
            snapshot.combat.monsterHp,
            effectiveMonsterAtk,
            snapshot.combat.isBoss,
        ]
    );
    const exploreEnterLabel =
        snapshot.dungeon.roomIdx === 1
            ? "进入房间"
            : snapshot.dungeon.roomIdx === currentFloorRoomCount
                ? "开启Boss房"
                : "下个房间";
    const showFullMap = displayCharacter?.[0] === "术士";
    const currentFloorMap = gameState.getMapRoomsForFloor(snapshot.dungeon.floor, showFullMap);
    const hasNextFloor = snapshot.dungeon.floor < FLOOR;
    const nextFloor = hasNextFloor ? snapshot.dungeon.floor + 1 : null;
    const nextFloorMap = hasNextFloor && nextFloor ? gameState.getMapRoomsForFloor(nextFloor, showFullMap) : [];
    const shopInventory = stage === "event" && activeEvent === "shop_event" ? gameState.getShopInventoryView() : null;
    const developerNextRoomType = gameState.getDeveloperNextRoomType();
    const developerNextRoomKey = gameState.getDeveloperNextRoomKey();
    const logTimeline = buildLogTimeline(snapshot.logs, 10);
    const logTimelineGroups = logTimeline.reduce<LogTimelineGroupItem[]>((items, entry, index) => {
        const previousEntry = index > 0 ? logTimeline[index - 1] : null;
        const previousGroupIndex = items[index - 1]?.groupIndex ?? 0;
        const groupIndex = previousEntry && entry.category === previousEntry.category ? previousGroupIndex : previousGroupIndex + (index === 0 ? 0 : 1);
        items.push({
            entry,
            groupIndex,
            opacity: Math.max(0.1, 1 - Math.min(groupIndex, 3) * 0.4),
        });
        return items;
    }, []);
    const thresholdRule = (rule: ThresholdRule): ThresholdRule => (stage === "menu" ? DISABLED_THRESHOLD_RULE : rule);

    const developerControls: DeveloperControl[] = [
        { key: "hp", label: "HP", value: snapshot.player.hp },
        { key: "defense", label: "Def", value: snapshot.player.defense },
        { key: "defenseMax", label: "Def Max", value: snapshot.player.defenseMax },
        { key: "food", label: "Food", value: snapshot.player.food },
        { key: "coin", label: "Coin", value: snapshot.player.coin },
        { key: "scroll", label: "卷轴", value: snapshot.player.scroll ? 1 : 0 },
        { key: "extraAtk", label: "ATK Extra", value: snapshot.player.extraAtk },
        { key: "xp", label: "XP", value: snapshot.player.xp },
        { key: "xpLevel", label: "Lv", value: snapshot.player.xpLevel },
        { key: "skillPoint", label: "SP", value: snapshot.combat.skillPoint, hidden: stage !== "combat" },
        { key: "monsterHp", label: "怪物 HP", value: snapshot.combat.monsterHp, hidden: stage !== "combat" },
        { key: "monsterAtk", label: "怪物 ATK", value: snapshot.combat.monsterAtk, hidden: stage !== "combat" },
        { key: "tempExtraAtk", label: "临时 ATK", value: snapshot.combat.tempExtraAtk, hidden: stage !== "combat" },
        { key: "tempMonsterAtkDelta", label: "临时怪攻差", value: snapshot.combat.tempMonsterAtkDelta, hidden: stage !== "combat" },
        { key: "roomIdx", label: "房间", value: snapshot.dungeon.roomIdx },
        { key: "floor", label: "层数", value: snapshot.dungeon.floor },
    ];

    const refresh = () => setTick((v) => v + 1);

    const currentStageLabel =
        stage === "menu"
            ? "待机"
            : stage === "character"
                ? "选角"
                : stage === "explore"
                    ? "探索"
                    : stage === "event"
                        ? "事件"
                        : stage === "combat"
                            ? "战斗"
                            : "终止";
    const currentFocusLabel = previewChar
        ? previewChar[6]
        : stage === "event" && activeEvent
            ? gameState.getEventTitle(activeEvent)
            : snapshot.combat.monsterName || "未锁定";
    const menuHeroStats = [
        { label: "地牢层数", value: `${FLOOR} 层` },
        { label: "房间事件", value: "多分支事件" },
        { label: "战斗风格", value: "文字策略" },
    ];
    const menuRoutePreview = [
        { label: "选角", detail: "确认职业手感" },
        { label: "B1-B3", detail: "预判路线和消耗" },
        { label: `B${FLOOR}`, detail: "面对终焉Boss" },
    ];
    const menuResourceFocus = [
        { label: "HP", text: "生命线", tone: "hp" },
        { label: "Food", text: "续航", tone: "food" },
        { label: "Coin", text: "商店", tone: "coin" },
        { label: "Scroll", text: "反转", tone: "scroll" },
    ];

    const adjustDeveloperScalar = (field: DeveloperScalarField, delta: number) => {
        gameState.adjustDeveloperScalar(field, delta);
        refresh();
    };

    const handleDeveloperWheel = (event: React.WheelEvent<HTMLElement>, field: DeveloperScalarField) => {
        event.preventDefault();
        event.stopPropagation();
        adjustDeveloperScalar(field, event.deltaY < 0 ? 1 : -1);
    };

    const handleDeveloperRoomTypeChange = (eventType: RoomEventType) => {
        gameState.setDeveloperNextRoomType(eventType);
        refresh();
    };

    const clearHoveredResourcePreview = () => {
        setHoveredSpendPreview(null);
        setHoveredGainPreview(null);
    };

    const renderActionTooltip = (hint: TooltipHint | null | undefined) => {
        if (!hint) {
            return null;
        }

        return (
            <span className="character-option-tip scroll-action-tip" aria-hidden="true">
                <span>{hint.title}</span>
                {hint.detail ? <span>{hint.detail}</span> : null}
            </span>
        );
    };

    const renderScrollTooltip = (scrollName: string | null | undefined) => {
        if (!isKnownScroll(scrollName)) {
            return null;
        }

        const tip = SCROLL_INFO[scrollName];
        return renderActionTooltip(tip);
    };

    const renderSkillTooltip = (character: CharacterTuple | null) => {
        const skillHint = getCharacterSkillHint(character);
        if (!skillHint) {
            return null;
        }

        return renderActionTooltip({ title: skillHint });
    };

    const renderCriticalTooltip = () => renderActionTooltip(CRITICAL_TOOLTIP);

    const renderTrapActionTooltip = (actionId: string) => {
        if (actionId !== "disarm" && actionId !== "rush") {
            return null;
        }

        const tip = TRAP_ACTION_TOOLTIPS[actionId];
        return renderActionTooltip(tip);
    };

    const renderStatueActionTooltip = (actionId: string) => {
        if (actionId !== "pray" && actionId !== "offer") {
            return null;
        }

        const tip = STATUE_ACTION_TOOLTIPS[actionId];
        return renderActionTooltip(tip);
    };

    const buildActionSpendPreview = (action: RoomAction): ResourceSpendPreview => {
        const preview: ResourceSpendPreview = {};
        const isLeaveAction = action.id === "leave-room" || action.id === "leave";

        action.costBadges?.forEach((badge) => {
            mergeSpendPreviewFromBadge(preview, badge);
        });

        if (stage === "event" && isLeaveAction) {
            if (snapshot.player.food > 0) {
                mergeSpendPreview(preview, "food", ROOM_RANGES.roomConsequence.foodCost);
            } else {
                mergeSpendPreview(preview, "hp", ROOM_RANGES.roomConsequence.hungerLossMin);
            }
        }

        if (action.id === "shop_sell_food") {
            mergeSpendPreview(preview, "food", ROOM_RANGES.shop.sell.food.foodCost);
        }
        if (action.id === "shop_sell_scroll" || action.id === "scroll") {
            mergeSpendPreview(preview, "scroll", 1);
        }
        if (action.id === "shop_sell_armor_shard") {
            mergeSpendPreview(preview, "defenseMax", ROOM_RANGES.shop.sell.armorShard.defMaxCost);
        }

        if (stage === "combat") {
            const role = snapshot.player.character?.[0];
            if (action.id === "critical") {
                mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.critical);
            }
            if (action.id === "skill") {
                if (role === "圣骑士") {
                    mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.paladin);
                    mergeSpendPreview(preview, "food", 1);
                }
                if (role === "祭司") {
                    mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.priest);
                    mergeSpendPreview(preview, "hp", 3);
                }
                if (role === "刺客") {
                    mergeSpendPreview(preview, "skillPoint", SKILL_SP_COST.assassin);
                }
            }
        }

        return preview;
    };

    const buildActionGainPreview = (action: RoomAction, spendPreview: ResourceSpendPreview): ResourceGainPreview => {
        const ranges: ResourceDeltaRanges = {};
        applySpendPreviewAsNegativeRanges(ranges, spendPreview);
        applyActionBadgesToRanges(ranges, action.rewardBadges);
        const isLeaveAction = action.id === "leave-room" || action.id === "leave";

        if (stage === "event" && isLeaveAction) {
            if (snapshot.player.food > 0) {
                addDeltaRange(ranges, "hp", ROOM_RANGES.roomConsequence.healMin, snapshot.dungeon.floor + 2);
            }
            if (snapshot.player.defense < snapshot.player.defenseMax) {
                addDeltaRange(ranges, "defense", ROOM_RANGES.roomConsequence.defenseRecover, ROOM_RANGES.roomConsequence.defenseRecover);
            }
        }

        if (stage === "event") {
            if (activeEvent === "shop_event") {
                if (action.id.startsWith("shop_buy_")) {
                    const itemId = action.id.replace("shop_buy_", "");
                    const value = getShopBuyValueById(itemId);

                    if (typeof value?.hp === "number") {
                        addDeltaRange(ranges, "hp", value.hp, value.hp);
                    }
                    if (value?.defense) {
                        addDeltaRange(ranges, "defense", value.defense.min, value.defense.max);
                    }
                    if (typeof value?.defenseMax === "number") {
                        addDeltaRange(ranges, "defenseMax", value.defenseMax, value.defenseMax);
                    }
                    if (value?.coin) {
                        addDeltaRange(ranges, "coin", value.coin.min, value.coin.max);
                    }
                    if (typeof value?.food === "number") {
                        addDeltaRange(ranges, "food", value.food, value.food);
                    }
                    if (typeof value?.extraAtk === "number") {
                        addDeltaRange(ranges, "extraAtk", value.extraAtk, value.extraAtk);
                    }
                }
                if (action.id === "shop_sell_armor_shard") {
                    addDeltaRange(ranges, "defenseMax", -ROOM_RANGES.shop.sell.armorShard.defMaxCost, -ROOM_RANGES.shop.sell.armorShard.defMaxCost);
                    addDeltaRange(ranges, "coin", ROOM_RANGES.shop.sell.armorShard.coinGain, ROOM_RANGES.shop.sell.armorShard.coinGain);
                }
                if (action.id === "shop_sell_food") {
                    addDeltaRange(ranges, "coin", ROOM_RANGES.shop.sell.food.coinGain, ROOM_RANGES.shop.sell.food.coinGain);
                }
                if (action.id === "shop_sell_scroll") {
                    addDeltaRange(ranges, "coin", ROOM_RANGES.shop.sell.scrollCoinGain, ROOM_RANGES.shop.sell.scrollCoinGain);
                }
            }

            if (activeEvent === "chest_event" && action.id === "open") {
                const chestCloudy = getChestRewardValueById("cloudy")?.hpRange;
                const chestLifeHp = getChestRewardValueById("life")?.hp ?? 0;
                const chestCoin = getChestRewardValueById("coin")?.coin;
                const chestPoorArmor = getChestRewardValueById("poor_armor")?.defense;
                const chestWhetstone = getChestRewardValueById("whetstone")?.extraAtk ?? 0;
                const chestHpMaxGain = chestLifeHp + Math.max(0, chestCloudy?.max ?? 0);

                addDeltaRange(ranges, "hp", -Math.abs(chestCloudy?.min ?? 0), chestHpMaxGain);
                addDeltaRange(ranges, "coin", 0, chestCoin?.max ?? 0);
                addDeltaRange(ranges, "food", 0, ROOM_RANGES.trapReward.spikeFood.max);
                addDeltaRange(ranges, "defense", 0, chestPoorArmor?.max ?? 0);
                addDeltaRange(ranges, "defenseMax", 0, getChestRewardValueById("superior_armor")?.defenseMax ?? 0);
                addDeltaRange(ranges, "extraAtk", 0, chestWhetstone);
            }

            if (activeEvent === "trap_event" && (action.id === "disarm" || action.id === "rush")) {
                addDeltaRange(ranges, "extraAtk", 0, ROOM_RANGES.trapReward.acidExtraAtk);
            }

            if (activeEvent === "bonfire_event") {
                if (action.id === "heal") addDeltaRange(ranges, "hp", ROOM_RANGES.bonfire.heal.min, ROOM_RANGES.bonfire.heal.max);
                if (action.id === "cook") addDeltaRange(ranges, "food", ROOM_RANGES.bonfire.cook.min, ROOM_RANGES.bonfire.cook.max);
                if (action.id === "polish") {
                    addDeltaRange(
                        ranges,
                        "extraAtk",
                        Math.min(...ROOM_RANGES.bonfire.polishDeltaPool),
                        Math.max(...ROOM_RANGES.bonfire.polishDeltaPool),
                    );
                }
                if (action.id === "search") {
                    addDeltaRange(ranges, "food", 0, ROOM_RANGES.bonfire.foundFood.max);
                    addDeltaRange(ranges, "coin", 0, ROOM_RANGES.bonfire.foundCoin.max);
                }
            }

            if (activeEvent === "forge_event") {
                if (action.id === "weapon") {
                    addDeltaRange(
                        ranges,
                        "extraAtk",
                        Math.min(...ROOM_RANGES.forge.weaponDeltaPool),
                        Math.max(...ROOM_RANGES.forge.weaponDeltaPool),
                    );
                }
                if (action.id === "armor") {
                    addDeltaRange(ranges, "defense", ROOM_RANGES.forge.armorDefGain, ROOM_RANGES.forge.armorDefGain);
                    addDeltaRange(ranges, "defenseMax", ROOM_RANGES.forge.armorDefMaxGain, ROOM_RANGES.forge.armorDefMaxGain);
                }
                if (action.id === "weapon" || action.id === "armor" || action.id === "forge_armor_thorns" || action.id === "forge_armor_heavy") {
                    addDeltaRange(ranges, "xp", ROOM_RANGES.forge.xpGain.min, ROOM_RANGES.forge.xpGain.max);
                }
            }

            if (activeEvent === "statue_event" && (action.id === "pray" || action.id === "offer")) {
                addDeltaRange(ranges, "hp", -ROOM_RANGES.statueCurseTrueDamage.max, ROOM_RANGES.statueBless.hp.max);
                addDeltaRange(ranges, "xp", -ROOM_RANGES.statue.curseXpLoss, ROOM_RANGES.statueBless.xp.jackpot);
                addDeltaRange(ranges, "defense", 0, ROOM_RANGES.statueBless.def.max);
                addDeltaRange(ranges, "extraAtk", 0, ROOM_RANGES.statue.blessAtkGain);
            }

            if (activeEvent === "mine_event" && action.id === "dig") {
                const chestCloudy = getChestRewardValueById("cloudy")?.hpRange;
                const chestLifeHp = getChestRewardValueById("life")?.hp ?? 0;
                const chestCoin = getChestRewardValueById("coin")?.coin;
                const chestWhetstone = getChestRewardValueById("whetstone")?.extraAtk ?? 0;
                const hpDownFromDig = snapshot.player.food > 0 ? 0 : ROOM_RANGES.mine.noFoodTrueDamage.max;
                const hpDownFromCloudy = Math.abs(chestCloudy?.min ?? 0);
                const hpUpFromChest = chestLifeHp + Math.max(0, chestCloudy?.max ?? 0);
                const hpUpFromPlant = ROOM_RANGES.mine.plantHp.max;
                const hpDown = Math.max(hpDownFromDig, hpDownFromCloudy);
                const hpUp = Math.max(hpUpFromChest, hpUpFromPlant);
                addDeltaRange(ranges, "hp", -hpDown, hpUp);

                if (snapshot.player.food > 0) {
                    addDeltaRange(
                        ranges,
                        "food",
                        ROOM_RANGES.mine.plantFood.min - ROOM_RANGES.mine.digFoodCost,
                        ROOM_RANGES.mine.plantFood.max - ROOM_RANGES.mine.digFoodCost,
                    );
                } else {
                    addDeltaRange(ranges, "food", 0, ROOM_RANGES.mine.plantFood.max);
                }

                addDeltaRange(ranges, "coin", 0, Math.max(ROOM_RANGES.mine.normalCoin.max, chestCoin?.max ?? 0));
                addDeltaRange(
                    ranges,
                    "extraAtk",
                    0,
                    Math.max(ROOM_RANGES.mine.rareOreAtkGain, chestWhetstone),
                );
            }
        }

        if (stage === "explore") {
            const currentXp = snapshot.player.xp;
            if (currentXp >= XP_MAX) {
                const levelGain = Math.floor(currentXp / XP_MAX);
                if (levelGain > 0) {
                    addDeltaRange(ranges, "xpLevel", levelGain, levelGain);
                }
            }
        }

        if (stage === "combat") {
            if (action.id === "skill") {
                const role = snapshot.player.character?.[0];
                if (role === "祭司") {
                    addDeltaRange(ranges, "extraAtk", 1, 3);
                }
                if (role === "刺客") {
                    addDeltaRange(ranges, "extraAtk", 2, 4);
                }
            }
            if (action.id === "scroll" && snapshot.player.scroll === "治疗术") {
                if (snapshot.player.hp > 10) {
                    addDeltaRange(ranges, "hp", 4, 7);
                } else {
                    addDeltaRange(ranges, "hp", 9, 13);
                }
            }
        }

        return buildGainPreviewFromRanges(ranges);
    };

    const applyActionResourcePreview = (action: RoomAction) => {
        if (action.disabledReason) {
            clearHoveredResourcePreview();
            return;
        }

        const spendPreview = buildActionSpendPreview(action);
        const gainPreview = buildActionGainPreview(action, spendPreview);
        setHoveredSpendPreview(hasSpendPreview(spendPreview) ? spendPreview : null);
        setHoveredGainPreview(hasGainPreview(gainPreview) ? gainPreview : null);
    };

    const getSpendPreviewHandlers = (action: RoomAction) => {
        if (action.disabledReason) {
            return {};
        }

        return {
            onMouseEnter: () => applyActionResourcePreview(action),
            onMouseLeave: clearHoveredResourcePreview,
            onFocus: () => applyActionResourcePreview(action),
            onBlur: clearHoveredResourcePreview,
        };
    };

    const useHealScrollInExplore = () => {
        if (!gameState.useHealScrollInExplore()) {
            refresh();
            return;
        }
        refresh();
    };

    const applyExploreHealScrollPreview = () => {
        const spendPreview = buildActionSpendPreview({
            id: "scroll",
            label: "使用卷轴: 治疗术",
            displayLabel: "使用治疗术",
            costBadges: [{ resource: "scroll", amount: -1 }],
        });
        setHoveredSpendPreview(hasSpendPreview(spendPreview) ? spendPreview : null);
        setHoveredGainPreview({ hp: "plusplus" });
    };

    useEffect(() => {
        return () => {
            if (actionAnimTimerRef.current !== null) {
                window.clearTimeout(actionAnimTimerRef.current);
                actionAnimTimerRef.current = null;
            }
            if (welcomeFxTimerRef.current !== null) {
                window.clearTimeout(welcomeFxTimerRef.current);
                welcomeFxTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.repeat) return;
            if (event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === "d") {
                event.preventDefault();
                setShowDeveloperPanel((value) => !value);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (!showDeveloperPanel) {
            return;
        }

        const blockPageWheel = (event: WheelEvent) => {
            event.preventDefault();
        };

        window.addEventListener("wheel", blockPageWheel, { passive: false });
        return () => window.removeEventListener("wheel", blockPageWheel);
    }, [showDeveloperPanel]);

    useEffect(() => {
        if (!showDeveloperPanel || !developerPanelDragging) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const panel = developerPanelRef.current;
            const panelWidth = panel?.offsetWidth ?? 320;
            const panelHeight = panel?.offsetHeight ?? 480;
            const nextX = event.clientX - developerPanelDragOffsetRef.current.x;
            const nextY = event.clientY - developerPanelDragOffsetRef.current.y;
            const maxX = Math.max(12, window.innerWidth - panelWidth - 12);
            const maxY = Math.max(12, window.innerHeight - panelHeight - 12);

            setDeveloperPanelPosition({
                x: Math.min(Math.max(12, nextX), maxX),
                y: Math.min(Math.max(12, nextY), maxY),
            });
        };

        const handlePointerEnd = () => {
            setDeveloperPanelDragging(false);
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
        };
    }, [showDeveloperPanel, developerPanelDragging]);

    const triggerWelcomeFx = () => {
        setShowWelcomeFx(true);
        if (welcomeFxTimerRef.current !== null) {
            window.clearTimeout(welcomeFxTimerRef.current);
        }
        welcomeFxTimerRef.current = window.setTimeout(() => {
            setShowWelcomeFx(false);
            welcomeFxTimerRef.current = null;
        }, 1000);
    };

    useEffect(() => {
        if (prevStageRef.current !== "combat" && stage === "combat") {
            setCombatIntroTriggerKey((key) => key + 1);
        }
        prevStageRef.current = stage;
    }, [stage]);

    const handleDeveloperPanelPointerDown = (event: React.PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const target = event.target;
        if (target instanceof Element && target.closest("button")) {
            return;
        }

        const panelRect = developerPanelRef.current?.getBoundingClientRect();
        if (!panelRect) {
            return;
        }

        developerPanelDragOffsetRef.current = {
            x: event.clientX - panelRect.left,
            y: event.clientY - panelRect.top,
        };
        setDeveloperPanelDragging(true);
        developerPanelRef.current?.setPointerCapture(event.pointerId);
    };

    useEffect(() => {
        clearHoveredResourcePreview();
    }, [stage, activeEvent, pendingScroll]);

    useEffect(() => {
        setEventAwaitingLeave(false);
    }, [stage, activeEvent]);

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

        clearHoveredResourcePreview();

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
        clearHoveredResourcePreview();
        if (withExitAnimation) {
            runActionWithButtonAnimation(actionId, action);
            return;
        }
        if (buttonsAnimating) return;
        action();
    };

    const triggerVictoryFx = () => {
        if (victoryFxTimerRef.current !== null) {
            window.clearTimeout(victoryFxTimerRef.current);
        }
        setVictoryFxKey((key) => key + 1);
        setShowVictoryFx(true);
        victoryFxTimerRef.current = window.setTimeout(() => {
            setShowVictoryFx(false);
            victoryFxTimerRef.current = null;
        }, 4200);
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
            gameState.addLog("你在房间结算后倒下，游戏结束");
            setActiveRoomKey(null);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setEventAwaitingLeave(false);
            setStage("gameover");
            refresh();
            return;
        }

        if (result.dungeonCleared) {
            gameState.clearLogs();
            gameState.addLog("你击败了地牢终焉，获得鹰魂结晶！");
            gameState.addLog("系统提示：本轮冒险已通关，鹰魂结晶已纳入战利记录。");
            triggerVictoryFx();
            setActiveRoomKey(null);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setStage("menu");
            refresh();
            return;
        }

        setActiveRoomKey(null);
        setActiveEvent(null);
        setPendingBossBonusChest(false);
        setStage("explore");
    };

    const startNewRun = () => {
        triggerWelcomeFx();
        gameState.reset();
        setCharOptions(gameState.getCharacterOptions());
        gameState.addLog("鼠标停在一些按钮上可以预览信息，后面遇到的也一样哦");
        hpPeakRef.current = 1;
        foodPeakRef.current = 1;
        coinPeakRef.current = 1;
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setPendingBossBonusChest(false);
        setStage("character");
        refresh();
    };

    const returnToMenu = () => {
        setHoveredChar(null);
        setActiveEvent(null);
        setActiveRoomKey(null);
        setPendingBossBonusChest(false);
        setEventAwaitingLeave(false);
        clearHoveredResourcePreview();
        setStage("menu");
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
        setPendingBossBonusChest(false);
        setStage("explore");
        refresh();
    };

    const enterRoom = () => {
        const roomKey = `${snapshot.dungeon.floor}-${snapshot.dungeon.roomIdx}`;
        gameState.clearLogs();
        setEventAwaitingLeave(false);
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
            setEventAwaitingLeave(false);
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
            setEventAwaitingLeave(false);
            gameState.startCombat(result.combat.monsterName, result.combat.hp, result.combat.atk, result.combat.isBoss);
            setStage("combat");
            refresh();
            return;
        }

        if (result.roomAdvancedInternally) {
            setEventAwaitingLeave(false);
            setActiveRoomKey(null);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setStage("explore");
            refresh();
            return;
        }

        if (result.complete) {
            const hasRoomLeaveAction = gameState.getRoomActions(activeEvent).some((action) => action.id === "leave");
            if (!hasRoomLeaveAction) {
                const eventTitle = gameState.getEventTitle(activeEvent);
                gameState.clearLogs();
                gameState.addLog(`离开${eventTitle}，触发通用结算`);
                if (activeEvent === "chest_event" && pendingBossBonusChest) {
                    setPendingBossBonusChest(false);
                }
                setEventAwaitingLeave(false);
                finalizeRoomFlow();
                refresh();
                return;
            }
            setEventAwaitingLeave(true);
        }
        refresh();
    };

    const leaveCurrentEvent = () => {
        if (!activeEvent) return;

        const eventTitle = gameState.getEventTitle(activeEvent);
        const hasRoomLeaveAction = gameState.getRoomActions(activeEvent).some((action) => action.id === "leave");

        if (hasRoomLeaveAction) {
            const leaveResult = gameState.resolveRoomAction(activeEvent, "leave");

            if (leaveResult.nextEventType) {
                setEventAwaitingLeave(false);
                if (leaveResult.nextEventType === "monster_event" || leaveResult.nextEventType === "boss_event") {
                    gameState.startRoomCombat(leaveResult.nextEventType);
                    setStage("combat");
                } else {
                    setActiveEvent(leaveResult.nextEventType);
                    gameState.addLog(`分支落点: ${gameState.getEventTitle(leaveResult.nextEventType)}`);
                }
                refresh();
                return;
            }

            if (leaveResult.combat) {
                setEventAwaitingLeave(false);
                gameState.startCombat(leaveResult.combat.monsterName, leaveResult.combat.hp, leaveResult.combat.atk, leaveResult.combat.isBoss);
                setStage("combat");
                refresh();
                return;
            }

            if (leaveResult.roomAdvancedInternally) {
                setEventAwaitingLeave(false);
                setActiveRoomKey(null);
                setActiveEvent(null);
                setPendingBossBonusChest(false);
                setStage("explore");
                refresh();
                return;
            }

            if (!leaveResult.complete) {
                refresh();
                return;
            }
        }

        gameState.clearLogs();
        gameState.addLog(`离开${eventTitle}，触发通用结算`);
        if (activeEvent === "chest_event" && pendingBossBonusChest) {
            setPendingBossBonusChest(false);
        }
        setEventAwaitingLeave(false);
        finalizeRoomFlow();
        refresh();
    };

    const resolveCombatAnimationKind = (actionType: CombatActionType): CombatActionKind => {
        if (actionType === "attack" || actionType === "critical") {
            return actionType;
        }

        if (actionType === "skill") {
            const role = snapshot.player.character?.[0];
            if (role === "圣骑士") return "skillPaladin";
            if (role === "祭司") return "skillPriest";
            if (role === "刺客") return "skillAssassin";
            return "skill";
        }

        if (actionType === "scroll") {
            const scroll = snapshot.player.scroll;
            if (scroll === "火球术") return "scrollFire";
            if (scroll === "寒冰术") return "scrollFrost";
            if (scroll === "治疗术") return "scrollHeal";
            if (scroll === "隐身术") return "scrollStealth";
            return "scroll";
        }

        return "attack";
    };

    const handleCombatAction = (actionType: CombatActionType) => {
        setCombatActionType(resolveCombatAnimationKind(actionType));
        setCombatActionTriggerKey((key) => key + 1);
        if (actionType === "attack" || actionType === "critical") {
            gameState.clearCombatLogs();
        }
        const result = gameState.performCombatAction(actionType);

        if (result.victory) {
            const defeatedName = snapshot.combat.monsterName;
            const wasBoss = snapshot.combat.isBoss;
            gameState.addLog(`击败 ${defeatedName}`);
            gameState.finishCombat(true);
            if (wasBoss) {
                gameState.queueBonusChest(1);
                setPendingBossBonusChest(true);
                setActiveEvent("chest_event");
                setStage("event");
                gameState.addLog("Boss掉落宝箱：请手动开启");
            } else {
                finalizeRoomFlow();
            }
        } else if (result.escaped) {
            gameState.finishCombat(false);
            finalizeRoomFlow();
        } else if (result.playerDied) {
            gameState.addLog("你已阵亡，本次游戏结束");
            gameState.finishCombat(false);
            setActiveEvent(null);
            setPendingBossBonusChest(false);
            setEventAwaitingLeave(false);
            setStage("gameover");
        }
        refresh();
    };

    const resolvePendingScroll = (accept: boolean) => {
        gameState.resolveScrollReplacement(accept);
        refresh();
    };

    useEffect(() => {
        return () => {
            if (victoryFxTimerRef.current !== null) {
                window.clearTimeout(victoryFxTimerRef.current);
            }
        };
    }, []);

    return (
        <main className={`shell stage-shell stage-${stage}`}>
            <div className="shell-ornament shell-ornament-a" aria-hidden="true" />
            <div className="shell-ornament shell-ornament-b" aria-hidden="true" />
            <div className="shell-grain" aria-hidden="true" />
            {showVictoryFx && (
                <div key={victoryFxKey} className="victory-fx" role="status" aria-live="assertive">
                    <div className="victory-fx-backdrop" aria-hidden="true" />
                    <div className="victory-fx-shards" aria-hidden="true">
                        {VICTORY_SHARDS.map((shard, idx) => (
                            (() => {
                                const shardStyle: VictoryShardStyle = {
                                    left: shard.left,
                                    animationDelay: shard.delay,
                                    animationDuration: shard.duration,
                                    width: shard.size,
                                    height: shard.size,
                                    "--victory-drift": shard.drift,
                                    "--victory-hue": shard.hue,
                                };

                                return (
                                    <span
                                        key={`victory-shard-${victoryFxKey}-${idx}`}
                                        className="victory-fx-shard"
                                        style={shardStyle}
                                    />
                                );
                            })()
                        ))}
                    </div>
                    <div className="victory-fx-center">
                        <span className="victory-fx-kicker">地牢终焉已破</span>
                        <strong className="victory-fx-title">鹰魂结晶</strong>
                        <span className="victory-fx-detail">你击败了地牢终焉，结晶已完成收束。</span>
                    </div>
                </div>
            )}
            {showWelcomeFx && (
                <div className="welcome-fx" role="status" aria-live="polite">
                    <div className="welcome-fx-inner">
                        <span className="welcome-fx-kicker">新冒险已准备</span>
                        <strong className="welcome-fx-title">选择角色</strong>
                    </div>
                </div>
            )}
            {stage === "menu" ? (
                <section className="left-panel stage-panel-main menu-only-panel menu-stage-panel">
                    <section className="menu-hero" aria-label="首页概览">
                        <div className="menu-hero-copy">
                            <span className="menu-hero-kicker">FalconCrypt</span>
                            <h1 className="menu-hero-title">
                                四层遗迹，资源先行。
                            </h1>
                            <p className="menu-hero-text">
                                选定角色后进入地牢，在地图预判、房间事件和战斗消耗之间做取舍。
                            </p>
                            <div className="menu-hero-actions">
                                <button className="menu-primary-action" data-action-id="start-new-run" onClick={() => triggerAction("start-new-run", startNewRun)}>
                                    进入遗迹
                                </button>
                            </div>
                        </div>
                        <div className="menu-hero-brief" aria-label="冒险摘要">
                            {menuHeroStats.map((item) => (
                                <div key={item.label} className="menu-hero-stat">
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                        <aside className="menu-hero-board" aria-label="冒险路线预览">
                            <header className="menu-board-head">
                                <span>本局路线</span>
                                <strong>B1-B{FLOOR}</strong>
                            </header>
                            <div className="menu-depth-map">
                                {menuRoutePreview.map((item, index) => (
                                    <div key={item.label} className="menu-depth-step">
                                        <span className="menu-depth-index">{index + 1}</span>
                                        <span className="menu-depth-copy">
                                            <strong>{item.label}</strong>
                                            <span>{item.detail}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="menu-resource-preview" aria-label="资源关注点">
                                {menuResourceFocus.map((item) => (
                                    <div key={item.label} className={`menu-resource-token menu-resource-${item.tone}`}>
                                        <span>{item.label}</span>
                                        <strong>{item.text}</strong>
                                    </div>
                                ))}
                            </div>
                        </aside>
                    </section>
                </section>
            ) : (
                <>
                    <section className="left-panel stage-panel-main">
                        <div className="map-canvas-row">
                            <div>
                                <div className="map-panel">
                                    <div className="map-floor">
                                        <div className="map-floor-title">当前层 B{snapshot.dungeon.floor}</div>
                                        <div className="map-room-list" aria-label={`当前层 B${snapshot.dungeon.floor} 路径`}>
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

                                    {hasNextFloor && nextFloor && (
                                        <div className="map-floor">
                                            <div className="map-floor-title">下一层 B{nextFloor}</div>
                                            <div className="map-room-list" aria-label={`下一层 B${nextFloor} 预判`}>
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
                                    )}
                                </div>
                            </div>
                            <div className="map-canvas-box">
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
                            </div>
                        </div>

                        <ActionPanel
                            actionsRef={actionsRef}
                            pendingScroll={pendingScroll}
                            stage={stage}
                            charOptions={charOptions}
                            activeEvent={activeEvent}
                            eventAwaitingLeave={eventAwaitingLeave}
                            shopInventory={shopInventory}
                            exploreEnterLabel={exploreEnterLabel}
                            playerScroll={snapshot.player.scroll}
                            playerCharacter={snapshot.player.character}
                            triggerAction={triggerAction}
                            resolvePendingScroll={resolvePendingScroll}
                            confirmCharacter={confirmCharacter}
                            setHoveredChar={setHoveredChar}
                            enterRoom={enterRoom}
                            useHealScrollInExplore={useHealScrollInExplore}
                            applyExploreHealScrollPreview={applyExploreHealScrollPreview}
                            clearHoveredResourcePreview={clearHoveredResourcePreview}
                            applyActionResourcePreview={applyActionResourcePreview}
                            executeRoomAction={executeRoomAction}
                            leaveCurrentEvent={leaveCurrentEvent}
                            handleCombatAction={handleCombatAction}
                            returnToMenu={returnToMenu}
                            getSpendPreviewHandlers={getSpendPreviewHandlers}
                            renderActionTooltip={renderActionTooltip}
                            renderScrollTooltip={renderScrollTooltip}
                            renderSkillTooltip={renderSkillTooltip}
                            renderCriticalTooltip={renderCriticalTooltip}
                            renderTrapActionTooltip={renderTrapActionTooltip}
                            renderStatueActionTooltip={renderStatueActionTooltip}
                        />

                        {logTimelineGroups.length > 0 && (
                            <section className="log-panel" aria-label="日志时间流">
                                <header className="panel-title">日志</header>
                                <div className="log-stream">
                                    {logTimelineGroups.map(({ entry, groupIndex, opacity }) => {
                                        return (
                                            <article
                                                key={entry.id}
                                                className={`log-entry log-entry-${entry.category} ${groupIndex === 0 ? "is-latest-group" : ""}`}
                                                style={{ "--log-entry-opacity": opacity } as React.CSSProperties}
                                            >
                                                <span className="log-entry-kind" aria-hidden="true" />
                                                <span className="log-entry-line">
                                                    {entry.detail && entry.emphasis ? (
                                                        <>
                                                            <strong className="log-entry-emphasis">{entry.emphasis}</strong>
                                                            <span className="log-entry-detail">{entry.detail}</span>
                                                        </>
                                                    ) : entry.detail ? (
                                                        <span className="log-entry-detail log-entry-detail-full">{entry.detail}</span>
                                                    ) : (
                                                        <strong className="log-entry-emphasis log-entry-detail-only">{entry.emphasis}</strong>
                                                    )}
                                                </span>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </section>

                    <div className="right-side-cluster">
                        <StatusSidebar
                            stage={stage}
                            previewChar={previewChar}
                            displayCharacter={displayCharacter}
                            currentStageLabel={currentStageLabel}
                            currentFocusLabel={currentFocusLabel}
                            dangerLevel={dangerLevel}
                            displayScroll={displayScroll}
                            atkMin={atkMin}
                            atkMax={atkMax}
                            displayExtraAtk={displayExtraAtk}
                            hasTempExtraAtkInDisplay={hasTempExtraAtkInDisplay}
                            hoveredSpendPreview={hoveredSpendPreview}
                            hoveredGainPreview={hoveredGainPreview}
                            displayHp={displayHp}
                            playerHpMax={playerHpMax}
                            hpSegments={hpSegments}
                            armorEffectStars={armorEffectStars}
                            displayDefense={displayDefense}
                            defenseMax={defenseMax}
                            defenseDisplayValue={defenseDisplayValue}
                            defSegments={defSegments}
                            skillPoint={snapshot.combat.skillPoint}
                            displayFood={displayFood}
                            foodMax={foodMax}
                            foodSegments={foodSegments}
                            displayCoin={displayCoin}
                            coinMax={coinMax}
                            coinSegments={coinSegments}
                            monsterHp={snapshot.combat.monsterHp || 0}
                            monsterMax={monsterMax}
                            effectiveMonsterAtk={effectiveMonsterAtk}
                            monsterAtkMax={monsterAtkMax}
                            xp={snapshot.player.xp}
                            xpLevel={snapshot.player.xpLevel}
                            room={snapshot.dungeon.roomIdx}
                            roomMax={roomMax}
                            floor={snapshot.dungeon.floor}
                            floorMax={floorMax}
                            thresholdRule={thresholdRule}
                        />

                        {showDeveloperPanel && (
                            <DeveloperPanel
                                controls={developerControls}
                                dragging={developerPanelDragging}
                                panelRef={developerPanelRef}
                                position={developerPanelPosition}
                                nextRoomKey={developerNextRoomKey}
                                nextRoomType={developerNextRoomType}
                                onPointerDown={handleDeveloperPanelPointerDown}
                                onWheelControl={handleDeveloperWheel}
                                onRoomTypeChange={handleDeveloperRoomTypeChange}
                            />
                        )}
                    </div>
                </>
            )}
        </main>
    );
}
