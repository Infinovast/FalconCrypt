import type { ReactNode } from "react";
import { RESOURCE_THRESHOLD_RULES, XP_MAX } from "../game/constants";
import type { ThresholdRule } from "../game/constants";
import type { CharacterTuple } from "../game/types";
import { gainHintText } from "../game/uiHelpers";
import type { ResourceGainPreview, ResourceSpendPreview, Stage } from "../game/uiHelpers";
import {
    IconStripResource,
    MonsterCompositeResource,
    ProgressCompositeResource,
    SegmentedResource,
    XpCompositeResource,
} from "./GameWidgets";

export type StatusSidebarProps = {
    stage: Stage;
    previewChar: CharacterTuple | null;
    displayCharacter: CharacterTuple | null;
    currentStageLabel: string;
    currentFocusLabel: string;
    dangerLevel: number;
    displayScroll: string;
    atkMin: number;
    atkMax: number;
    displayExtraAtk: number;
    hasTempExtraAtkInDisplay: boolean;
    hoveredSpendPreview: ResourceSpendPreview | null;
    hoveredGainPreview: ResourceGainPreview | null;
    displayHp: number;
    playerHpMax: number;
    hpSegments: number;
    armorEffectStars: ReactNode;
    displayDefense: number;
    defenseMax: number;
    defenseDisplayValue: string;
    defSegments: number;
    skillPoint: number;
    displayFood: number;
    foodMax: number;
    foodSegments: number;
    displayCoin: number;
    coinMax: number;
    coinSegments: number;
    monsterHp: number;
    monsterMax: number;
    effectiveMonsterAtk: number;
    monsterAtkMax: number;
    xp: number;
    xpLevel: number;
    room: number;
    roomMax: number;
    floor: number;
    floorMax: number;
    thresholdRule: (rule: ThresholdRule) => ThresholdRule;
};

export function StatusSidebar({
    stage,
    previewChar,
    displayCharacter,
    currentStageLabel,
    currentFocusLabel,
    dangerLevel,
    displayScroll,
    atkMin,
    atkMax,
    displayExtraAtk,
    hasTempExtraAtkInDisplay,
    hoveredSpendPreview,
    hoveredGainPreview,
    displayHp,
    playerHpMax,
    hpSegments,
    armorEffectStars,
    displayDefense,
    defenseMax,
    defenseDisplayValue,
    defSegments,
    skillPoint,
    displayFood,
    foodMax,
    foodSegments,
    displayCoin,
    coinMax,
    coinSegments,
    monsterHp,
    monsterMax,
    effectiveMonsterAtk,
    monsterAtkMax,
    xp,
    xpLevel,
    room,
    roomMax,
    floor,
    floorMax,
    thresholdRule,
}: StatusSidebarProps): JSX.Element {
    return (
        <section className="right-panel stage-panel-side">
            <section className="status-hero" aria-label="状态概览">
                <div className="status-hero-main">
                    <span className="status-hero-kicker">运行状态</span>
                    <div className="status-hero-value-row">
                        <strong className="status-hero-stage">{currentStageLabel}</strong>
                        <span className="status-hero-dot" aria-hidden="true" />
                        <span className="status-hero-focus">{currentFocusLabel}</span>
                    </div>
                </div>
                <div className="status-hero-badge">
                    <span>危险指数</span>
                    <strong>{dangerLevel}/5</strong>
                </div>
            </section>
            <div className="status-overview">
                <div className="overview-chip">
                    <span>角色</span>
                    <strong>{displayCharacter?.[0] ?? "-"}</strong>
                </div>
                <div className="overview-chip">
                    <span>{previewChar ? "技能" : stage === "event" ? "事件" : "怪物"}</span>
                    <strong>{currentFocusLabel}</strong>
                </div>
                <div className="overview-chip">
                    <span>卷轴</span>
                    <strong className={(hoveredSpendPreview?.scroll ?? 0) > 0 ? "scroll-preview consume-pulse" : "scroll-preview"}>{displayScroll}</strong>
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
                        {hoveredGainPreview?.extraAtk && (
                            <span
                                className={`atk-gain-hint ${hoveredGainPreview.extraAtk === "plusminus" ? "is-mixed" : hoveredGainPreview.extraAtk === "plusmaybe" ? "is-maybe" : ""}`}
                            >
                                {gainHintText(hoveredGainPreview.extraAtk)}
                            </span>
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
                    consumeCount={hoveredSpendPreview?.hp ?? 0}
                    gainHint={hoveredGainPreview?.hp}
                    tone="hp"
                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.hp)}
                />
                <SegmentedResource
                    valuePrefix={armorEffectStars}
                    icon="🛡"
                    label="护甲"
                    value={displayDefense}
                    max={defenseMax}
                    displayValue={defenseDisplayValue}
                    segments={defSegments}
                    consumeCount={hoveredSpendPreview?.defense ?? 0}
                    gainHint={hoveredGainPreview?.defense}
                    secondaryGainHint={hoveredGainPreview?.defenseMax}
                    secondaryGainHintPrefix="Max"
                    tone="shield"
                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.shield)}
                />
                {stage === "combat" && (
                    <IconStripResource
                        icon="✦"
                        label="技能点"
                        value={skillPoint}
                        unit={1}
                        maxValue={12}
                        consumeCount={hoveredSpendPreview?.skillPoint ?? 0}
                        gainHint={hoveredGainPreview?.skillPoint}
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
                    consumeCount={hoveredSpendPreview?.food ?? 0}
                    gainHint={hoveredGainPreview?.food}
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
                    consumeCount={hoveredSpendPreview?.coin ?? 0}
                    gainHint={hoveredGainPreview?.coin}
                    tone="coin"
                    threshold={thresholdRule(RESOURCE_THRESHOLD_RULES.coin)}
                />
                {stage === "combat" && (
                    <MonsterCompositeResource
                        hp={monsterHp}
                        hpMax={monsterMax}
                        atk={effectiveMonsterAtk}
                        atkMax={monsterAtkMax}
                    />
                )}
                <XpCompositeResource
                    xp={xp}
                    xpMax={XP_MAX}
                    xpLevel={xpLevel}
                    xpGainHint={hoveredGainPreview?.xp}
                    levelGainHint={hoveredGainPreview?.xpLevel}
                />
                <ProgressCompositeResource room={room} roomMax={roomMax} floor={floor} floorMax={floorMax} />
            </div>
        </section>
    );
}
