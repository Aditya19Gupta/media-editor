"use client";

import useEditorStore from '@/store/editorStore';
import { TIMELINE_SCALE_FACTOR } from '@/types';

export default function TimelineScrubber() {
  const { currentTime, zoom } = useEditorStore();
  
  // Calculate position based on current time and zoom level
  const position = currentTime * TIMELINE_SCALE_FACTOR * zoom;
  
  return (
    <div 
      className="absolute top-0 h-full w-0.5 bg-red-500 z-10 pointer-events-none"
      style={{ left: `${position}px` }}
    >
      {/* Playhead triangle */}
      <div 
        className="w-0 h-0 absolute -left-1.5 -top-1"
        style={{ 
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '6px solid #ef4444', // Same color as the line
        }}
      />
      
      {/* Current time */}
      <div 
        className="absolute -left-4 -top-8 text-xs px-1 py-0.5 bg-card border rounded"
        style={{ width: '40px' }}
      >
        {formatTime(currentTime)}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}