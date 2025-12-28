import { Clip } from '@/types/clip';

export interface SharedExportSettings {
  quality: 'ultra' | 'high' | 'medium' | 'low' | 'fast';
  videoBitrate: string; // e.g., "8M", "5M", "3M"
  audioBitrate: string; // e.g., "192k", "128k", "96k"
  format: string; // e.g., "mp4"
  resolution: string; // e.g., "1920x1080", "1280x720"
  framerate: number; // e.g., 30, 24, 60
}

export const qualityPresets: Record<string, SharedExportSettings> = {
  ultra: {
    quality: 'ultra',
    videoBitrate: '8M',
    audioBitrate: '192k',
    format: 'mp4',
    resolution: '1920x1080',
    framerate: 30,
  },
  high: {
    quality: 'high',
    videoBitrate: '5M',
    audioBitrate: '192k',
    format: 'mp4',
    resolution: '1920x1080',
    framerate: 30,
  },
  medium: {
    quality: 'medium',
    videoBitrate: '3M',
    audioBitrate: '128k',
    format: 'mp4',
    resolution: '1280x720',
    framerate: 30,
  },
  low: {
    quality: 'low',
    videoBitrate: '1M',
    audioBitrate: '96k',
    format: 'mp4',
    resolution: '854x480',
    framerate: 24,
  },
  fast: {
    quality: 'fast',
    videoBitrate: '2M',
    audioBitrate: '128k',
    format: 'mp4',
    resolution: '1280x720',
    framerate: 30,
  },
};

// Calculate actual duration from clips (same logic as SimpleVideoExporter)
export const calculateActualDuration = (clips: Clip[]): number => {
  if (!clips || clips.length === 0) return 0;
  
  let maxEndTime = 0;
  clips.forEach(clip => {
    const endTime = clip.start + clip.duration;
    if (endTime > maxEndTime) {
      maxEndTime = endTime;
    }
  });
  
  return maxEndTime;
};

// Calculate estimated file size (same logic as SimpleVideoExporter)
export const calculateEstimatedFileSize = (clips: Clip[], exportSettings: SharedExportSettings): string => {
  const actualDuration = calculateActualDuration(clips);
  if (actualDuration === 0) return '0 MB';
  
  // Convert bitrates from string to numbers
  const videoBitrateNum = parseInt(exportSettings.videoBitrate.replace('M', '')) * 1000000; // Convert Mbps to bps
  const audioBitrateNum = parseInt(exportSettings.audioBitrate.replace('k', '')) * 1000; // Convert kbps to bps
  
  // Calculate estimated size in bytes
  const totalBitrate = videoBitrateNum + audioBitrateNum;
  const estimatedSizeBytes = (totalBitrate * actualDuration) / 8; // Convert bits to bytes
  
  // Convert to appropriate unit
  if (estimatedSizeBytes < 1024 * 1024) {
    return `${Math.round(estimatedSizeBytes / 1024)} KB`;
  } else if (estimatedSizeBytes < 1024 * 1024 * 1024) {
    return `${Math.round((estimatedSizeBytes / (1024 * 1024)) * 10) / 10} MB`;
  } else {
    return `${Math.round((estimatedSizeBytes / (1024 * 1024 * 1024)) * 10) / 10} GB`;
  }
};

// Get clip counts (same logic as SimpleVideoExporter)
export const getClipCounts = (clips: Clip[]) => {
  return clips.reduce((acc, clip) => {
    if (clip.type === 'video') acc.video += 1;
    else if (clip.type === 'audio') acc.audio += 1;
    else if (clip.type === 'image') acc.image += 1;
    else if (clip.type === 'text') acc.text += 1;
    return acc;
  }, { video: 0, audio: 0, image: 0, text: 0 });
};

// Calculate estimated export time based on actual duration and quality
export const calculateEstimatedExportTime = (clips: Clip[], exportSettings: SharedExportSettings): string => {
  const actualDuration = calculateActualDuration(clips);
  if (actualDuration === 0) return '0s';
  
  // Base multiplier based on quality (higher quality = slower export)
  const qualityMultipliers = {
    ultra: 2.5,
    high: 2.0,
    medium: 1.5,
    low: 1.0,
    fast: 0.8,
  };
  
  const multiplier = qualityMultipliers[exportSettings.quality] || 1.5;
  const estimatedSeconds = Math.round(actualDuration * multiplier);
  
  if (estimatedSeconds < 60) {
    return `${estimatedSeconds}s`;
  } else if (estimatedSeconds < 3600) {
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = estimatedSeconds % 60;
    return `${minutes}m ${seconds}s`;
  } else {
    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
};

// Format resolution for display
export const formatResolution = (resolution: string): string => {
  const resolutionMap: Record<string, string> = {
    '1920x1080': '1080p',
    '1280x720': '720p',
    '854x480': '480p',
    '3840x2160': '4K',
    '2560x1440': '1440p',
  };
  
  return resolutionMap[resolution] || resolution;
};

// Convert old export settings to shared format
export const convertToSharedSettings = (oldSettings: any): SharedExportSettings => {
  // Map from old format to new format
  const qualityMapping: Record<string, 'ultra' | 'high' | 'medium' | 'low' | 'fast'> = {
    '1080p': 'high',
    '720p': 'medium',
    '480p': 'low',
    '4k': 'ultra',
  };
  
  const baseQuality = qualityMapping[oldSettings.resolution] || 'medium';
  const baseSettings = qualityPresets[baseQuality];
  
  // Adjust bitrates based on compression level (if available)
  let videoBitrate = baseSettings.videoBitrate;
  let audioBitrate = baseSettings.audioBitrate;
  
  if (oldSettings.compression !== undefined) {
    // Higher compression = lower bitrate
    const compressionFactor = 1 - (oldSettings.compression / 100) * 0.6; // Max 60% reduction
    const videoBitrateNum = parseInt(videoBitrate.replace('M', ''));
    const audioBitrateNum = parseInt(audioBitrate.replace('k', ''));
    
    videoBitrate = `${Math.max(1, Math.round(videoBitrateNum * compressionFactor))}M`;
    audioBitrate = `${Math.max(64, Math.round(audioBitrateNum * compressionFactor))}k`;
  }
  
  return {
    ...baseSettings,
    videoBitrate,
    audioBitrate,
    format: oldSettings.format || baseSettings.format,
    framerate: parseInt(oldSettings.framerate) || baseSettings.framerate
  };
}; 