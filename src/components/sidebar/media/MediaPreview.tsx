"use client";

import { MediaItem } from "@/types/media";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  HardDrive,
  FileTypeIcon,
  Download,
  Share2,
} from "lucide-react";
import { formatBytes, formatDate, formatTime } from "@/lib/formatters";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MediaPreviewProps {
  media: MediaItem;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaPreview({ media, isOpen, onClose }: MediaPreviewProps) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = media.url;
    link.download = media.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started");
  };

  const handleShare = () => {
    navigator.clipboard.writeText(media.url);
    toast.success("URL copied to clipboard");
  };

  const renderMediaContent = () => {
    if (media.type.startsWith("image")) {
      return (
        <div className="flex items-center justify-center bg-black/5 rounded-lg mb-6 overflow-hidden max-h-[60vh]">
          <img
            src={media.url}
            alt={media.name}
            className="max-w-full max-h-[60vh] object-contain"
          />
        </div>
      );
    }

    if (media.type.startsWith("video")) {
      return (
        <div
          className="mb-6 bg-black/5 rounded-lg overflow-hidden cursor-move"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/json", JSON.stringify(media));
          }}
        >
          <video
            src={media.url}
            controls
            className="w-full max-h-[60vh]"
          />
        </div>
      );
    }

    if (media.type.startsWith("audio")) {
      return (
        <div className="mb-6 px-6 py-4 bg-black/5 rounded-lg cursor-move">
          <div className="w-full flex justify-center mb-4">
            <div className="p-6 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-full">
              <FileTypeIcon className="h-20 w-20 text-indigo-500" />
            </div>
          </div>
          <audio src={media.url} controls className="w-full" />
        </div>
      );
    }

    return (
      <div className="mb-6 p-16 bg-black/5 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 p-8 bg-black/10 rounded-full w-fit">
            <FileTypeIcon className="h-20 w-20 text-muted-foreground" />
          </div>
          <p>Preview not available</p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[90vw] cursor-move">
        <DialogHeader>
          <DialogTitle className="text-xl">{media.name}</DialogTitle>
          <DialogDescription>
            {media.type.split("/")[1].toUpperCase()} file
          </DialogDescription>
        </DialogHeader>

        {renderMediaContent()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileTypeIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Type:</span>
              <span>{media.type}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Size:</span>
              <span>{formatBytes(media.size)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Uploaded on:</span>
              <span>{formatDate(media.uploadedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Uploaded at:</span>
              <span>{formatTime(media.uploadedAt)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-between gap-2 sm:gap-0">
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleDownload}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy URL</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
