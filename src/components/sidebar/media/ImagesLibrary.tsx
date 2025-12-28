"use client";

import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { MediaUploader } from "./MediaUploader";
import { MediaGrid } from "./MediaGrid";
import { MediaPreview } from "./MediaPreview";
import { Input } from '@/components/ui/input';
import { ImageIcon } from "lucide-react";
import { useState } from "react";

export function ImagesLibrary() {
  const {
    mediaItems,
    uploadFiles,
    uploadProgress,
    isUploading,
    removeMediaItem,
  } = useMediaLibrary();
  
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter to show only images
  const imageItems = mediaItems.filter(item => {
    const isImage = item.type.startsWith('image/');
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return isImage && matchesSearch;
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
        <ImageIcon className="h-6 w-6 text-blue-500" />
        <h2 className="text-xl font-bold">Images Library</h2>
      </div>
      
      <MediaUploader
        onFilesSelected={(files) => {
          // Filter to only accept image files
          const imageFiles = files.filter(file => file.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            uploadFiles(imageFiles);
          }
          if (imageFiles.length !== files.length) {
            // Show warning if non-image files were dropped
            console.warn('Only image files are accepted in the Images section');
          }
        }}
        uploadProgress={uploadProgress}
        isUploading={isUploading}
      />
      
      {imageItems.length > 0 && (
        <>
          <Input
            placeholder="Search images..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          
          <MediaGrid 
            mediaItems={imageItems}
            onMediaClick={handleMediaClick}
            onDeleteMedia={removeMediaItem}
          />
        </>
      )}
      
      {imageItems.length === 0 && !isUploading && (
        <div className="text-center p-8 border border-dashed rounded-lg">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <p className="text-muted-foreground">No images found. Upload some images to get started!</p>
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