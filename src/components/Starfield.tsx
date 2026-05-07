"use client";

import React, { useEffect, useRef } from "react";

const Starfield = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let stars: { x: number; y: number; radius: number; vx: number; vy: number; color: string; opacity: number; opacitySpeed: number }[] = [];

    // Deep space colors for stars (whites, light blues, subtle pinks/purples)
    const colors = ["#ffffff", "#e0f2fe", "#c7d2fe", "#fbcfe8", "#e9d5ff"];

    const initCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      stars = [];
      const numStars = Math.floor((canvas.width * canvas.height) / 800); // Dense starfield
      
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.5,
          vx: (Math.random() - 0.5) * 0.05, // very slow drift
          vy: (Math.random() - 0.5) * 0.05,
          color: colors[Math.floor(Math.random() * colors.length)],
          opacity: Math.random(),
          opacitySpeed: (Math.random() * 0.01) + 0.002, // Twinkling speed
        });
      }
    };

    const drawStars = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 1. Draw solid dark background
      ctx.fillStyle = "#02000a"; // Extremely dark deep blue/black
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Nebula/Milky Way Glows
      // Center-ish purple/blue massive glow
      const nebula1 = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.5, 0,
        canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.6
      );
      nebula1.addColorStop(0, "rgba(45, 10, 80, 0.4)");
      nebula1.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Diagonal pinkish glow
      const nebula2 = ctx.createRadialGradient(
        canvas.width * 0.8, canvas.height * 0.2, 0,
        canvas.width * 0.8, canvas.height * 0.2, canvas.width * 0.5
      );
      nebula2.addColorStop(0, "rgba(80, 20, 60, 0.3)");
      nebula2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Draw Stars
      stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        
        // Twinkle logic
        star.opacity += star.opacitySpeed;
        if (star.opacity >= 1 || star.opacity <= 0.1) {
          star.opacitySpeed = -star.opacitySpeed;
        }

        // Apply opacity to the hex color
        const alpha = Math.floor(star.opacity * 255).toString(16).padStart(2, '0');
        ctx.fillStyle = `${star.color}${alpha}`;
        
        // Glow for stars
        ctx.shadowBlur = 3;
        ctx.shadowColor = star.color;
        
        ctx.fill();
        ctx.closePath();

        // Drift
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around edges
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;
      });

      animationFrameId = requestAnimationFrame(drawStars);
    };

    window.addEventListener("resize", initCanvas);
    initCanvas();
    drawStars();

    return () => {
      window.removeEventListener("resize", initCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
};

export default Starfield;
