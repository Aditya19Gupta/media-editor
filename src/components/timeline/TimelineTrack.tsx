import React from 'react';
import { cn } from '@/lib/utils';
import { TrackType } from '@/types/clip';
import { Video, Music, Image, Type, X } from 'lucide-react';

interface TimelineTrackProps {
  index: number;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove?: (index: number) => void;
  isActive?: boolean;
  trackType: TrackType;
  label: string;
  className?: string;
  canRemove?: boolean;
}

const TimelineTrack: React.FC<TimelineTrackProps> = ({ 
  index, 
  onDragOver, 
  onDrop, 
  onRemove,
  isActive = false,
  trackType,
  label,
  className,
  canRemove = false
}) => {
  // Get the appropriate icon based on track type and index
  const getTrackIcon = () => {
    // For visual tracks (index 0, 1), show a combined icon or video icon
    if (index <= 1) {
      return <Video className="h-4 w-4 mr-1" />;
    }
    // For audio track (index 2), show music icon
    else if (index === 2) {
      return <Music className="h-4 w-4 mr-1" />;
    }
    
    // Fallback based on trackType
    switch (trackType) {
      case TrackType.VIDEO:
        return <Video className="h-4 w-4 mr-1" />;
      case TrackType.AUDIO:
        return <Music className="h-4 w-4 mr-1" />;
      case TrackType.IMAGE:
        return <Image className="h-4 w-4 mr-1" />;
      case TrackType.TEXT:
        return <Type className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };

  // Get background color based on track index
  const getTrackBackgroundColor = () => {
    if (isActive) return 'bg-gray-700';
    
    // Visual tracks (0, 1) get blue/purple gradient
    if (index <= 1) {
      return index === 0 ? 'bg-blue-950/30' : 'bg-purple-950/30';
    }
    // Audio track (2) gets green
    else if (index === 2) {
      return 'bg-green-950/30';
    }
    
    // Fallback based on trackType
    switch (trackType) {
      case TrackType.VIDEO:
        return 'bg-blue-950/30';
      case TrackType.AUDIO:
        return 'bg-green-950/30';
      case TrackType.IMAGE:
        return 'bg-purple-950/30';
      case TrackType.TEXT:
        return 'bg-amber-950/30';
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        'h-[60px] border-b border-gray-700 transition-colors duration-150 group relative',
        getTrackBackgroundColor(),
        className
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Track label with icon */}
      <div className="absolute left-0 w-[60px] h-[60px] flex flex-col items-center justify-center border-r border-gray-700 bg-gray-800">
        <div className="flex items-center text-xs">
          {getTrackIcon()}
        </div>
        <div className="text-xs text-center mt-1">
          {label}
        </div>
        
        {/* Remove button - only show if canRemove is true and on hover */}
        {canRemove && onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 text-xs"
            title="Remove track"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default TimelineTrack; 