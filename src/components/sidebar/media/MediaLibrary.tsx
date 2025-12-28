"use client";

import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import { MediaUploader } from "./MediaUploader";
import { MediaGrid } from "./MediaGrid";
import { MediaPreview } from "./MediaPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageIcon, VideoIcon, FileAudioIcon, FileIcon } from "lucide-react";
import { MediaType } from "@/types/media";
import { useState } from "react";
import { Input } from '@/components/ui/input'

export function MediaLibrary() {
  const {
    mediaItems,
    uploadFiles,
    uploadProgress,
    isUploading,
    removeMediaItem,
  } = useMediaLibrary();
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<MediaType | "all">("all");
  const [searchTerm, setSearchTerm] = useState('')
  const filteredMedia = mediaItems.filter(item => {
    const matchesType = activeFilter === "all" || item.type.startsWith(activeFilter);
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesType && matchesSearch;
  });
  

  const handleMediaClick = (id: string) => {
    setSelectedMedia(id);
  };

  const handleClosePreview = () => {
    setSelectedMedia(null);
  };

  const selectedMediaItem = mediaItems.find(item => item.id === selectedMedia);

  return (
    <div className="space-y-8 h-full overflow-y-auto scrollbar-hide">
      <label className="text-xl font-bold mb-6">Media Library</label>
      <MediaUploader
        onFilesSelected={uploadFiles}
        uploadProgress={uploadProgress}
        isUploading={isUploading}
      />
      
      {mediaItems.length > 0 && (
        <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setActiveFilter(value as MediaType | "all")}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="w-full flex">
              <TabsTrigger value="all" className="flex items-center gap-1 flex-1">
                <FileIcon className="h-4 w-4" />
                <span>All</span>
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center gap-1 flex-1">
                <ImageIcon className="h-4 w-4" />
                <span>Images</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-1 flex-1">
                <VideoIcon className="h-4 w-4" />
                <span>Videos</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center gap-1 flex-1">
                <FileAudioIcon className="h-4 w-4" />
                <span>Audio</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
          <TabsContent value="all" className="mt-0">
            <MediaGrid 
              mediaItems={filteredMedia} 
              onMediaClick={handleMediaClick}
              onDeleteMedia={removeMediaItem}
            />
          </TabsContent>
          <TabsContent value="image" className="mt-0">
            <MediaGrid 
              mediaItems={filteredMedia}
              onMediaClick={handleMediaClick}
              onDeleteMedia={removeMediaItem}
            />
          </TabsContent>
          <TabsContent value="video" className="mt-0">
            <MediaGrid 
              mediaItems={filteredMedia}
              onMediaClick={handleMediaClick}
              onDeleteMedia={removeMediaItem}
            />
          </TabsContent>
          <TabsContent value="audio" className="mt-0">
            <MediaGrid 
              mediaItems={filteredMedia}
              onMediaClick={handleMediaClick}
              onDeleteMedia={removeMediaItem}
            />
          </TabsContent>
        </Tabs>
      )}

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