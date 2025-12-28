import { Clip } from '@/types/clip';
import { ExportSettings } from '@/lib/export/export-types';
import { VideoProcessor, ProcessingProgress } from './videoProcessor';
import { AudioProcessor } from './audioProcessor';

// Re-export ProcessingProgress for external use
export type { ProcessingProgress };

export class VideoExporter {
  private videoProcessor: VideoProcessor;
  private audioProcessor: AudioProcessor;

  constructor(width: number, height: number) {
    this.videoProcessor = new VideoProcessor(width, height);
    this.audioProcessor = new AudioProcessor();
  }

  async exportVideo(
    clips: Clip[],
    duration: number,
    settings: ExportSettings,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Blob> {
    try {
      // Step 1: Process audio tracks
      if (onProgress) {
        onProgress({
          progress: 0,
          currentFrame: 0,
          totalFrames: 0,
          currentTask: "Processing audio tracks...",
        });
      }

      const audioBuffer = await this.audioProcessor.processAudioTracks(clips, duration);

      // Step 2: Process video with progress updates
      const videoBlob = await this.videoProcessor.processTimeline(
        clips,
        duration,
        settings,
        (videoProgress) => {
          if (onProgress) {
            // Video processing takes 80% of total progress
            onProgress({
              ...videoProgress,
              progress: 10 + (videoProgress.progress * 0.8),
            });
          }
        }
      );

      // Step 3: Combine audio and video (if audio exists)
      if (this.hasAudioContent(audioBuffer)) {
        if (onProgress) {
          onProgress({
            progress: 90,
            currentFrame: 0,
            totalFrames: 0,
            currentTask: "Combining audio and video...",
          });
        }

        const finalBlob = await this.combineAudioVideo(videoBlob, audioBuffer, settings);
        
        if (onProgress) {
          onProgress({
            progress: 100,
            currentFrame: 0,
            totalFrames: 0,
            currentTask: "Export completed!",
          });
        }

        return finalBlob;
      } else {
        // No audio to combine, return video only
        if (onProgress) {
          onProgress({
            progress: 100,
            currentFrame: 0,
            totalFrames: 0,
            currentTask: "Export completed!",
          });
        }

        return videoBlob;
      }
    } catch (error) {
      console.error('Video export failed:', error);
      throw error;
    }
  }

  private hasAudioContent(audioBuffer: AudioBuffer): boolean {
    // Check if audio buffer has any non-zero samples
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const data = audioBuffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > 0.001) {
          return true;
        }
      }
    }
    return false;
  }

  private async combineAudioVideo(
    videoBlob: Blob,
    audioBuffer: AudioBuffer,
    settings: ExportSettings
  ): Promise<Blob> {
    // For now, we'll return the video blob as-is since combining audio/video
    // in the browser is complex and would require additional libraries like FFmpeg.wasm
    // This is a placeholder for future enhancement
    
    console.log('Audio processing completed, but audio-video combination requires additional implementation');
    console.log('Audio buffer details:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels
    });
    
    // TODO: Implement audio-video combination using FFmpeg.wasm or similar
    return videoBlob;
  }

  dispose(): void {
    this.videoProcessor.dispose();
    this.audioProcessor.dispose();
  }
}

export async function exportTimelineAsVideo(
  clips: Clip[],
  duration: number,
  settings: ExportSettings,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Blob> {
  const resolution = settings.resolution;
  let width = 1920, height = 1080;
  
  switch (resolution) {
    case '720p':
      width = 1280;
      height = 720;
      break;
    case '1080p':
      width = 1920;
      height = 1080;
      break;
    case '4k':
      width = 3840;
      height = 2160;
      break;
  }

  // Calculate expected memory usage and provide warnings
  const pixelsPerFrame = width * height;
  const bytesPerFrame = pixelsPerFrame * 4; // RGBA
  const estimatedMemoryMB = Math.ceil((bytesPerFrame * 20) / (1024 * 1024)); // Estimate for 20 frames in memory
  
  console.log(`Export settings: ${width}x${height}, estimated memory: ${estimatedMemoryMB}MB`);
  
  // If memory usage is too high, suggest a lower resolution
  if (estimatedMemoryMB > 400) {
    console.warn(`High memory usage expected (${estimatedMemoryMB}MB). Consider using a lower resolution.`);
  }

  let exporter: VideoExporter | null = null;
  
  try {
    exporter = new VideoExporter(width, height);
    return await exporter.exportVideo(clips, duration, settings, onProgress);
  } catch (error) {
    console.error('Export failed with original settings:', error);
    
    // If we get a memory error, try with reduced resolution
    if (error instanceof Error && error.message.includes('memory')) {
      console.log('Attempting fallback with reduced resolution...');
      
      // Try with lower resolution
      let fallbackWidth = width;
      let fallbackHeight = height;
      
      if (resolution === '4k') {
        fallbackWidth = 1920;
        fallbackHeight = 1080;
        console.log('Falling back from 4K to 1080p');
      } else if (resolution === '1080p') {
        fallbackWidth = 1280;
        fallbackHeight = 720;
        console.log('Falling back from 1080p to 720p');
      } else if (resolution === '720p') {
        fallbackWidth = 854;
        fallbackHeight = 480;
        console.log('Falling back from 720p to 480p');
      }
      
      if (fallbackWidth !== width || fallbackHeight !== height) {
        try {
          if (exporter) {
            exporter.dispose();
          }
          exporter = new VideoExporter(fallbackWidth, fallbackHeight);
          
          if (onProgress) {
            onProgress({
              progress: 0,
              currentFrame: 0,
              totalFrames: 0,
              currentTask: `Retrying with ${fallbackWidth}x${fallbackHeight} resolution due to memory constraints...`,
            });
          }
          
          return await exporter.exportVideo(clips, duration, settings, onProgress);
        } catch (fallbackError) {
          console.error('Fallback export also failed:', fallbackError);
          throw new Error(`Export failed even with reduced resolution. Original error: ${error.message}`);
        }
      }
    }
    
    throw error;
  } finally {
    if (exporter) {
      exporter.dispose();
    }
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 