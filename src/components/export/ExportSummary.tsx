"use client";

import { useState, useEffect } from "react";
import { ExportSettings } from "@/lib/export/export-types";
import { calculateExportTime, formatTime } from "@/lib/export/export-utils";
import { Button } from "@/components/ui/button";
import { 
  ArrowDownToLine, 
  Check, 
  Share2 
} from "lucide-react";
import { useTimeline } from "@/contexts/TimelineContext";
import { 
  calculateEstimatedFileSize, 
  calculateActualDuration, 
  getClipCounts, 
  calculateEstimatedExportTime,
  formatResolution,
  convertToSharedSettings,
  qualityPresets
} from "@/lib/export/shared-export-utils";

interface ExportSummaryProps {
  settings: ExportSettings;
  exportComplete: boolean;
}

export function ExportSummary({ 
  settings, 
  exportComplete 
}: ExportSummaryProps) {
  const { timelineState } = useTimeline();
  const [exportTime, setExportTime] = useState('0s');
  const [estimatedSize, setEstimatedSize] = useState('0 MB');
  
  useEffect(() => {
    if (timelineState?.clips) {
      // Convert old settings to shared format
      const sharedSettings = convertToSharedSettings(settings);
      
      // Calculate values using timeline data and shared utilities
      const newEstimatedSize = calculateEstimatedFileSize(timelineState.clips, sharedSettings);
      const newExportTime = calculateEstimatedExportTime(timelineState.clips, sharedSettings);
      
      setEstimatedSize(newEstimatedSize);
      setExportTime(newExportTime);
    }
  }, [settings, timelineState?.clips]);

  // Get actual data from timeline
  const actualDuration = timelineState?.clips ? calculateActualDuration(timelineState.clips) : 0;
  const clipCounts = timelineState?.clips ? getClipCounts(timelineState.clips) : { video: 0, audio: 0, image: 0, text: 0 };
  const sharedSettings = convertToSharedSettings(settings);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Export Summary</h3>
        <p className="text-sm text-muted-foreground">
          {exportComplete 
            ? "Your video has been exported successfully." 
            : "Review your export settings before proceeding."}
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Resolution</span>
          <span className="font-medium">{formatResolution(sharedSettings.resolution)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Format</span>
          <span className="font-medium">{sharedSettings.format.toUpperCase()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Frame Rate</span>
          <span className="font-medium">{sharedSettings.framerate} fps</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Video Bitrate</span>
          <span className="font-medium">{sharedSettings.videoBitrate}bps</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Audio Bitrate</span>
          <span className="font-medium">{sharedSettings.audioBitrate}bps</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Quality</span>
          <span className="font-medium">
            {sharedSettings.quality.charAt(0).toUpperCase() + sharedSettings.quality.slice(1)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{actualDuration.toFixed(2)}s</span>
        </div>
      </div>

      {/* Clips Summary */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Content Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span>Video clips:</span>
            <span className="font-medium">{clipCounts.video}</span>
          </div>
          <div className="flex justify-between">
            <span>Audio clips:</span>
            <span className="font-medium">{clipCounts.audio}</span>
          </div>
          <div className="flex justify-between">
            <span>Images:</span>
            <span className="font-medium">{clipCounts.image}</span>
          </div>
          <div className="flex justify-between">
            <span>Text overlays:</span>
            <span className="font-medium">{clipCounts.text}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="text-sm text-muted-foreground">Estimated Size</div>
          <div className="text-lg font-medium">{estimatedSize}</div>
        </div>
        <div className="rounded-lg bg-muted p-3 text-center">
          <div className="text-sm text-muted-foreground">Est. Export Time</div>
          <div className="text-lg font-medium">{exportTime}</div>
        </div>
      </div>

      {exportComplete && (
        <div className="space-y-3 pt-2">
          <Button className="w-full">
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Download Video
          </Button>
          <Button variant="outline" className="w-full">
            <Share2 className="mr-2 h-4 w-4" />
            Share Video
          </Button>
        </div>
      )}
      
      {exportComplete && (
        <div className="pt-4 flex items-center justify-center">
          <div className="flex items-center text-sm text-muted-foreground">
            <Check className="mr-2 h-4 w-4 text-green-500" />
            Successfully exported to {settings.location}
          </div>
        </div>
      )}
    </div>
  );
}