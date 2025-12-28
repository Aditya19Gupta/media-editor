"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#00FFFF', '#FF00FF', '#C0C0C0', '#808080',
  '#800000', '#808000', '#008000', '#800080', '#008080',
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [localColor, setLocalColor] = useState(color);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalColor(color);
  }, [color]);

  const handleColorChange = (newColor: string) => {
    setLocalColor(newColor);
  };

  const applyColor = () => {
    onChange(localColor);
    setOpen(false);
  };

  const handlePresetClick = (presetColor: string) => {
    setLocalColor(presetColor);
    onChange(presetColor);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline"
          className="w-full flex items-center justify-between"
        >
          <span>Select Color</span>
          <div 
            className="w-6 h-6 rounded border border-input"
            style={{ backgroundColor: color }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex">
              <input
                ref={inputRef}
                type="color"
                value={localColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-full h-10 cursor-pointer border-0 p-0"
                style={{ padding: 0 }}
              />
            </div>
            
            <div className="flex">
              <input 
                type="text"
                value={localColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="flex-1 px-2 py-1 border rounded-l text-sm"
                pattern="#[0-9A-Fa-f]{6}"
              />
              <Button 
                onClick={applyColor} 
                className="rounded-l-none"
              >
                Apply
              </Button>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium mb-2">Presets</div>
            <div className="grid grid-cols-5 gap-1">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className="w-8 h-8 rounded border border-input cursor-pointer"
                  style={{ backgroundColor: presetColor }}
                  onClick={() => handlePresetClick(presetColor)}
                  aria-label={`Color ${presetColor}`}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}