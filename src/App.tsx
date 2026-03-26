import { useMemo, useState } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { gameState } from "./game/state";
import type { CharacterTuple } from "./game/types";

type Stage = "menu" | "character" | "explore" | "combat";

export function App(): JSX.Element {
    const [stage, setStage] = useState<Stage>("menu");
    const [tick, setTick] = useState(0);
    const [charOptions, setCharOptions] = useState<CharacterTuple[]>([]);

    const snapshot = gameState.snapshot;
    const dangerLevel = useMemo(() => Math.min(5, snapshot.dungeon.floor), [snapshot.dungeon.floor, tick]);

    const refresh = () => setTick((v) => v + 1);

    const startNewRun = () => {
        gameState.reset();
        setCharOptions(gameState.getCharacterOptions());
        setStage("character");
        refresh();
    };

    const confirmCharacter = (index: number) => {
        gameState.pickCharacter(index);
        setStage("explore");
        refresh();
    };

    const enterRoom = () => {
        const evt = gameState.getCurrentRoomEvent();
        if (!evt) return;
        if (evt === "monster_event" || evt === "boss_event") {
            gameState.startCombat(evt === "boss_event" ? "鹰魂守卫" : "地穴怪", 18 + snapshot.dungeon.floor * 4, 4 + snapshot.dungeon.floor);
            setStage("combat");
        } else {
            gameState.addLog(`触发事件: ${evt}`);
            gameState.processRoomConsequences();
            gameState.moveNextRoom();
        }
        refresh();
    };

    const attack = () => {
        gameState.playerAttack();
        if (snapshot.combat.monsterHp <= 0) {
            gameState.addLog(`击败 ${snapshot.combat.monsterName}`);
            gameState.processRoomConsequences();
            gameState.moveNextRoom();
            setStage("explore");
        } else {
            snapshot.player.hp = Math.max(0, snapshot.player.hp - snapshot.combat.monsterAtk);
            gameState.addLog(`${snapshot.combat.monsterName} 反击 ${snapshot.combat.monsterAtk}`);
            if (snapshot.player.hp <= 0) {
                gameState.addLog("你已阵亡，本轮结束");
                setStage("menu");
            }
        }
        refresh();
    };

    return (
        <main className="shell">
            <section className="left-panel">
                <header className="panel-title">FalconCrypt Web Prototype</header>
                <GameCanvas dangerLevel={dangerLevel} />
                <div className="actions">
                    {stage === "menu" && <button onClick={startNewRun}>开始冒险</button>}
                    {stage === "character" &&
                        charOptions.map((c, i) => (
                            <button key={c[0]} onClick={() => confirmCharacter(i)}>
                                选择 {c[0]} / {c[6]}
                            </button>
                        ))}
                    {stage === "explore" && <button onClick={enterRoom}>进入房间</button>}
                    {stage === "combat" && <button onClick={attack}>普通攻击</button>}
                </div>
            </section>

            <section className="right-panel">
                <header className="panel-title">状态面板</header>
                <div className="stats-grid">
                    <span>阶段</span>
                    <strong>{stage}</strong>
                    <span>角色</span>
                    <strong>{snapshot.player.character?.[0] ?? "-"}</strong>
                    <span>HP</span>
                    <strong>{snapshot.player.hp}</strong>
                    <span>防御</span>
                    <strong>
                        {snapshot.player.defense}/{snapshot.player.defenseMax}
                    </strong>
                    <span>金币</span>
                    <strong>{snapshot.player.coin}</strong>
                    <span>层数</span>
                    <strong>{snapshot.dungeon.floor}</strong>
                    <span>房间</span>
                    <strong>{snapshot.dungeon.roomIdx}</strong>
                    <span>怪物</span>
                    <strong>{snapshot.combat.monsterName || "-"}</strong>
                    <span>怪物 HP</span>
                    <strong>{snapshot.combat.monsterHp || 0}</strong>
                </div>

                <header className="panel-title mt">战斗/事件日志</header>
                <div className="log-box">
                    {snapshot.logs.slice(-14).map((line, idx) => (
                        <div key={`${line}-${idx}`}>{line}</div>
                    ))}
                </div>
            </section>
        </main>
    );
}
