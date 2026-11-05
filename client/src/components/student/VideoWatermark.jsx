import React, { useState, useEffect } from "react";

/**
 * VideoWatermark
 * Discreetly overlays authenticated student name, email, and EduVibe branding.
 * Moves periodically between 4 corner positions to deter screen recording.
 */
const CORNER_POSITIONS = [
  "top-3 left-3 text-left",
  "top-3 right-3 text-right",
  "bottom-12 right-3 text-right",
  "bottom-12 left-3 text-left",
];

export default function VideoWatermark({ watermarkText }) {
  const [positionIndex, setPositionIndex] = useState(0);

  useEffect(() => {
    // Shift position every 20 seconds
    const interval = setInterval(() => {
      setPositionIndex((prev) => (prev + 1) % CORNER_POSITIONS.length);
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  if (!watermarkText) return null;

  return (
    <div
      aria-hidden="true"
      className={`absolute z-20 pointer-events-none select-none transition-all duration-1000 ease-in-out ${CORNER_POSITIONS[positionIndex]}`}
    >
      <div className="bg-black/45 backdrop-blur-[2px] text-white/65 text-[10px] sm:text-xs font-mono px-2.5 py-1 rounded border border-white/10 shadow-xs max-w-[280px] sm:max-w-md truncate">
        {watermarkText}
      </div>
    </div>
  );
}

