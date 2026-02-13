import React from 'react';

interface CircularTimerProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  glow?: boolean;
  children?: React.ReactNode;
}

const CircularTimer: React.FC<CircularTimerProps> = ({
  progress,
  size = 280,
  strokeWidth = 12,
  color = '#10b981',
  trackColor = '#334155',
  glow = false,
  children,
}) => {
  const center = size / 2;
  // Reduce radius slightly to account for glow spilling out if enabled
  // Stroke is centered on radius. Outer edge is radius + strokeWidth/2.
  // We want outer edge + glow spread < size/2.
  // Glow spread approx 10px + stroke/2 (6) = 16px. Safety margin 20px if glow is on.
  const padding = glow ? 12 : 0;
  const radius = (size / 2) - (strokeWidth / 2) - padding;
  const circumference = 2 * Math.PI * radius;
  // Ensure progress is clamped 0-1 to prevent visual artifacts
  const safeProgress = Math.max(0, Math.min(1, progress));
  const offset = circumference * (1 - safeProgress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full overflow-visible">
        {glow && (
            <defs>
                <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
        )}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-30"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter={glow ? "url(#glow-filter)" : undefined}
          style={{ 
            transition: 'stroke 0.3s ease', // Only transition color, not dashoffset (avoids jitter)
            willChange: 'stroke-dashoffset'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {children}
      </div>
    </div>
  );
};

export default CircularTimer;