"use client";
import React, { useRef, useEffect, useCallback } from 'react';
import { Clip, TrackType } from '@/types/clip';
import { calculateTimeFromPosition, formatTime, generateClipStyle } from '@/utils/timelineUtils';
import { cn } from '@/lib/utils';
import Waveform from '@/components/waveform/WaveFrom';
import { Trash2, Scissors, Copy, ClipboardPaste, Video, Music, Image, Type, VolumeX, Volume2 } from 'lucide-react';

interface TimelineClipProps {
  clip: Clip;
  zoom: number;
  onClipMove: (clipId: string, newStart: number, newTrack: number, newDuration?: number) => void;
  onClipSelect: (clipId: string) => void;
  onClipDelete: (clipId: string) => void;
  onClipSplit?: (clipId: string, splitTime: number) => void;
  onClipDuplicate?: (clipId: string) => void;
  onClipCopy?: (clipId: string) => void;
  onClipPaste?: () => void;
  onClipMute?: (clipId: string) => void;
  onEffectAdd?: (clipId: string, effectId: string) => void;
  onEffectRemove?: (clipId: string, effectId: string) => void;
  isSelected: boolean;
  canPaste?: boolean;
}

const TRACK_HEIGHT = 60;
const MIN_CLIP_DURATION = 0.1;

