import type { PointerEvent, RefObject, WheelEvent } from "react";
import type { DeveloperScalarField } from "../game/state";
import type { RoomEventType } from "../game/types";

export type DeveloperControl = {
    key: DeveloperScalarField;
    label: string;
    value: number;
    hidden?: boolean;
};

export const DEV_PANEL_TOGGLE = "Ctrl+Shift+Alt+D";

const DEV_ROOM_TYPE_OPTIONS: RoomEventType[] = [
    "monster_event",
    "boss_event",
    "branch_event",
    "chest_event",
    "trap_event",
    "shop_event",
    "bonfire_event",
    "forge_event",
    "statue_event",
    "mine_event",
];

const DEV_ROOM_TYPE_LABELS: Record<RoomEventType, string> = {
    monster_event: "怪物",
    boss_event: "Boss",
    branch_event: "分叉",
    chest_event: "宝箱",
    trap_event: "陷阱",
    shop_event: "商店",
    bonfire_event: "篝火",
    forge_event: "铸锻",
    statue_event: "雕像",
    mine_event: "矿洞",
};

type DeveloperPanelProps = {
    controls: DeveloperControl[];
    dragging: boolean;
    panelRef: RefObject<HTMLElement>;
    position: { x: number; y: number };
    nextRoomKey: string | null;
    nextRoomType: RoomEventType | null;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onWheelControl: (event: WheelEvent<HTMLElement>, field: DeveloperScalarField) => void;
    onRoomTypeChange: (eventType: RoomEventType) => void;
};

export function DeveloperPanel({
    controls,
    dragging,
    panelRef,
    position,
    nextRoomKey,
    nextRoomType,
    onPointerDown,
    onWheelControl,
    onRoomTypeChange,
}: DeveloperPanelProps): JSX.Element {
    return (
        <section
            className={`developer-panel${dragging ? " is-dragging" : ""}`}
            ref={panelRef}
            aria-label="开发者面板"
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
            onPointerDown={onPointerDown}
        >
            <header className="developer-panel-head">
                <div>
                    <div className="developer-panel-kicker">开发者面板</div>
                    <strong>滚轮调值</strong>
                </div>
                <div className="developer-panel-head-tools">
                    <span className="developer-panel-shortcut">{DEV_PANEL_TOGGLE}</span>
                </div>
            </header>
            <div className="developer-panel-note">将鼠标移到条目上滚动即可增减。隐藏项也会显示在这里。</div>
            <div className="developer-control-list">
                {controls.map((control) => (
                    <button
                        key={control.key}
                        type="button"
                        className={`developer-control ${control.hidden ? "is-hidden-field" : ""}`}
                        onWheel={(event) => onWheelControl(event, control.key)}
                    >
                        <span className="developer-control-label">{control.label}</span>
                        <strong className="developer-control-value">{control.value}</strong>
                    </button>
                ))}
            </div>
            <div className="developer-next-room">
                <div className="developer-next-room-head">
                    <span>下个房间</span>
                    <strong>{nextRoomKey ?? "无"}</strong>
                </div>
                <div className="developer-room-type-grid">
                    {DEV_ROOM_TYPE_OPTIONS.map((eventType) => (
                        <button
                            key={eventType}
                            type="button"
                            className={`developer-room-type ${nextRoomType === eventType ? "is-active" : ""}`}
                            onClick={() => onRoomTypeChange(eventType)}
                            disabled={!nextRoomKey}
                        >
                            {DEV_ROOM_TYPE_LABELS[eventType]}
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}
