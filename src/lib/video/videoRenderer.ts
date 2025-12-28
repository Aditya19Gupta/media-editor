import { Clip } from '@/types/clip';
import { ClipEffect } from '@/types/editor';
import { ExportSettings } from '@/lib/export/export-types';
import { effects } from '@/lib/data/effects';

export interface RenderProgress {
  progress: number;
  currentFrame: number;
  totalFrames: number;
  currentTask: string;
}

export class VideoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private clips: Clip[] = [];
  private currentTime: number = 0;

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
  }

  async renderTimeline(
    clips: Clip[],
    duration: number,
    settings: ExportSettings,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<Blob> {
    const framerate = parseInt(settings.framerate);
    const totalFrames = Math.ceil(duration * framerate);
    const frameInterval = 1 / framerate;

    // Setup MediaRecorder for video capture
    const stream = this.canvas.captureStream(framerate);
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: settings.format === 'webm' ? 'video/webm' : 'video/mp4'
    });

    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    return new Promise((resolve, reject) => {
      this.mediaRecorder!.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: settings.format === 'webm' ? 'video/webm' : 'video/mp4'
        });
        resolve(blob);
      };

      this.mediaRecorder!.onerror = (event) => {
        reject(new Error('MediaRecorder error'));
      };

      this.mediaRecorder!.start();

      // Render each frame
      this.renderFrames(clips, duration, framerate, totalFrames, onProgress)
        .then(() => {
          this.mediaRecorder!.stop();
        })
        .catch(reject);
    });
  }

  private async renderFrames(
    clips: Clip[],
    duration: number,
    framerate: number,
    totalFrames: number,
    onProgress?: (progress: RenderProgress) => void
  ): Promise<void> {
    const frameInterval = 1 / framerate;

    for (let frame = 0; frame < totalFrames; frame++) {
      const currentTime = frame * frameInterval;
      
      // Clear canvas
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Get active clips at current time
      const activeClips = clips.filter(clip => 
        currentTime >= clip.start && currentTime <= clip.start + clip.duration
      );

      // Sort by track (higher tracks render on top)
      activeClips.sort((a, b) => a.track - b.track);

      // Render each active clip
      for (const clip of activeClips) {
        await this.renderClip(clip, currentTime);
      }

      // Report progress
      if (onProgress) {
        const progress = (frame / totalFrames) * 100;
        onProgress({
          progress,
          currentFrame: frame,
          totalFrames,
          currentTask: this.getTaskDescription(progress)
        });
      }

      // Wait for next frame
      await new Promise(resolve => setTimeout(resolve, 1000 / framerate));
    }
  }

  private async renderClip(clip: Clip, currentTime: number): Promise<void> {
    const clipProgress = (currentTime - clip.start) / clip.duration;
    
    if (clip.type === 'video' && clip.videoUrl) {
      await this.renderVideoClip(clip, clipProgress);
    } else if (clip.type === 'image' && clip.thumbnail) {
      await this.renderImageClip(clip, clipProgress);
    }
  }

  private async renderVideoClip(clip: Clip, progress: number): Promise<void> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      
      video.onloadeddata = () => {
        video.currentTime = progress * video.duration;
        
        video.onseeked = () => {
          // Apply effects and draw to canvas
          this.drawMediaWithEffects(video, clip);
          resolve();
        };
      };
      
      video.onerror = () => resolve(); // Skip on error
      video.src = clip.videoUrl!;
    });
  }

  private async renderImageClip(clip: Clip, progress: number): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.drawMediaWithEffects(img, clip);
        resolve();
      };
      
      img.onerror = () => resolve(); // Skip on error
      img.src = clip.thumbnail!;
    });
  }

  private drawMediaWithEffects(media: HTMLVideoElement | HTMLImageElement, clip: Clip): void {
    // Create temporary canvas for effects processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Regular clip - draw media and apply effects
    tempCtx.drawImage(media, 0, 0, tempCanvas.width, tempCanvas.height);

    // Apply effects (effects are string arrays, not ClipEffect objects)
    if (clip.effects && clip.effects.length > 0) {
      this.applyEffectsToCanvas(tempCtx, clip.effects);
    }

    // Draw to main canvas
    this.ctx.drawImage(tempCanvas, 0, 0);
  }

  private applyEffectsToCanvas(ctx: CanvasRenderingContext2D, effects: string[]): void {
    effects.forEach(effectName => {
      switch (effectName) {
        case 'blur':
          // Apply blur effect
          ctx.filter = `blur(5px)`;
          break;
        case 'brightness':
          // Apply brightness effect
          ctx.filter = `brightness(120%)`;
          break;
        case 'contrast':
          // Apply contrast effect
          ctx.filter = `contrast(120%)`;
          break;
        case 'sepia':
          // Apply sepia effect
          ctx.filter = `sepia(1)`;
          break;
        case 'fade-in':
        case 'fade-out':
          // Fade effects will be handled by timeline rendering logic
          break;
        default:
          ctx.filter = 'none';
          break;
      }
    });
  }

  private getEffectData(effectName: string) {
    return effects.find(effect => 
      effect.name.toLowerCase() === effectName.toLowerCase()
    );
  }

  private getTaskDescription(progress: number): string {
    if (progress < 10) return "Preparing render...";
    if (progress < 30) return "Processing video clips...";
    if (progress < 60) return "Applying effects...";
    if (progress < 80) return "Encoding video...";
    if (progress < 95) return "Finalizing...";
    return "Almost done...";
  }

  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}

export async function exportTimelineAsVideo(
  clips: Clip[],
  duration: number,
  settings: ExportSettings,
  onProgress?: (progress: RenderProgress) => void
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

  const renderer = new VideoRenderer(width, height);
  
  try {
    return await renderer.renderTimeline(clips, duration, settings, onProgress);
  } finally {
    renderer.dispose();
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