const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  zoom,
  onClipMove,
  onClipSelect,
  onClipDelete,
  onClipSplit,
  onClipDuplicate,
  onClipCopy,
  onClipPaste,
  onClipMute,
  onEffectAdd,
  onEffectRemove,
  isSelected,
  canPaste = false,
}) => {
  const dragRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [liveStart, setLiveStart] = React.useState<number | null>(null);
  const [liveTrack, setLiveTrack] = React.useState<number | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    splitPosition?: number;
    splitTime?: number;
  }>({ visible: false, x: 0, y: 0 });
  
  const interactionState = useRef({
    isResizing: false,
    direction: null as 'left' | 'right' | null,
    currentClip: { ...clip },
    dragOffset: { x: 0, y: 0 },
    tempStart: undefined as number | undefined,
    tempDuration: undefined as number | undefined,
    lastMoveTime: undefined as number | undefined
  });

  useEffect(() => {
    interactionState.current.currentClip = { ...clip };
  }, [clip]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const style = generateClipStyle(
    {
      ...clip,
      start: liveStart ?? clip.start,
      track: liveTrack ?? clip.track,
    },
    zoom
  );

  // Get clip background color based on track type
  const getClipBackgroundColor = () => {
    switch (clip.trackType) {
      case TrackType.VIDEO:
        return 'bg-blue-600/80';
      case TrackType.AUDIO:
        return clip.muted ? 'bg-gray-500/90' : 'bg-green-600/80';
      case TrackType.IMAGE:
        return 'bg-purple-600/80';
      case TrackType.TEXT:
        return 'bg-amber-600/80';
      default:
        return 'bg-gray-600';
    }
  };

  // Get clip icon based on track type
  const getClipIcon = () => {
    switch (clip.trackType) {
      case TrackType.VIDEO:
        return <Video className="h-3 w-3 mr-1" />;
      case TrackType.AUDIO:
        return <Music className="h-3 w-3 mr-1" />;
      case TrackType.IMAGE:
        return <Image className="h-3 w-3 mr-1" />;
      case TrackType.TEXT:
        return <Type className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };

  const handleResizeStart = (e: React.MouseEvent, direction: 'left' | 'right') => {
    e.stopPropagation();
    if (!dragRef.current?.parentElement) return;

    interactionState.current = {
      ...interactionState.current,
      isResizing: true,
      direction,
      currentClip: { ...interactionState.current.currentClip },
    };

    document.body.style.userSelect = 'none';
  };

  const handleResizeMouseMove = (e: MouseEvent) => {
    const { isResizing, direction, currentClip } = interactionState.current;
    if (!isResizing || !direction || !dragRef.current?.parentElement) return;

    e.preventDefault(); // Prevent text selection during resize
    
    // Throttle the expensive DOM calculations
    const now = Date.now();
    if (now - (interactionState.current.lastMoveTime || 0) < 16) return; // ~60fps throttling
    interactionState.current.lastMoveTime = now;
    
    const parent = dragRef.current.parentElement;
    const rect = parent.getBoundingClientRect();
    const scrollLeft = parent.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;

    // Calculate time position
    const timePosition = calculateTimeFromPosition(x, zoom);
    
    if (direction === 'left') {
      // Ensure we don't resize past the right edge
      if (timePosition >= currentClip.start + currentClip.duration - MIN_CLIP_DURATION) {
        return;
      }
      
      const newStart = Math.max(0, timePosition); // Don't allow negative start times
      const newDuration = currentClip.start + currentClip.duration - newStart;
      
      if (newDuration >= MIN_CLIP_DURATION) {
        // Store the new values but don't call onClipMove yet (for performance)
        interactionState.current.tempStart = newStart;
        interactionState.current.tempDuration = newDuration;
        
        // Update visual position immediately for smooth feedback
        setLiveStart(newStart);
      }
    } else if (direction === 'right') {
      // Ensure we don't resize before the left edge
      if (timePosition <= currentClip.start + MIN_CLIP_DURATION) {
        return;
      }
      
      const newDuration = Math.max(MIN_CLIP_DURATION, timePosition - currentClip.start);
      
      // Store the new values but don't call onClipMove yet (for performance)
      interactionState.current.tempDuration = newDuration;
    }
  };

  const handleResizeMouseUp = (e: MouseEvent) => {
    if (interactionState.current.isResizing) {
      e.stopPropagation();
      
      // Now call onClipMove with the final values (only once on mouseup)
      if (interactionState.current.tempStart !== undefined || interactionState.current.tempDuration !== undefined) {
        const finalStart = interactionState.current.tempStart ?? clip.start;
        const finalDuration = interactionState.current.tempDuration ?? clip.duration;
        onClipMove(clip.id, finalStart, clip.track, finalDuration);
      }
      
      // Reset interaction state
      interactionState.current.isResizing = false;
      interactionState.current.tempStart = undefined;
      interactionState.current.tempDuration = undefined;
      interactionState.current.lastMoveTime = undefined;
      setLiveStart(null);
      document.body.style.userSelect = '';
    }
  };

  useEffect(() => {
    // Add event listeners for resize operations
    const handleGlobalMouseMove = (e: MouseEvent) => handleResizeMouseMove(e);
    const handleGlobalMouseUp = (e: MouseEvent) => handleResizeMouseUp(e);
    
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.userSelect = '';
    };
  }, [zoom, clip.id, clip.start, clip.duration]); // Add clip properties to dependencies

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (interactionState.current.isResizing) {
      e.preventDefault();
      return;
    }

    const offsetX = e.nativeEvent.offsetX;
    const offsetY = e.nativeEvent.offsetY;
    interactionState.current.dragOffset = { x: offsetX, y: offsetY };
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify({
      clipId: clip.id,
      offsetX,
      trackHeight: TRACK_HEIGHT
    }));
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDragging || !dragRef.current) return;

    const parent = dragRef.current.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const scrollLeft = parent.scrollLeft || 0;
    const scrollTop = parent.scrollTop || 0;
    const { x: offsetX, y: offsetY } = interactionState.current.dragOffset;

    const x = e.clientX - rect.left + scrollLeft - offsetX;
    const y = e.clientY - rect.top + scrollTop - offsetY;

    const newStart = calculateTimeFromPosition(x, zoom);
    const newTrack = Math.max(0, Math.floor(y / TRACK_HEIGHT));

    setLiveStart(newStart);
    setLiveTrack(newTrack);
  };

  const handleDragEnd = () => {
    if (liveStart !== null && liveTrack !== null) {
      interactionState.current.currentClip = {
        ...clip,
        start: liveStart,
        track: liveTrack
      };
      onClipMove(clip.id, liveStart, liveTrack);
    }
    setIsDragging(false);
    setLiveStart(null);
    setLiveTrack(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!dragRef.current?.parentElement) return;
    
    const parent = dragRef.current.parentElement;
    const rect = parent.getBoundingClientRect();
    const scrollLeft = parent.scrollLeft || 0;
    const x = e.clientX - rect.left + scrollLeft;
    
    const splitTime = calculateTimeFromPosition(x, zoom);
    const splitPosition = x - (clip.start * zoom);
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      splitPosition,
      splitTime
    });
    
    if (!isSelected) {
      onClipSelect(clip.id);
    }
  };

  const handleAction = (action: () => void) => {
    action();
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  const handleDelete = () => handleAction(() => onClipDelete(clip.id));
  const handleSplit = () => contextMenu.splitTime && onClipSplit && handleAction(() => onClipSplit(clip.id, contextMenu.splitTime!));
  const handleDuplicate = () => onClipDuplicate && handleAction(() => onClipDuplicate(clip.id));
  const handleCopy = () => onClipCopy && handleAction(() => onClipCopy(clip.id));
  const handlePaste = () => onClipPaste && handleAction(() => onClipPaste());
  const handleMute = () => onClipMute && handleAction(() => onClipMute(clip.id));

  const handleEffectDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if dragging an effect
    try {
      const dragData = e.dataTransfer.getData("application/json");
      if (dragData) {
        const data = JSON.parse(dragData);
        if (data.type === "effect") {
          e.dataTransfer.dropEffect = "copy";
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }, []);

  const handleEffectDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const dragData = e.dataTransfer.getData("application/json");
      if (dragData) {
        const data = JSON.parse(dragData);
        if (data.type === "effect" && onEffectAdd) {
          onEffectAdd(clip.id, data.id);
        }
      }
    } catch (error) {
      console.error('Error handling effect drop:', error);
    }
  }, [clip.id, onEffectAdd]);

  const [isEffectDragOver, setIsEffectDragOver] = React.useState(false);

  const handleEffectDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dragData = e.dataTransfer.getData("application/json");
      if (dragData) {
        const data = JSON.parse(dragData);
        if (data.type === "effect") {
          setIsEffectDragOver(true);
        }
      }
    } catch (error) {
      // Ignore parsing errors for dragenter
    }
  }, []);

  const handleEffectDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only hide the indicator if we're leaving the clip entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsEffectDragOver(false);
    }
  }, []);

  return (
    <>
      <div
        ref={dragRef}
        className={cn(
          'absolute rounded-md cursor-move select-none overflow-hidden border-2',
          'transition-shadow hover:shadow-lg hover:brightness-110',
          'h-[50px] flex flex-col items-start justify-center',
          getClipBackgroundColor(),
          isSelected ? 'border-white' : 'border-transparent',
          isDragging ? 'opacity-70 z-50' : 'opacity-100 z-10',
          interactionState.current.isResizing ? 'cursor-ew-resize' : '',
          'transition-[left,top] duration-100 ease-out',
          'timeline-clip',
          clip.type === 'audio' && clip.muted ? 'opacity-75 saturate-50' : '',
          isEffectDragOver ? 'ring-2 ring-cyan-400 ring-opacity-75' : ''
        )}
        style={style}
        draggable
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onDragOver={handleEffectDragOver}
        onDragEnter={handleEffectDragEnter}
        onDragLeave={handleEffectDragLeave}
        onDrop={handleEffectDrop}
        onClick={(e) => {
          e.stopPropagation();
          onClipSelect(clip.id);
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Muted audio clip overlay pattern */}
        {clip.type === 'audio' && clip.muted && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent bg-repeat-x opacity-30 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)',
            }}
          />
        )}
        
        <div className="absolute top-0 left-0 right-0 h-5 px-2 flex items-center justify-between text-[10px] text-white bg-black/30">
          <div className="flex items-center truncate max-w-[60%]">
            {getClipIcon()}
            <span className="truncate">{clip.title}</span>
          </div>
          <div className="flex items-center gap-1">
            {clip.type === 'audio' && onClipMute && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClipMute(clip.id);
                }}
                className="hover:bg-white/20 rounded p-0.5 transition-colors flex items-center justify-center"
                title={clip.muted ? "Unmute" : "Mute"}
              >
                {clip.muted ? (
                  <VolumeX className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </button>
            )}
            <span>{formatTime(clip.duration)}</span>
          </div>
        </div>

        {/* Effects indicator */}
        {clip.effects && clip.effects.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-3 px-1 flex items-center gap-0.5 bg-black/50 overflow-hidden">
            {clip.effects.slice(0, 5).map((effectId, index) => (
              <div
                key={effectId}
                className="w-2 h-2 rounded-full bg-cyan-400 cursor-pointer hover:bg-cyan-300 transition-colors"
                title={`Effect ${index + 1} - Click to remove`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEffectRemove) {
                    onEffectRemove(clip.id, effectId);
                  }
                }}
              />
            ))}
            {clip.effects.length > 5 && (
              <span className="text-[8px] text-cyan-400 ml-0.5">+{clip.effects.length - 5}</span>
            )}
          </div>
        )}

        {/* Effect drop zone indicator */}
        {isEffectDragOver && (
          <div className="absolute inset-0 bg-cyan-400/20 border-2 border-cyan-400 border-dashed rounded-md flex items-center justify-center z-20">
            <span className="text-cyan-400 text-xs font-medium">Drop Effect Here</span>
          </div>
        )}
        
        {clip.type === 'audio' && clip.audioUrl && (
          <div className="w-full h-[25px] mt-5 px-1">
            <Waveform url={clip.audioUrl} height={20} />
          </div>
        )}
        
        {clip.type === 'video' && clip.thumbnail && (
          <div className="w-full h-[25px] mt-5 flex items-center justify-center overflow-hidden">
            {/* <img 
              src={clip.thumbnail} 
              alt={clip.title} 
              className="w-full h-full object-cover opacity-80"
            /> */}
          </div>
        )}
        
        {clip.type === 'image' && clip.thumbnail && (
          <div className="w-full h-[25px] mt-5 flex items-center justify-center overflow-hidden">
            <img 
              src={clip.thumbnail} 
              alt={clip.title} 
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        )}

        {clip.type === 'text' && clip.textContent && (
          <div className="w-full h-[25px] mt-5 px-2 flex items-center justify-center overflow-hidden">
            <div 
              className="text-xs truncate max-w-full text-center"
              style={{
                fontFamily: clip.textStyle?.fontFamily || 'inherit',
                fontWeight: clip.textStyle?.fontWeight || 'normal',
                fontStyle: clip.textStyle?.fontStyle || 'normal',
                color: 'white', // Use white for visibility on timeline
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                opacity: clip.visible !== false ? 1 : 0.5
              }}
            >
              "{clip.textContent}"
            </div>
          </div>
        )}

        {/* Resize handles */}
        <div
          className="bg-transparent absolute top-0 left-0 w-3 h-full cursor-ew-resize hover:bg-white/30 active:bg-white/50 z-10"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        >
          {/* <div className="h-full w-1 bg-white/30 ml-1"></div> */}
        </div>
        <div
          className="absolute top-0 right-0 w-3 h-full cursor-ew-resize hover:bg-white/30 active:bg-white/50 z-10"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        >
          {/* <div className="h-full w-1 bg-white/30 ml-1"></div> */}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-gray-900 shadow-lg rounded-md py-1 border border-gray-700 min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1 text-xs text-gray-400 border-b border-gray-700">
            {clip.title}
          </div>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 flex items-center"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
          </button>
          {clip.type === 'audio' && onClipMute && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 flex items-center"
              onClick={handleMute}
            >
              {clip.muted ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 mr-2" /> Unmute
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 mr-2" /> Mute
                </>
              )}
            </button>
          )}
          {onClipSplit && contextMenu.splitTime && contextMenu.splitTime > clip.start && contextMenu.splitTime < clip.start + clip.duration && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 flex items-center"
              onClick={handleSplit}
            >
              <Scissors className="h-3.5 w-3.5 mr-2" /> Split at {formatTime(contextMenu.splitTime)}
            </button>
          )}
          {onClipDuplicate && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 flex items-center"
              onClick={handleDuplicate}
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
            </button>
          )}
          {onClipCopy && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 flex items-center"
              onClick={handleCopy}
            >
              <Copy className="h-3.5 w-3.5 mr-2" /> Copy
            </button>
          )}
          {onClipPaste && canPaste && (
          <button
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 flex items-center"
              onClick={handlePaste}
            >
              <ClipboardPaste className="h-3.5 w-3.5 mr-2" /> Paste
              </button>
          )}
        </div>
      )}
    </>
  );
};
export default TimelineClip;