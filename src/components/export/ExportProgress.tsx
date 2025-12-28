"use client";

import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ExportSettings } from "@/lib/export/export-types";
import { calculateExportTime, formatTime } from "@/lib/export/export-utils";
import { calculateEstimatedFileSize, convertToSharedSettings } from "@/lib/export/shared-export-utils";
import { useTimeline } from "@/contexts/TimelineContext";
import { X } from "lucide-react";

interface ExportProgressProps {
  progress: number;
  onCancel: () => void;
  settings: ExportSettings;
  currentTask?: string;
}

export function ExportProgress({ 
  progress, 
  onCancel, 
  settings,
  currentTask: externalCurrentTask
}: ExportProgressProps) {
  const { timelineState } = useTimeline();
  const [timeRemaining, setTimeRemaining] = useState(calculateExportTime(settings));
  const [internalCurrentTask, setInternalCurrentTask] = useState("Preparing export...");

  // Use external currentTask if provided, otherwise use internal logic
  const currentTask = externalCurrentTask || internalCurrentTask;

  // Calculate accurate file size using timeline data
  const getAccurateFileSize = () => {
    if (timelineState?.clips) {
      const sharedSettings = convertToSharedSettings(settings);
      return calculateEstimatedFileSize(timelineState.clips, sharedSettings);
    }
    return "Calculating...";
  };

  useEffect(() => {
    const initialTime = calculateExportTime(settings);
    setTimeRemaining(Math.ceil(initialTime * (100 - progress) / 100));
    
    // Only update internal task if no external task is provided
    if (!externalCurrentTask) {
      if (progress < 10) {
        setInternalCurrentTask("Preparing export...");
      } else if (progress < 30) {
        setInternalCurrentTask("Processing video...");
      } else if (progress < 60) {
        setInternalCurrentTask("Applying compression...");
      } else if (progress < 80) {
        setInternalCurrentTask("Finalizing...");
      } else {
        setInternalCurrentTask("Almost done...");
      }
    }
  }, [progress, settings, externalCurrentTask]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Exporting Video</h3>
        <p className="text-sm text-muted-foreground">{currentTask}</p>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{progress}%</span>
          <span>{formatTime(timeRemaining)} remaining</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">File:</span>
          <span className="font-medium">{settings.fileName}.{settings.format}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Resolution:</span>
          <span className="font-medium">{settings.resolution}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated size:</span>
          <span className="font-medium">{getAccurateFileSize()}</span>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCancel}
          className="w-full"
        >
          <X className="mr-2 h-4 w-4" />
          Cancel Export
        </Button>
      </div>
      
      <div className="pt-6">
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="text-center text-muted-foreground">
            You can continue working while your video exports.
            The export will complete in the background.
          </p>
        </div>
      </div>
    </div>
  );
}