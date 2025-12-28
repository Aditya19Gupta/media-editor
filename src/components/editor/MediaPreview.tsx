"use client";
import React, { useState } from "react";
import { MediaItem } from "@/types/media";

export default function MediaPreview() {
  const [media, setMedia] = useState<MediaItem | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    console.log("Received drag data:", data);
    try {
      const dropped = JSON.parse(data);
      setMedia(dropped);
    } catch (err) {
      console.error("Failed to parse dropped media:", err);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="w-full min-h-[300px] border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center p-6"
    >
      
      {media ? (
        <div className="text-center">
          <p className="font-bold mb-2">{media.name}</p>
          {media.type.startsWith("image") && (
            <img src={media.url} alt={media.name} className="max-h-64 mx-auto" />
          )}
          {media.type.startsWith("video") && (
            <video src={media.url} controls className="max-h-64 mx-auto" />
          )}
          {media.type.startsWith("audio") && (
            <audio src={media.url} controls className="w-full mt-2" />
          )}
        </div>
      ) : (
        <p className="text-gray-500">drop media here</p>
      )}
    </div>
  );
}
