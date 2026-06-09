import { useRef, useState } from "react";
import type { FocusEventHandler, MouseEventHandler, PointerEventHandler, ReactNode, RefObject } from "react";
import { FORGE_HOVER_HINTS } from "../game/constants";
import { gameState } from "../game/state";
import type { CharacterTuple, CombatActionType, RoomAction, RoomEventType, ShopInventoryView } from "../game/types";
import { getCharacterHoverHint } from "../game/uiHelpers";
import type { Stage } from "../game/uiHelpers";
import { ActionButtonContent } from "./GameWidgets";

type SpendPreviewHandlers = {
    onMouseEnter?: MouseEventHandler<HTMLElement>;
    onMouseLeave?: MouseEventHandler<HTMLElement>;
    onFocus?: FocusEventHandler<HTMLElement>;
    onBlur?: FocusEventHandler<HTMLElement>;
};

type ActionPanelProps = {
    actionsRef: RefObject<HTMLDivElement>;
    pendingScroll: string | null;
    stage: Stage;
    charOptions: CharacterTuple[];
    activeEvent: RoomEventType | null;
    eventAwaitingLeave: boolean;
    shopInventory: ShopInventoryView | null;
    exploreEnterLabel: string;
    playerScroll: string | null;
    playerCharacter: CharacterTuple | null;
    triggerAction: (actionId: string, action: () => void, withExitAnimation?: boolean) => void;
    resolvePendingScroll: (accept: boolean) => void;
    confirmCharacter: (index: number) => void;
    setHoveredChar: (character: CharacterTuple | null) => void;
    enterRoom: () => void;
    useHealScrollInExplore: () => void;
    applyExploreHealScrollPreview: () => void;
    clearHoveredResourcePreview: () => void;
    applyActionResourcePreview: (action: RoomAction) => void;
    executeRoomAction: (actionId: string) => void;
    leaveCurrentEvent: () => void;
    handleCombatAction: (actionType: CombatActionType) => void;
    returnToMenu: () => void;
    getSpendPreviewHandlers: (action: RoomAction) => SpendPreviewHandlers;
    renderActionTooltip: (hint: { title: string; detail?: string } | null | undefined) => ReactNode;
    renderScrollTooltip: (scrollName: string | null | undefined) => ReactNode;
    renderSkillTooltip: (character: CharacterTuple | null) => ReactNode;
    renderCriticalTooltip: () => ReactNode;
    renderTrapActionTooltip: (actionId: string) => ReactNode;
    renderStatueActionTooltip: (actionId: string) => ReactNode;
};

type PressedButtonAction = {
    actionId: string;
    pointerId: number;
    onCancel?: () => void;
};

type PressHoverOptions = {
    onPress?: () => void;
    onCancel?: () => void;
};

