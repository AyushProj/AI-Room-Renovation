"use client";

import { useRef, useState } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
}

export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeAlt = "Original room",
  afterAlt = "Renovated room",
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [position, setPosition] = useState(50); // percent from left

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }

  function handlePointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }

  function handlePointerUp() {
    draggingRef.current = false;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 3));
    if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 3));
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden bg-gray-100"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* After image, full width, underneath */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={afterAlt}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Before image, clipped by position via clip-path so it never
          needs to know the container's pixel width */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeUrl}
        alt={beforeAlt}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        draggable={false}
      />

      {/* Divider line */}
      <div
        className="pointer-events-none absolute top-0 h-full w-0.5 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.25)]"
        style={{ left: `${position}%` }}
      />

      {/* Drag handle */}
      <button
        role="slider"
        aria-label="Before/after comparison slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        style={{ left: `${position}%` }}
        className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-gray-900 shadow-md ring-1 ring-black/5 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-900"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            d="M8 7l-5 5 5 5M16 7l5 5-5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
        After
      </span>
    </div>
  );
}