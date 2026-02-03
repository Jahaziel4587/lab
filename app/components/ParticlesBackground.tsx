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

    // Ajusta densidad aquí
    const BASE_COUNT = 60;
    const LINK_DIST = 140;
    const SPEED = 0.25;

    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const resize = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      // Tamaño real del canvas en pixeles físicos
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);

      // Tamaño visual fijo al viewport (no al contenedor)
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";

      // Dibujar en coords (CSS px)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      particlesRef.current = Array.from({ length: BASE_COUNT }).map(() => ({
        x: rand(0, window.innerWidth),
        y: rand(0, window.innerHeight),
        vx: rand(-SPEED, SPEED),
        vy: rand(-SPEED, SPEED),
        r: rand(0.8, 2.0),
        a: rand(0.25, 0.8),
      }));
    };

    const step = () => {
      // limpiar en unidades CSS (por el setTransform(dpr,...))
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const pts = particlesRef.current;

      // Partículas
      for (const p of pts) {
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
        }

        // wrap suave en bordes
        if (p.x < -20) p.x = window.innerWidth + 20;
        if (p.x > window.innerWidth + 20) p.x = -20;
        if (p.y < -20) p.y = window.innerHeight + 20;
        if (p.y > window.innerHeight + 20) p.y = -20;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45, 212, 191, ${p.a * 0.55})`;
        ctx.fill();
      }

      // Líneas
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.10;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(45, 212, 191, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    // ✅ usa una referencia estable para poder removerla
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
      // ✅ fixed para que NO crezca con la página, solo con el viewport
      className="fixed inset-0 pointer-events-none -z-10 opacity-80"
    />
  );
}
