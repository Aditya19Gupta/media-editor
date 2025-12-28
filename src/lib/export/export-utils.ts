import { ExportSettings } from "./export-types";

export function formatFileSize(settings: ExportSettings): string {
  // Calculate approximate file size based on settings
  const baseSize = getBaseSizeByResolution(settings.resolution);
  const compressionFactor = 1 - (settings.compression / 100) * 0.7;
  const formatFactor = settings.format === "mp4" ? 1 : 0.8; // WebM is typically smaller
  const framerateFactor = getFramerateFactor(settings.framerate);
  
  // Calculate in MB
  const sizeInMB = baseSize * compressionFactor * formatFactor * framerateFactor;
  
  // Convert to appropriate unit
  if (sizeInMB < 1000) {
    return `${Math.round(sizeInMB * 10) / 10} MB`;
  } else {
    return `${Math.round(sizeInMB / 100) / 10} GB`;
  }
}

export function calculateExportTime(settings: ExportSettings): number {
  // Calculate approximate export time in seconds based on settings
  const baseTime = getBaseTimeByResolution(settings.resolution);
  const compressionTime = (settings.compression / 100) * 30; // Higher compression takes longer
  const formatFactor = settings.format === "mp4" ? 1 : 1.2; // WebM typically takes longer
  
  return Math.round(baseTime + compressionTime) * formatFactor;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} sec`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }
}

// Helper functions
function getBaseSizeByResolution(resolution: string): number {
  switch (resolution) {
    case "720p":
      return 150; // 150MB base size
    case "1080p":
      return 450; // 450MB base size
    case "4k":
      return 1800; // 1.8GB base size
    default:
      return 450;
  }
}

function getBaseTimeByResolution(resolution: string): number {
  switch (resolution) {
    case "720p":
      return 60; // 1 minute base time
    case "1080p":
      return 120; // 2 minutes base time
    case "4k":
      return 300; // 5 minutes base time
    default:
      return 120;
  }
}

function getFramerateFactor(framerate: string): number {
  switch (framerate) {
    case "24":
      return 0.8;
    case "30":
      return 1.0;
    case "60":
      return 1.8;
    default:
      return 1.0;
  }
}