'use client';
import { useEffect, useState } from 'react';

export default function ConfettiOnLoad() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  const pieces = Array.from({ length: 40 }, (_, i) => i);
  const colors = ['#d4a574', '#374187', '#10b981', '#fbbf24', '#ec4899', '#06b6d4'];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const dur = 2.5 + Math.random() * 2;
        const color = colors[i % colors.length];
        const size = 8 + Math.random() * 8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', top: -20, left: `${left}%`,
              width: size, height: size * 0.4, background: color, borderRadius: 2,
              animation: `fall ${dur}s ${delay}s ease-in forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
