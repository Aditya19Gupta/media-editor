interface TimelineRulerProps {
  duration: number;
  zoom: number;
}

import { TIMELINE_SCALE_FACTOR } from '@/types';

export default function TimelineRuler({ duration, zoom }: TimelineRulerProps) {
  // Determine the appropriate interval based on zoom level
  const getIntervalSpacing = () => {
    if (zoom >= 2) return 1; // 1-second intervals when zoomed in
    if (zoom >= 1) return 5; // 5-second intervals at normal zoom
    return 10; // 10-second intervals when zoomed out
  };

  const interval = getIntervalSpacing();
  const intervals = [];

  // Calculate number of intervals
  const numIntervals = Math.ceil(duration / interval);

  // Generate intervals
  for (let i = 0; i <= numIntervals; i++) {
    const time = i * interval;
    if (time > duration) break;
    
    intervals.push({
      time,
      position: time * TIMELINE_SCALE_FACTOR * zoom,
      label: formatTimeLabel(time),
      isMajor: true,
    });

    // Add minor ticks if zoom level is high enough
    if (zoom >= 1 && interval > 1) {
      for (let j = 1; j < interval; j++) {
        const minorTime = time + j;
        if (minorTime > duration) break;
        
        intervals.push({
          time: minorTime,
          position: minorTime * TIMELINE_SCALE_FACTOR * zoom,
          label: '',
          isMajor: false,
        });
      }
    }
  }

  return (
    <div className="h-6 border-b relative overflow-hidden">
      {intervals.map(({ time, position, label, isMajor }, index) => (
        <div
          key={`${time}-${index}`}
          className="absolute top-0 h-6 flex flex-col items-center"
          style={{ left: `${position}px` }}
        >
          {isMajor ? (
            <>
              <span className="text-xs">{label}</span>
              <span className="w-0.5 h-2 bg-border mt-auto"></span>
            </>
          ) : (
            <span className="w-0.5 h-1 bg-border mt-auto"></span>
          )}
        </div>
      ))}
    </div>
  );
}

function formatTimeLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}