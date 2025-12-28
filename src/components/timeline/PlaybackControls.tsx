import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Scissors } from 'lucide-react';
import { formatTime } from '@/utils/timelineUtils';

interface PlaybackControlsProps {
  currentTime: number;
  duration: number;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSplit?: () => void;
  canSplit?: boolean;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  currentTime,
  duration,
  playing,
  onPlay,
  onPause,
  onSeek,
  onSkipBack,
  onSkipForward,
  onSplit,
  canSplit = false
}) => {
  const handleSliderChange = (value: number[]) => {
    onSeek(value[0]);
  };

  return (
    <div className="flex flex-col p-3 rounded-md space-y-2">
      <div className="flex items-center space-x-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onSkipBack}
          className="hover:text-white hover:bg-gray-800"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={playing ? onPause : onPlay}
          className="hover:text-white hover:bg-gray-800"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onSkipForward}
          className="hover:text-white hover:bg-gray-800"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onSplit}
          disabled={!canSplit}
          className={`hover:text-white hover:bg-gray-800 ${!canSplit ? 'opacity-50' : ''}`}
          title="Split at playhead"
        >
          <Scissors className="h-4 w-4" />
        </Button>
        
        <div className="text-xs min-w-[100px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      
      <div className="w-full px-2">
        <Slider 
          value={[currentTime]} 
          max={duration} 
          step={0.01}
          onValueChange={handleSliderChange} 
        />
      </div>
    </div>
  );
};

export default PlaybackControls;