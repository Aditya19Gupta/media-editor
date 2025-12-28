"use client";

import { TextOverlay } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface TextOverlayItemProps {
  overlay: TextOverlay;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}

export default function TextOverlayItem({
  overlay,
  isSelected,
  onSelect,
  onToggleVisibility,
  onDelete,
}: TextOverlayItemProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Format time to MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    
    // Create a text media item format for timeline compatibility
    const textMediaItem = {
      id: overlay.id,
      name: overlay.content || "Text Overlay",
      type: "text/overlay",
      size: 0,
      url: "", // No URL for text
      uploadedAt: new Date(),
      audioUrl: "",
      duration: overlay.endTime - overlay.startTime,
      // Include text overlay specific data
      textOverlay: overlay
    };

    e.dataTransfer.setData("application/json", JSON.stringify(textMediaItem));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={cn(
        "p-3 rounded-md border border-border transition-all duration-200 cursor-move",
        isSelected ? "bg-accent" : "bg-card hover:bg-accent/30",
        isDragging ? "opacity-50 scale-95" : "opacity-100 scale-100"
      )}
      onClick={onSelect}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex-shrink-0" />
            <p className="font-medium truncate" style={{ maxWidth: "150px" }}>
              {overlay.content || "Empty Text"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
          </p>
        </div>
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            title={overlay.visible ? "Hide" : "Show"}
          >
            {overlay.visible ? (
              <EyeOpenIcon className="h-4 w-4" />
            ) : (
              <EyeClosedIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Style preview */}
      <div 
        className="mt-2 px-2 py-1 rounded text-xs truncate relative"
        style={{ 
          fontFamily: overlay.style.fontFamily,
          color: overlay.style.color,
          backgroundColor: overlay.style.backgroundColor || 'transparent',
          textAlign: overlay.style.textAlign,
          fontWeight: overlay.style.fontWeight,
          fontStyle: overlay.style.fontStyle,
          opacity: overlay.visible ? 1 : 0.5,
        }}
      >
        {overlay.content}
        {/* Drag hint overlay */}
        {!isDragging && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/5 rounded text-[10px] text-muted-foreground pointer-events-none">
            Drag to timeline
          </div>
        )}
      </div>
    </div>
  );
}

// Simple icon components
function EyeOpenIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

function EyeClosedIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  );
}