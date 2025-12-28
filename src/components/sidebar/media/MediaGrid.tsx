"use client";

import { useState } from "react";
import { MediaItem } from "@/types/media";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Trash2, ImageIcon, VideoIcon, FileAudioIcon, FileIcon, CopyIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatDate } from "@/lib/formatters";

interface MediaGridProps {
  mediaItems: MediaItem[];
  onMediaClick: (id: string) => void;
  onDeleteMedia: (id: string) => void;
}

export function MediaGrid({ mediaItems, onMediaClick, onDeleteMedia }: MediaGridProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  const renderThumbnail = (item: MediaItem) => {
    const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData("application/json", JSON.stringify(item));
    };
  
    const commonWrapperClass = "relative w-full h-40 overflow-hidden rounded-t-md cursor-move";
  
    if (item.type.startsWith("image")) {
      return (
        <div
          className={`${commonWrapperClass} bg-secondary/30`}
          draggable
          onDragStart={handleDragStart}
        >
          <img
            src={item.url}
            alt={item.name}
            className="object-cover w-full h-full transition-transform duration-300 hover:scale-105"
          />
        </div>
      );
    }
  
    if (item.type.startsWith("video")) {
      return (
        <div
          className={`${commonWrapperClass} bg-secondary/30 flex items-center justify-center`}
          draggable
          onDragStart={handleDragStart}
        >
          <video
            src={item.url}
            className="object-cover w-full h-full pointer-events-none"
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-3 bg-black/60 rounded-full">
              <VideoIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      );
    }
  
    if (item.type.startsWith("audio")) {
      return (
        <div
          className="w-full h-40 flex items-center justify-center rounded-t-md bg-gradient-to-r from-indigo-500/20 to-purple-500/20 cursor-move"
          draggable
          onDragStart={handleDragStart}
        >
          <div className="p-4 bg-black/10 rounded-full">
            <FileAudioIcon className="h-12 w-12 text-indigo-500" />
          </div>
        </div>
      );
    }
  
    return (
      <div
        className="w-full h-40 flex items-center justify-center rounded-t-md bg-secondary/30 cursor-move"
        draggable
        onDragStart={handleDragStart}
      >
        <div className="p-4 bg-black/10 rounded-full">
          <FileIcon className="h-12 w-12 text-muted-foreground" />
        </div>
      </div>
    );
  };
  

  const getFileIcon = (type: string) => {
    if (type.startsWith("image")) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith("video")) return <VideoIcon className="h-4 w-4" />;
    if (type.startsWith("audio")) return <FileAudioIcon className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  if (mediaItems.length === 0) {
    return (
      <div className="text-center p-10 border border-dashed rounded-lg">
        <p className="text-muted-foreground">No media files found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-6">
      {mediaItems.map((item) => (
        <Card 
          key={item.id}
          className={cn(
            "group overflow-hidden transition-all duration-200 hover:shadow-md",
            hoveredItem === item.id ? "ring-2 ring-primary/50" : ""
          )}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <div 
            className="cursor-pointer"
            onClick={() => onMediaClick(item.id)}
          >
            {renderThumbnail(item)}
          </div>
          
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="truncate pr-4">
                <h3 className="font-medium truncate">{item.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBytes(item.size)}
                </p>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCopyUrl(item.url)}>
                    <CopyIcon className="h-4 w-4 mr-2" />
                    Copy URL
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(item.url, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in new tab
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive" 
                    onClick={() => onDeleteMedia(item.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
          
          <CardFooter className="p-4 pt-0 flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getFileIcon(item.type)}
              <span>{item.type.split("/")[1].toUpperCase()}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(item.uploadedAt)}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}