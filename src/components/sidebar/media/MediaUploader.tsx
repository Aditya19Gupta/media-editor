"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, ImageIcon, VideoIcon, FileAudioIcon, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MediaUploaderProps {
  onFilesSelected: (files: File[]) => void;
  uploadProgress: number;
  isUploading: boolean;
}

export function MediaUploader({ 
  onFilesSelected, 
  uploadProgress, 
  isUploading 
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected]);

  const validateFiles = (files: File[]): File[] => {
    const validTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Videos
      'video/mp4', 'video/webm', 'video/ogg',
      // Audio
      'audio/mpeg', 'audio/wav', 'audio/ogg'
    ];
    
    const validFiles = files.filter(file => validTypes.includes(file.type));
    
    if (validFiles.length !== files.length) {
      toast.warning(
        `${files.length - validFiles.length} file(s) were rejected. 
        Please upload only images, videos, or audio files.`
      );
    }
    
    return validFiles;
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const validFiles = validateFiles(files);
      
      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div 
      className={cn(
        "border-2 border-dashed  m-2 rounded-lg p-8 transition-all duration-200",
        isDragging 
          ? "border-primary bg-primary/5" 
          : "border-border hover:border-muted-foreground/50"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div 
          className={cn(
            "p-6 rounded-full bg-secondary transition-transform duration-200",
            isDragging ? "scale-110" : ""
          )}
        >
          <Upload 
            className={cn(
              "h-8 w-8 transition-colors duration-150",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} 
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium">
            {isDragging ? "Drop your files here" : "Drag and drop your media files"}
          </h3>
          <p className="text-xs  text-muted-foreground">
            Supports JPG, PNG, GIF, WEBP, SVG, MP4, WEBM, MP3, WAV, and OGG
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 justify-center">
          <div className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-secondary">
            <ImageIcon className="h-3.5 w-3.5" /> Images
          </div>
          <div className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-secondary">
            <VideoIcon className="h-3.5 w-3.5" /> Videos
          </div>
          <div className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-secondary">
            <FileAudioIcon className="h-3.5 w-3.5" /> Audio
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            accept="image/*,video/*,audio/*"
          />
          <Button 
            onClick={handleButtonClick}
            disabled={isUploading}
            className="mt-2"
          >
            Select Files
          </Button>
          
          {isDragging && (
            <Button 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                setIsDragging(false);
              }}
              className="mt-2"
            >
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
        
        {isUploading && (
          <div className="w-full mt-4 space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Uploading: {uploadProgress.toFixed(0)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}