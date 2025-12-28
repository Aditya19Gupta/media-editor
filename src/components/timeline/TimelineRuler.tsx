import React from 'react';
import { formatTime } from '@/utils/timelineUtils';

interface TimelineRulerProps {
  duration: number;
  zoom: number;
  timelineWidth: number;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({ duration, zoom, timelineWidth }) => {
  // Extend the duration by 5 seconds for the ruler
  const extendedDuration = duration + 5;
  const extendedWidth = extendedDuration * zoom;
  
  // Calculate ticks - one every 50px
  const ticksCount = Math.ceil(extendedWidth / 50);
  const tickInterval = 50 / zoom; // Time interval between ticks in seconds
  
  const ticks = Array.from({ length: ticksCount }, (_, i) => {
    const time = i * tickInterval;
    const majorTick = i % 2 === 0;
    
    return (
      <div 
        key={i} 
        className={`absolute ${majorTick ? 'h-5 border-l-2' : 'h-3 border-l'} border-timeline-ruler`} 
        style={{ left: `${i * 50}px` }}
      >
        {majorTick && (
          <span className="text-xs text-timeline-ruler absolute -translate-x-1/2 mt-5">
            {formatTime(time)}
          </span>
        )}
      </div>
    );
  });
  
  return (
    <div 
      className="h-10 relative bg-timeline-bg border-b border-gray-700 overflow-hidden"
      style={{ width: `${extendedWidth}px` }}
    >
      {ticks}
    </div>
  );
};

export default TimelineRuler;