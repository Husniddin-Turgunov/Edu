"use client";

import { useEffect, useRef } from "react";

export default function Animated3DBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Faqat KO'K oila — yagona fon uyg'unligi uchun (blue harmony)
    const shapes = [
      { type: 'cube', color: 'from-blue-400 via-blue-500 to-indigo-500', size: 80, speed: 18, opacity: 0.16 },
      { type: 'sphere', color: 'from-sky-400 via-blue-500 to-indigo-500', size: 100, speed: 22, opacity: 0.14 },
      { type: 'pyramid', color: 'from-indigo-400 via-blue-500 to-sky-500', size: 90, speed: 20, opacity: 0.15 },
      { type: 'cube', color: 'from-blue-400 via-indigo-500 to-blue-600', size: 70, speed: 24, opacity: 0.15 },
      { type: 'sphere', color: 'from-cyan-400 via-sky-500 to-blue-500', size: 110, speed: 19, opacity: 0.12 },
      { type: 'pyramid', color: 'from-indigo-400 via-blue-500 to-cyan-500', size: 85, speed: 21, opacity: 0.15 },
      { type: 'cube', color: 'from-sky-400 via-blue-500 to-indigo-500', size: 75, speed: 23, opacity: 0.14 },
      { type: 'sphere', color: 'from-blue-300 via-sky-400 to-blue-500', size: 95, speed: 17, opacity: 0.13 },
      { type: 'pyramid', color: 'from-cyan-400 via-blue-500 to-indigo-500', size: 88, speed: 25, opacity: 0.13 },
      { type: 'cube', color: 'from-indigo-300 via-blue-400 to-sky-500', size: 82, speed: 20, opacity: 0.14 },
      { type: 'sphere', color: 'from-sky-400 via-blue-500 to-indigo-600', size: 92, speed: 18, opacity: 0.12 },
      { type: 'pyramid', color: 'from-blue-400 via-indigo-500 to-blue-600', size: 78, speed: 22, opacity: 0.15 },
    ];

    shapes.forEach((shape, index) => {
      const element = document.createElement('div');
      element.className = `absolute rounded-2xl bg-gradient-to-br ${shape.color}`;
      element.style.width = `${shape.size}px`;
      element.style.height = `${shape.size}px`;
      element.style.left = `${Math.random() * 100}%`;
      element.style.top = `${Math.random() * 100}%`;
      element.style.opacity = shape.opacity.toString();
      element.style.animation = `float3d ${shape.speed}s ease-in-out infinite`;
      element.style.animationDelay = `${index * 0.3}s`;
      element.style.transform = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`;
      element.style.transformStyle = 'preserve-3d';
      element.style.boxShadow = `0 20px 40px -10px rgba(0, 0, 0, 0.15)`;
      
      // Add multiple layers for 3D depth effect
      const layers = ['from-black/10', 'from-black/5', 'from-transparent'];
      layers.forEach((layer, i) => {
        const depthLayer = document.createElement('div');
        depthLayer.className = `absolute inset-0 bg-gradient-to-t ${layer} rounded-2xl`;
        depthLayer.style.transform = `translateZ(${(i + 1) * 5}px)`;
        element.appendChild(depthLayer);
      });
      
      // Add inner glow
      const glow = document.createElement('div');
      glow.className = 'absolute inset-2 rounded-xl bg-gradient-to-br from-white/20 to-transparent';
      element.appendChild(glow);
      
      container.appendChild(element);
    });

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    />
  );
}