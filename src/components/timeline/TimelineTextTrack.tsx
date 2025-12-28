"use client";

import { useRef, useState } from 'react';
import useEditorStore from '@/store/editorStore';
import { useTimeline } from '@/contexts/TimelineContext';
import { TIMELINE_SCALE_FACTOR, TextOverlay } from '@/types';
import { Type, Eye, EyeOff } from 'lucide-react';

export default function TimelineTextTrack() {
  const { 
    textOverlays, 
    selectedOverlayId, 
    selectOverlay,
    updateTextOverlay,
    toggleOverlayVisibility,
    zoom
  } = useEditorStore();

  // Use Timeline's duration and currentTime for better sync
  const { duration, currentTime } = useTimeline();

  const [dragState, setDragState] = useState<{
    type: 'move' | 'resizeStart' | 'resizeEnd';
    overlayId: string;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
  } | null>(null);

  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (
    e: React.MouseEvent, 
    overlay: TextOverlay,
    type: 'move' | 'resizeStart' | 'resizeEnd'
  ) => {
    e.stopPropagation();
    
    selectOverlay(overlay.id);
    
    setDragState({
      type,
      overlayId: overlay.id,
      startX: e.clientX < 0 ? 0 : e.clientX,
      originalStartTime: overlay.startTime,
      originalEndTime: overlay.endTime
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const pixelsPerSecond = TIMELINE_SCALE_FACTOR * zoom;
    const deltaX = e.clientX - dragState.startX;
    const deltaTime = deltaX / pixelsPerSecond;
    
    const overlay = textOverlays.find(o => o.id === dragState.overlayId);
    if (!overlay) return;
    
    let newStartTime = dragState.originalStartTime;
    let newEndTime = dragState.originalEndTime;
    
    if (dragState.type === 'move') {
      newStartTime = Math.max(0, dragState.originalStartTime + deltaTime);
      newEndTime = Math.min(duration, dragState.originalEndTime + deltaTime);
      
      // Constrain the entire clip to stay within the timeline
      if (newEndTime > duration) {
        const overshoot = newEndTime - duration;
        newStartTime -= overshoot;
        newEndTime = duration;
      }
      
      if (newStartTime < 0) {
        newEndTime += Math.abs(newStartTime);
        newStartTime = 0;
      }
    } 
    else if (dragState.type === 'resizeStart') {
      newStartTime = Math.max(0, Math.min(dragState.originalEndTime - 0.5, dragState.originalStartTime + deltaTime));
    } 
    else if (dragState.type === 'resizeEnd') {
      newEndTime = Math.max(dragState.originalStartTime + 0.5, Math.min(duration, dragState.originalEndTime + deltaTime));
    }
    
    updateTextOverlay(dragState.overlayId, {
      startTime: newStartTime < 0 ? 0 : newStartTime,
      endTime: newEndTime
    });
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Snap to a grid (optional)
  const snapToGrid = (time: number, gridSize: number = 0.5): number => {
    return Math.round(time / gridSize) * gridSize;
  };

  return (
    <div className="relative">
      {/* Track Header with Icon and Label */}
      <div className="absolute left-[-60px] w-[60px] h-[60px] flex flex-col items-center justify-center border-r border-gray-700 bg-gradient-to-br from-amber-950/40 to-orange-950/40">
        <div className="flex items-center text-xs text-amber-300">
          <Type className="h-4 w-4 mr-1" />
        </div>
        <div className="text-xs text-center mt-1 text-amber-200">
          Text
        </div>
      </div>

      {/* Track Content Area */}
      <div 
        ref={trackRef}
        className="h-[60px] relative border-b border-gray-700 bg-gradient-to-r from-amber-950/20 to-orange-950/20 hover:from-amber-950/30 hover:to-orange-950/30 transition-colors duration-200"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Track Grid Lines */}
        {/* <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-gray-600/30"
              style={{ left: `${i * TIMELINE_SCALE_FACTOR * zoom}px` }}
            />
          ))}
        </div> */}
        
        {/* Text Overlay Clips */}
        {textOverlays.map((overlay) => {
          const left = overlay.startTime * TIMELINE_SCALE_FACTOR * zoom;
          const width = Math.max(50, (overlay.endTime - overlay.startTime) * TIMELINE_SCALE_FACTOR * zoom);
          const isActive = currentTime >= overlay.startTime && currentTime <= overlay.endTime;
          const isSelected = overlay.id === selectedOverlayId;
          
          return (
            <div
              key={overlay.id}
              className={`absolute rounded-md cursor-move transition-all duration-200 border-2 shadow-lg ${
                isSelected 
                  ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105 z-10' 
                  : 'border-amber-600/60 hover:border-amber-500'
              } ${overlay.visible ? '' : 'opacity-40'} ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30'
                  : 'bg-gradient-to-r from-amber-600/80 to-orange-600/80'
              }`}
              style={{
                left: `${left}px`,
                width: `${width}px`,
                top: '8px',
                height: '44px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectOverlay(overlay.id);
              }}
              onMouseDown={(e) => handleMouseDown(e, overlay, 'move')}
            >
              {/* Clip Header */}
              <div className="absolute top-0 left-0 right-0 h-5 px-2 flex items-center justify-between text-[10px] text-white bg-black/30 rounded-t-md">
                <div className="flex items-center truncate max-w-[70%]">
                  <Type className="h-3 w-3 mr-1" />
                  <span className="truncate font-medium">
                    {overlay.content || "Text Overlay"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Visibility Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOverlayVisibility(overlay.id);
                    }}
                    className="hover:bg-white/20 rounded p-0.5 transition-colors"
                    title={overlay.visible ? "Hide" : "Show"}
                  >
                    {overlay.visible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                  </button>
                  {/* Active Indicator */}
                  {isActive && (
                    <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  )}
                </div>
              </div>

              {/* Clip Content Preview */}
              <div className="absolute bottom-1 left-2 right-2 h-5 flex items-center">
                <div 
                  className="text-xs truncate text-white/90 font-medium"
                  style={{
                    fontFamily: overlay.style.fontFamily,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                  }}
                >
                  "{overlay.content}"
                </div>
              </div>

              {/* Duration Display */}
              <div className="absolute bottom-1 right-2 text-[9px] text-white/70 bg-black/40 px-1 rounded">
                {((overlay.endTime - overlay.startTime)).toFixed(1)}s
              </div>
              
              {/* Resize Handles */}
              <div 
                className="absolute left-0 top-0 w-2 h-full cursor-w-resize bg-amber-400/20 hover:bg-amber-400/40 transition-colors rounded-l-md"
                onMouseDown={(e) => handleMouseDown(e, overlay, 'resizeStart')}
                title="Resize start"
              />
              <div 
                className="absolute right-0 top-0 w-2 h-full cursor-e-resize bg-amber-400/20 hover:bg-amber-400/40 transition-colors rounded-r-md"
                onMouseDown={(e) => handleMouseDown(e, overlay, 'resizeEnd')}
                title="Resize end"
              />
            </div>
          );
        })}

        {/* Drop Zone Indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-200">
          <div className="bg-amber-500/20 border-2 border-dashed border-amber-400/50 rounded-lg px-4 py-2 text-xs text-amber-200">
            Text Track - Drop or click "Add Text" to create captions
          </div>
        </div>
      </div>
    </div>
  );
}