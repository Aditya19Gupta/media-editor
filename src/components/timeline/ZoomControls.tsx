import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut  } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  minZoom: number;
  maxZoom: number;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomChange,
  minZoom,
  maxZoom
}) => {
  const handleZoomIn = () => {
    onZoomChange(Math.min(zoom + 10, maxZoom));
  };

  const handleZoomOut = () => {
    onZoomChange(Math.max(zoom - 10, minZoom));
  };

  const handleSliderChange = (value: number[]) => {
    onZoomChange(value[0]);
  };

  return (
    <div className="flex items-center rounded-md">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleZoomOut}
              disabled={zoom <= minZoom}
              className=" hover:bg-gray-800"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              <span>Zoom Out</span>
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                Ctrl/Cmd + '-'
              </kbd>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* <Slider 
        value={[zoom]} 
        min={minZoom} 
        max={maxZoom} 
        step={1}
        className="w-32"
        onValueChange={handleSliderChange} 
      /> */}
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleZoomIn}
              disabled={zoom >= maxZoom}
              className="hover:bg-gray-800"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              <span>Zoom In</span>
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                Ctrl/Cmd + '+'
              </kbd>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default ZoomControls;
