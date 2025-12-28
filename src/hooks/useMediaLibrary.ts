"use client";

import { useState, useCallback } from "react";
import { MediaItem, MediaType } from "@/types/media";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";



export function useMediaLibrary() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const getMediaType = (fileType: string): MediaType => {
    if (fileType.startsWith("image/")) return "image";
    if (fileType.startsWith("video/")) return "video";
    if (fileType.startsWith("audio/")) return "audio";
    return "file";
  };

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    let loadedSize = 0;
    
    try {
      const newMediaItems: MediaItem[] = [];
      
      for (const file of files) {
        // Simulate a network request with progress
        const fileUrl = URL.createObjectURL(file);
        
        // Simulate progress
        await new Promise<void>((resolve) => {
          const updateProgress = () => {
            loadedSize += file.size / 10;
            const progress = Math.min((loadedSize / totalSize) * 100, 99);
            setUploadProgress(progress);
            
            if (loadedSize >= file.size) {
              resolve();
            } else {
              setTimeout(updateProgress, 100);
            }
          };
          
          setTimeout(updateProgress, 100);
        });
        
        const newItem: MediaItem = {
          id: uuidv4(),
          name: file.name,
          type: file.type,
          size: file.size,
          url: fileUrl,
          uploadedAt: new Date(),
          audioUrl: "",
          duration: 0
        };
        
        newMediaItems.push(newItem);
      }
      
      // Complete the upload
      setUploadProgress(100);
      setMediaItems((prev) => [...newMediaItems, ...prev]);
      
      toast.success(`${files.length} file${files.length === 1 ? "" : "s"} uploaded successfully`);
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files. Please try again.");
    } finally {
      setTimeout(() => {
        setIsUploading(false);
      }, 500);
    }
  }, []);

  const removeMediaItem = useCallback((id: string) => {
    setMediaItems((prev) => {
      const itemToRemove = prev.find(item => item.id === id);
      if (itemToRemove) {
        // Revoke object URL to prevent memory leaks
        URL.revokeObjectURL(itemToRemove.url);
      }
      return prev.filter(item => item.id !== id);
    });
    toast.success("Media item removed");
  }, []);

  return {
    mediaItems,
    uploadFiles,
    uploadProgress,
    isUploading,
    removeMediaItem,
  };
}