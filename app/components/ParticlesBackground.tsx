"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number; // alpha
};

export default function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    // --------- TUNING (ajústalo a tu gusto) ---------
    const BASE_COUNT = 60;
    const LINK_DIST = 140;
    const SPEED = 0.25;

    // Glow / color
    const DOT_RGB = "45, 212, 191";      // teal
    const GLOW_RGB = "52, 211, 153";     // emerald

    const DOT_ALPHA_MULT = 0.85;         // más visible
    const DOT_GLOW_MULT = 0.65;          // intensidad del glow (puntos)
    const DOT_SHADOW_BLUR = 16;          // 10–18 buen rango

    const LINE_ALPHA_MULT = 0.22;        // más visible que antes (0.10)
    const LINE_SHADOW_BLUR = 8;          // glow en líneas (sutil)
    // -----------------------------------------------

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);

      canvas.style.width = "100vw";
      canvas.style.height = "100vh";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      particlesRef.current = Array.from({ length: BASE_COUNT }).map(() => ({
        x: rand(0, window.innerWidth),
        y: rand(0, window.innerHeight),
        vx: rand(-SPEED, SPEED),
        vy: rand(-SPEED, SPEED),
        r: rand(0.9, 2.1),
        a: rand(0.25, 0.8),
      }));
    };

    const drawDot = (p: Particle) => {
      // Halo suave (radial) + punto sólido + glow (shadow)
      const haloR = p.r * 4.2;

      // Halo (sin shadow para que no “reviente”)
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      g.addColorStop(0, `rgba(${GLOW_RGB}, ${p.a * 0.20})`);
      g.addColorStop(1, `rgba(${GLOW_RGB}, 0)`);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Punto con glow
      ctx.save();
      ctx.shadowBlur = DOT_SHADOW_BLUR;
      ctx.shadowColor = `rgba(${GLOW_RGB}, ${p.a * DOT_GLOW_MULT})`;
      ctx.fillStyle = `rgba(${DOT_RGB}, ${p.a * DOT_ALPHA_MULT})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const step = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const pts = particlesRef.current;

      // Partículas
      for (const p of pts) {
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
        }

        if (p.x < -20) p.x = window.innerWidth + 20;
        if (p.x > window.innerWidth + 20) p.x = -20;
        if (p.y < -20) p.y = window.innerHeight + 20;
        if (p.y > window.innerHeight + 20) p.y = -20;

        drawDot(p);
      }

      // Líneas (con glow sutil)
      ctx.save();
      ctx.lineWidth = 1;

      // glow en líneas
      ctx.shadowBlur = LINE_SHADOW_BLUR;
      ctx.shadowColor = `rgba(${GLOW_RGB}, 0.25)`;

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * LINE_ALPHA_MULT;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${DOT_RGB}, ${alpha})`;
            ctx.stroke();
          }
        }
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(step);
    };

    const onResize = () => {
      resize();
      init();
    };

    resize();
    init();
    rafRef.current = requestAnimationFrame(step);
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none -z-10 opacity-90"
    />
  );
}