export function ActionPanel({
    actionsRef,
    pendingScroll,
    stage,
    charOptions,
    activeEvent,
    eventAwaitingLeave,
    shopInventory,
    exploreEnterLabel,
    playerScroll,
    playerCharacter,
    triggerAction,
    resolvePendingScroll,
    confirmCharacter,
    setHoveredChar,
    enterRoom,
    useHealScrollInExplore,
    applyExploreHealScrollPreview,
    clearHoveredResourcePreview,
    applyActionResourcePreview,
    executeRoomAction,
    leaveCurrentEvent,
    handleCombatAction,
    returnToMenu,
    getSpendPreviewHandlers,
    renderActionTooltip,
    renderScrollTooltip,
    renderSkillTooltip,
    renderCriticalTooltip,
    renderTrapActionTooltip,
    renderStatueActionTooltip,
}: ActionPanelProps): JSX.Element {
    const [pressedActionId, setPressedActionId] = useState<string | null>(null);
    const pressedButtonRef = useRef<PressedButtonAction | null>(null);
    const suppressNextClickRef = useRef<string | null>(null);

    const getButtonClassName = (actionId: string, className?: string) =>
        [className, pressedActionId === actionId ? "is-pressed-hover" : null].filter(Boolean).join(" ") || undefined;

    const isPointerInsideButton = (event: React.PointerEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };

    const releasePointerCapture = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const cancelPressedButton = (event: React.PointerEvent<HTMLButtonElement>) => {
        const pressedButton = pressedButtonRef.current;
        if (!pressedButton || pressedButton.pointerId !== event.pointerId) return;
        releasePointerCapture(event);
        pressedButtonRef.current = null;
        setPressedActionId(null);
        pressedButton.onCancel?.();
    };

    const getReleaseActionHandlers = (
        actionId: string,
        action: () => void,
        withExitAnimation = true,
        options: PressHoverOptions = {},
    ): {
        onPointerDown: PointerEventHandler<HTMLButtonElement>;
        onPointerUp: PointerEventHandler<HTMLButtonElement>;
        onPointerCancel: PointerEventHandler<HTMLButtonElement>;
        onClick: MouseEventHandler<HTMLButtonElement>;
        onContextMenu: MouseEventHandler<HTMLButtonElement>;
    } => ({
        onPointerDown: (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (event.currentTarget.disabled) return;

            pressedButtonRef.current?.onCancel?.();
            pressedButtonRef.current = { actionId, pointerId: event.pointerId, onCancel: options.onCancel };
            setPressedActionId(actionId);
            event.currentTarget.setPointerCapture(event.pointerId);
            options.onPress?.();
        },
        onPointerUp: (event) => {
            const pressedButton = pressedButtonRef.current;
            if (!pressedButton || pressedButton.pointerId !== event.pointerId || pressedButton.actionId !== actionId) return;

            const shouldTrigger = isPointerInsideButton(event);
            releasePointerCapture(event);
            pressedButtonRef.current = null;
            setPressedActionId(null);

            if (!shouldTrigger) {
                pressedButton.onCancel?.();
                return;
            }

            suppressNextClickRef.current = actionId;
            window.setTimeout(() => {
                if (suppressNextClickRef.current === actionId) {
                    suppressNextClickRef.current = null;
                }
            }, 0);
            triggerAction(actionId, action, withExitAnimation);
        },
        onPointerCancel: cancelPressedButton,
        onClick: (event) => {
            if (suppressNextClickRef.current === actionId) {
                suppressNextClickRef.current = null;
                event.preventDefault();
                return;
            }
            triggerAction(actionId, action, withExitAnimation);
        },
        onContextMenu: (event) => {
            if (pressedButtonRef.current?.actionId === actionId) {
                event.preventDefault();
            }
        },
    });

    return (
        <div className="actions" ref={actionsRef}>
            {pendingScroll ? (
                <>
                    <button
                        data-action-id="pending-scroll-accept"
                        className={getButtonClassName("pending-scroll-accept")}
                        {...getReleaseActionHandlers("pending-scroll-accept", () => resolvePendingScroll(true))}
                    >
                        替换为 {pendingScroll}
                    </button>
                    <button
                        data-action-id="pending-scroll-keep"
                        className={getButtonClassName("pending-scroll-keep")}
                        {...getReleaseActionHandlers("pending-scroll-keep", () => resolvePendingScroll(false))}
                    >
                        保留当前卷轴
                    </button>
                </>
            ) : (
                <>
                    {stage === "character" &&
                        charOptions.map((character, index) => {
                            const hint = getCharacterHoverHint(character);
                            const actionId = `character-${index}`;
                            return (
                                <button
                                    key={character[0]}
                                    className={getButtonClassName(actionId, "character-option-btn")}
                                    data-action-id={actionId}
                                    {...getReleaseActionHandlers(actionId, () => confirmCharacter(index), true, {
                                        onPress: () => setHoveredChar(character),
                                        onCancel: () => setHoveredChar(null),
                                    })}
                                    onMouseEnter={() => setHoveredChar(character)}
                                    onMouseLeave={() => setHoveredChar(null)}
                                    onFocus={() => setHoveredChar(character)}
                                    onBlur={() => setHoveredChar(null)}
                                >
                                    <span className="character-option-label">
                                        选择 {character[0]} / {character[6]}
                                    </span>
                                    <span className="character-option-tip" aria-hidden="true">
                                        <span>{hint.trait}</span>
                                        <span>{hint.skill}</span>
                                    </span>
                                </button>
                            );
                        })}
                    {stage === "explore" && (
                        <>
                            <button
                                data-action-id="enter-room"
                                className={getButtonClassName("enter-room")}
                                {...getReleaseActionHandlers("enter-room", enterRoom)}
                            >
                                {exploreEnterLabel}
                            </button>
                            {playerScroll === "治疗术" && (
                                <button
                                    className={getButtonClassName("explore-heal-scroll", "scroll-action-btn")}
                                    data-action-id="explore-heal-scroll"
                                    {...getReleaseActionHandlers("explore-heal-scroll", useHealScrollInExplore, false, {
                                        onPress: applyExploreHealScrollPreview,
                                        onCancel: clearHoveredResourcePreview,
                                    })}
                                    onMouseEnter={applyExploreHealScrollPreview}
                                    onMouseLeave={clearHoveredResourcePreview}
                                    onFocus={applyExploreHealScrollPreview}
                                    onBlur={clearHoveredResourcePreview}
                                >
                                    使用治疗术
                                    {renderScrollTooltip("治疗术")}
                                </button>
                            )}
                        </>
                    )}
                    {stage === "event" &&
                        activeEvent &&
                        (activeEvent === "shop_event" && shopInventory ? (
                            <>
                                <div className="shop-section">
                                    <div className="shop-title">买入</div>
                                    <div className="shop-list">
                                        {shopInventory.buy.map((action) => {
                                            const previewHandlers = getSpendPreviewHandlers(action);
                                            return (
                                                <button
                                                    key={action.id}
                                                    className={getButtonClassName(action.id)}
                                                    data-action-id={action.id}
                                                    disabled={Boolean(action.disabledReason)}
                                                    title={action.disabledReason}
                                                    {...getReleaseActionHandlers(action.id, () => executeRoomAction(action.id), false, {
                                                        onPress: () => applyActionResourcePreview(action),
                                                        onCancel: clearHoveredResourcePreview,
                                                    })}
                                                    {...previewHandlers}
                                                >
                                                    <ActionButtonContent action={action} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="shop-section">
                                    <div className="shop-title">卖出</div>
                                    <div className="shop-list">
                                        {shopInventory.sell.map((action) => {
                                            const previewHandlers = getSpendPreviewHandlers(action);
                                            return (
                                                <button
                                                    key={action.id}
                                                    className={getButtonClassName(action.id)}
                                                    data-action-id={action.id}
                                                    disabled={Boolean(action.disabledReason)}
                                                    title={action.disabledReason}
                                                    {...getReleaseActionHandlers(action.id, () => executeRoomAction(action.id), false, {
                                                        onPress: () => applyActionResourcePreview(action),
                                                        onCancel: clearHoveredResourcePreview,
                                                    })}
                                                    {...previewHandlers}
                                                >
                                                    <ActionButtonContent action={action} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {gameState
                                    .getRoomActions(activeEvent)
                                    .filter((action) => action.id === "leave")
                                    .map((action) => (
                                        <button
                                            key={action.id}
                                            className={getButtonClassName(action.id, "shop-leave-btn")}
                                            data-action-id={action.id}
                                            disabled={Boolean(action.disabledReason)}
                                            title={action.disabledReason}
                                            {...getReleaseActionHandlers(action.id, leaveCurrentEvent, true, {
                                                onPress: () => applyActionResourcePreview(action),
                                                onCancel: clearHoveredResourcePreview,
                                            })}
                                            {...getSpendPreviewHandlers(action)}
                                        >
                                            <ActionButtonContent action={action} />
                                        </button>
                                    ))}
                            </>
                        ) : (
                            <>
                                {activeEvent === "mine_event" && (
                                    <div className="event-tip">提示：本房间只要执行过挖掘，离开后将跳过通用房间结算。</div>
                                )}
                                {gameState
                                    .getRoomActions(activeEvent)
                                    .filter((action) => {
                                        if (eventAwaitingLeave) return action.id === "leave";
                                        if (
                                            (activeEvent === "chest_event" ||
                                                activeEvent === "trap_event" ||
                                                activeEvent === "bonfire_event") &&
                                            action.id === "leave"
                                        ) {
                                            return false;
                                        }
                                        return true;
                                    })
                                    .map((action) => {
                                        const hasActionTooltip =
                                            (activeEvent === "forge_event" && (action.id === "weapon" || action.id === "armor" || action.id.startsWith("forge_armor_"))) ||
                                            (activeEvent === "trap_event" && (action.id === "disarm" || action.id === "rush")) ||
                                            (activeEvent === "statue_event" && (action.id === "pray" || action.id === "offer"));
                                        const previewHandlers = getSpendPreviewHandlers(action);
                                        return (
                                            <button
                                                key={action.id}
                                                className={getButtonClassName(action.id, hasActionTooltip ? "scroll-action-btn" : undefined)}
                                                data-action-id={action.id}
                                                disabled={Boolean(action.disabledReason)}
                                                title={action.disabledReason}
                                                {...getReleaseActionHandlers(
                                                    action.id,
                                                    action.id === "leave" ? leaveCurrentEvent : () => executeRoomAction(action.id),
                                                    true,
                                                    {
                                                        onPress: () => applyActionResourcePreview(action),
                                                        onCancel: clearHoveredResourcePreview,
                                                    },
                                                )}
                                                {...previewHandlers}
                                            >
                                                <ActionButtonContent action={action} />
                                                {activeEvent === "trap_event" ? renderTrapActionTooltip(action.id) : null}
                                                {activeEvent === "statue_event" ? renderStatueActionTooltip(action.id) : null}
                                                {activeEvent === "forge_event" && action.id === "weapon"
                                                    ? renderActionTooltip(FORGE_HOVER_HINTS.weapon)
                                                    : null}
                                                {activeEvent === "forge_event" && action.id === "armor"
                                                    ? renderActionTooltip(FORGE_HOVER_HINTS.armor)
                                                    : null}
                                                {activeEvent === "forge_event" && action.id === "forge_armor_thorns"
                                                    ? renderActionTooltip(FORGE_HOVER_HINTS.thorns)
                                                    : null}
                                                {activeEvent === "forge_event" && action.id === "forge_armor_heavy"
                                                    ? renderActionTooltip(FORGE_HOVER_HINTS.heavy)
                                                    : null}
                                            </button>
                                        );
                                    })}
                            </>
                        ))}
                    {stage === "combat" &&
                        gameState.getCombatActions().map((action) => {
                            const previewHandlers = getSpendPreviewHandlers(action);
                            const hasActionTooltip = action.id === "scroll" || action.id === "skill" || action.id === "critical";
                            return (
                                <button
                                    key={action.id}
                                    className={getButtonClassName(action.id, hasActionTooltip ? "scroll-action-btn" : undefined)}
                                    data-action-id={action.id}
                                    disabled={Boolean(action.disabledReason)}
                                    title={action.disabledReason}
                                    {...getReleaseActionHandlers(action.id, () => handleCombatAction(action.id as CombatActionType), false, {
                                        onPress: () => applyActionResourcePreview(action),
                                        onCancel: clearHoveredResourcePreview,
                                    })}
                                    {...previewHandlers}
                                >
                                    <ActionButtonContent action={action} />
                                    {action.id === "critical" ? renderCriticalTooltip() : null}
                                    {action.id === "scroll" ? renderScrollTooltip(playerScroll) : null}
                                    {action.id === "skill" ? renderSkillTooltip(playerCharacter) : null}
                                </button>
                            );
                        })}
                    {stage === "gameover" && (
                        <button
                            data-action-id="return-menu"
                            className={getButtonClassName("return-menu")}
                            {...getReleaseActionHandlers("return-menu", returnToMenu)}
                        >
                            返回主页
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
