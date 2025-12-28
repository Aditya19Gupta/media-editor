"use client";

import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { MediaUploader } from "./MediaUploader";
import { MediaGrid } from "./MediaGrid";
import { MediaPreview } from "./MediaPreview";
import { Input } from '@/components/ui/input';
import { VideoIcon } from "lucide-react";
import { useState } from "react";
import Timeline from "@/components/timeline/Timeline";

export function VideosPanel() {
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
    <div className="flex flex-col h-full">
      {/* Videos Library Section */}
      <div className="flex-shrink-0 space-y-4 p-4 border-b">
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
              className="max-w-sm"
            />
            
            <div className="max-h-64 overflow-y-auto">
              <MediaGrid 
                mediaItems={videoItems}
                onMediaClick={handleMediaClick}
                onDeleteMedia={removeMediaItem}
              />
            </div>
          </>
        )}
        
        {videoItems.length === 0 && !isUploading && (
          <div className="text-center p-6 border border-dashed rounded-lg">
            <VideoIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-muted-foreground">No videos found. Upload some videos to get started!</p>
          </div>
        )}
      </div>

      {/* Timeline Editor Section */}
      <div className="flex-1 min-h-0">
        <Timeline />
      </div>

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