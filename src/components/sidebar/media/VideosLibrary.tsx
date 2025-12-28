"use client";

import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { MediaUploader } from "./MediaUploader";
import { MediaGrid } from "./MediaGrid";
import { MediaPreview } from "./MediaPreview";
import { Input } from '@/components/ui/input';
import { VideoIcon } from "lucide-react";
import { useState } from "react";

export function VideosLibrary() {
  const {
    mediaItems,
    uploadFiles,
    uploadProgress,
    isUploading,
    removeMediaItem,
  } = useMediaLibrary();
  
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter to show only videos
  const videoItems = mediaItems.filter(item => {
    const isVideo = item.type.startsWith('video/');
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return isVideo && matchesSearch;
  });

  const handleMediaClick = (id: string) => {
    setSelectedMedia(id);
  };

  const handleClosePreview = () => {
    setSelectedMedia(null);
  };

  const selectedMediaItem = mediaItems.find(item => item.id === selectedMedia);

  return (
    <div className="space-y-6 h-full overflow-y-auto scrollbar-hide">
      <div className="flex items-center gap-2">
        <VideoIcon className="h-6 w-6 text-purple-500" />
        <h2 className="text-xl font-bold">Videos Library</h2>
      </div>
      
      <MediaUploader
        onFilesSelected={(files) => {
          // Filter to only accept video files
          const videoFiles = files.filter(file => file.type.startsWith('video/'));
          if (videoFiles.length > 0) {
            uploadFiles(videoFiles);
          }
          if (videoFiles.length !== files.length) {
            // Show warning if non-video files were dropped
            console.warn('Only video files are accepted in the Videos section');
          }
        }}
        uploadProgress={uploadProgress}
        isUploading={isUploading}
      />
      
      {videoItems.length > 0 && (
        <>
          <Input
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          
          <MediaGrid 
            mediaItems={videoItems}
            onMediaClick={handleMediaClick}
            onDeleteMedia={removeMediaItem}
          />
        </>
      )}
      
      {videoItems.length === 0 && !isUploading && (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <VideoIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-muted-foreground">No videos found. Upload some videos to get started!</p>
        </div>
      )}

      {/* Media Preview Modal */}
      {selectedMediaItem && (
        <MediaPreview
          media={selectedMediaItem}
          isOpen={!!selectedMedia}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
} 