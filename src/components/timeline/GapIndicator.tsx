import React, { useState } from 'react';
import { generateGapStyle, formatTime } from '@/utils/timelineUtils';
import { Trash2, SkipForward } from 'lucide-react';
interface GapIndicatorProps {
  gap: { trackIndex: number; start: number; end: number; duration: number };
  zoom: number;
  onRemoveGap: (trackIndex: number, gapStart: number, gapEnd: number) => void;
}

const GapIndicator: React.FC<GapIndicatorProps> = ({ gap, zoom, onRemoveGap }) => {
  const [isHovered, setIsHovered] = useState(false);
  const style = generateGapStyle(gap, zoom);
  
  // Check if this gap is at the starting position (beginning of track)
  const isStartingGap = gap.start === 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveGap(gap.trackIndex, gap.start, gap.end);
  };

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-200 ${
        isHovered ? 'opacity-80' : 'opacity-0 hover:opacity-60'
      }`}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Gap background */}
      <div className={`w-full h-full bg-gray-800/40 border-2 border-dashed rounded-sm relative overflow-hidden border-blue-500/60`}>
        {/* Diagonal lines pattern */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 8px,
              rgba(255, 255, 255, 0.3) 8px,
              rgba(255, 255, 255, 0.3) 12px
            )`
          }}
        ></div>
        
        {/* Hover text */}
        {isHovered && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs font-medium">
            <div className="text-center">
              {isStartingGap ? (
                <>
                  <Trash2 className="w-4 h-4" />
                </>
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GapIndicator; 