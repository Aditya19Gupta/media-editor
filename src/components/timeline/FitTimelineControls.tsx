import React from 'react'
import { ChevronsLeftRightEllipsis } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface FitTimelineControlsProps {
  onFitToScreen: () => void;
}

export default function FitTimelineControls({ onFitToScreen }: FitTimelineControlsProps) {
  return (
    <div className='flex items-center rounded-md'>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button     
              variant="ghost" 
              size="sm"
              className=" hover:bg-gray-800"
              onClick={onFitToScreen}
            >
              <ChevronsLeftRightEllipsis className='w-4 h-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              <span>Fit timeline to screen</span>
              <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
                Ctrl/Cmd + '0'
              </kbd>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
