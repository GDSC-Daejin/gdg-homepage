"use client";

import { useEffect, useRef } from "react";

const PIKACHU = "/pokedex/effects/coin-pikachu.png";
const MONSTER_BALL = "/pokedex/effects/coin-monster-ball.png";

function drawCoin(context: CanvasRenderingContext2D, face: HTMLImageElement) {
  context.clearRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const distance = Math.hypot(x - 15.5, y - 15.5);
    if (distance > 15) continue;
    context.fillStyle = distance > 13 ? y > 15 ? "#70400f" : "#f5c43d" : distance > 11 ? "#bd7a1c" : x + y < 24 ? "#ffe27a" : "#e8af2f";
    context.fillRect(x, y, 1, 1);
  }
  if (face.complete && face.naturalWidth) context.drawImage(face, 5, 5, 22, 22);
}

function loadFace(src: string) {
  return new Promise<HTMLImageElement>((resolve) => {
    const face = new Image();
    face.onload = () => resolve(face);
    face.onerror = () => resolve(face);
    face.src = src;
  });
}

export function BattleCoin({ heads, className }: { heads: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.imageSmoothingEnabled = false;
    let cancelled = false;
    let frame = 0;

    void Promise.all([loadFace(PIKACHU), loadFace(MONSTER_BALL)]).then(([pikachu, monsterBall]) => {
      if (cancelled) return;
      const faces = [monsterBall, pikachu];
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        drawCoin(context, faces[Number(heads)]);
        return;
      }

      const gravity = 0.0007;
      const launchVelocity = -0.25;
      const spin = 900;
      const duration = -2 * launchVelocity / gravity;
      const start = performance.now();
      const toss = (now: number) => {
        const elapsed = Math.min(now - start, duration);
        const y = launchVelocity * elapsed + gravity * elapsed * elapsed / 2;
        const rotation = spin * elapsed / duration;
        const shownHeads = Math.floor(rotation / 180) % 2 === 0 ? !heads : heads;
        drawCoin(context, faces[Number(shownHeads)]);
        canvas.style.transform = `translateY(${y}px) rotateX(${rotation}deg) scaleY(${Math.max(.12, Math.abs(Math.cos(rotation * Math.PI / 180)))})`;
        if (elapsed < duration) frame = window.requestAnimationFrame(toss);
        else {
          drawCoin(context, faces[Number(heads)]);
          canvas.style.transform = "translateY(0) rotateX(0) scaleY(1)";
        }
      };

      frame = window.requestAnimationFrame(toss);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [heads]);

  return <canvas ref={canvasRef} width="32" height="32" aria-hidden className={className} />;
}
