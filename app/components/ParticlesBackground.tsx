"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

export default function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return;

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let isMobile = mobileQuery.matches;
    let prefersReduced = reducedMotionQuery.matches;
    let isVisible = !document.hidden;
    let lastFrame = 0;

    const DOT_RGB = "45, 212, 191";
    const GLOW_RGB = "52, 211, 153";

    const getConfig = () => ({
      count: prefersReduced ? 12 : isMobile ? 20 : 60,
      linkDist: isMobile ? 105 : 140,
      speed: prefersReduced ? 0 : isMobile ? 0.14 : 0.25,
      targetFps: isMobile ? 30 : 60,
      dotShadowBlur: isMobile ? 0 : 16,
      lineShadowBlur: isMobile ? 0 : 8,
      lineAlpha: isMobile ? 0.11 : 0.22,
      drawHalo: !isMobile,
      drawLinks: !prefersReduced,
    });

    const rand = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const resize = () => {
      isMobile = mobileQuery.matches;

      // Limitar DPR reduce muchísimo el número de píxeles que el canvas
      // necesita redibujar en teléfonos Android de alta densidad.
      const maxDpr = isMobile ? 1.25 : 2;
      const dpr = Math.min(
        Math.max(1, window.devicePixelRatio || 1),
        maxDpr,
      );

      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      const config = getConfig();

      particlesRef.current = Array.from({ length: config.count }).map(
        () => ({
          x: rand(0, window.innerWidth),
          y: rand(0, window.innerHeight),
          vx: rand(-config.speed, config.speed),
          vy: rand(-config.speed, config.speed),
          r: isMobile ? rand(0.8, 1.6) : rand(0.9, 2.1),
          a: isMobile ? rand(0.2, 0.55) : rand(0.25, 0.8),
        }),
      );
    };

    const drawDot = (p: Particle, config: ReturnType<typeof getConfig>) => {
      if (config.drawHalo) {
        const haloR = p.r * 4.2;
        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          haloR,
        );

        gradient.addColorStop(0, `rgba(${GLOW_RGB}, ${p.a * 0.2})`);
        gradient.addColorStop(1, `rgba(${GLOW_RGB}, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      if (config.dotShadowBlur > 0) {
        ctx.save();
        ctx.shadowBlur = config.dotShadowBlur;
        ctx.shadowColor = `rgba(${GLOW_RGB}, ${p.a * 0.65})`;
        ctx.fillStyle = `rgba(${DOT_RGB}, ${p.a * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.fillStyle = `rgba(${DOT_RGB}, ${p.a * 0.72})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    };

    const renderFrame = () => {
      const config = getConfig();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const pts = particlesRef.current;

      for (const p of pts) {
        if (!prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
        }

        if (p.x < -20) p.x = window.innerWidth + 20;
        if (p.x > window.innerWidth + 20) p.x = -20;
        if (p.y < -20) p.y = window.innerHeight + 20;
        if (p.y > window.innerHeight + 20) p.y = -20;

        drawDot(p, config);
      }

      if (!config.drawLinks) return;

      ctx.save();
      ctx.lineWidth = isMobile ? 0.7 : 1;

      if (config.lineShadowBlur > 0) {
        ctx.shadowBlur = config.lineShadowBlur;
        ctx.shadowColor = `rgba(${GLOW_RGB}, 0.25)`;
      }

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distanceSquared = dx * dx + dy * dy;
          const maxDistanceSquared = config.linkDist * config.linkDist;

          // Evita calcular sqrt para parejas que ya sabemos que están lejos.
          if (distanceSquared >= maxDistanceSquared) continue;

          const distance = Math.sqrt(distanceSquared);
          const alpha =
            (1 - distance / config.linkDist) * config.lineAlpha;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${DOT_RGB}, ${alpha})`;
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const step = (timestamp: number) => {
      if (!isVisible) return;

      const config = getConfig();
      const frameInterval = 1000 / config.targetFps;

      if (timestamp - lastFrame >= frameInterval) {
        lastFrame = timestamp;
        renderFrame();
      }

      rafRef.current = requestAnimationFrame(step);
    };

    const restartAnimation = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      if (isVisible) {
        lastFrame = 0;
        rafRef.current = requestAnimationFrame(step);
      }
    };

    const onResize = () => {
      resize();
      init();
    };

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
      restartAnimation();
    };

    const onMediaChange = () => {
      isMobile = mobileQuery.matches;
      prefersReduced = reducedMotionQuery.matches;
      resize();
      init();
      restartAnimation();
    };

    resize();
    init();
    restartAnimation();

    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    mobileQuery.addEventListener?.("change", onMediaChange);
    reducedMotionQuery.addEventListener?.("change", onMediaChange);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      mobileQuery.removeEventListener?.("change", onMediaChange);
      reducedMotionQuery.removeEventListener?.("change", onMediaChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 opacity-70 sm:opacity-90"
    />
  );
}
