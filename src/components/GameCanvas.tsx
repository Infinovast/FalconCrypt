import { useEffect, useRef } from "react";

type Props = {
    dangerLevel: number;
};

export function GameCanvas({ dangerLevel }: Props): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let raf = 0;
        let t = 0;

        const render = () => {
            t += 0.02;
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            const pulse = Math.sin(t) * 0.5 + 0.5;
            const bgR = Math.floor(18 + dangerLevel * 12 + pulse * 10);
            const bgG = Math.floor(20 + pulse * 16);
            const bgB = Math.floor(38 + pulse * 18);
            ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
            ctx.fillRect(0, 0, w, h);

            // Pixel stars/paricles.
            for (let i = 0; i < 120; i += 1) {
                const x = (i * 37 + Math.floor(t * 100)) % w;
                const y = (i * 59 + Math.floor(t * 60)) % h;
                const a = ((i + Math.floor(t * 20)) % 10) / 10;
                ctx.fillStyle = `rgba(197, 255, 250, ${a})`;
                ctx.fillRect(x, y, 2, 2);
            }

            // Main crystal block.
            const centerX = w / 2;
            const centerY = h / 2;
            const size = 48 + pulse * 12;
            ctx.fillStyle = "#42f7c8";
            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
            ctx.strokeStyle = "#c9fff8";
            ctx.lineWidth = 3;
            ctx.strokeRect(centerX - size / 2, centerY - size / 2, size, size);

            raf = requestAnimationFrame(render);
        };

        raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [dangerLevel]);

    return <canvas ref={canvasRef} width={560} height={320} className="game-canvas" />;
}
