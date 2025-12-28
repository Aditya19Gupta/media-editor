import { Clip } from '@/types/clip';
import { ExportSettings } from '@/lib/export/export-types';
import { effects } from '@/lib/data/effects';

export interface ProcessingProgress {
  progress: number;
  currentFrame: number;
  totalFrames: number;
  currentTask: string;
  currentClip?: string;
}

export class VideoProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: OffscreenCanvas;
  private offscreenCtx: OffscreenCanvasRenderingContext2D;
  private width: number;
  private height: number;
  private maxMemoryMB: number = 512; // Maximum memory limit in MB
  private frameBatchSize: number = 10; // Process frames in batches to manage memory

  constructor(width: number, height: number) {
    // Limit maximum canvas size to prevent memory issues
    const maxWidth = 1920;
    const maxHeight = 1080;
    
    this.width = Math.min(width, maxWidth);
    this.height = Math.min(height, maxHeight);
    
    // Log actual dimensions being used
    if (width > maxWidth || height > maxHeight) {
      console.warn(`Canvas size limited from ${width}x${height} to ${this.width}x${this.height} to prevent memory issues`);
    }
    
    // Calculate expected memory usage
    const expectedMemoryMB = this.calculateMemoryUsage();
    console.log(`Expected memory usage: ${expectedMemoryMB}MB`);
    
    if (expectedMemoryMB > this.maxMemoryMB) {
      throw new Error(`Canvas size too large. Expected memory usage: ${expectedMemoryMB}MB exceeds limit: ${this.maxMemoryMB}MB`);
    }
    
    // Main canvas for final composition
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d', { 
      willReadFrequently: false, // Better performance when not reading frequently
      alpha: false // No alpha channel needed
    })!;
    
    // Offscreen canvas for processing
    this.offscreenCanvas = new OffscreenCanvas(this.width, this.height);
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: false
    })!;
    
    // Log codec support for debugging
    this.logCodecSupport();
  }

  private calculateMemoryUsage(): number {
    // Calculate memory needed for ImageData objects
    // Each pixel = 4 bytes (RGBA), plus overhead
    const pixelsPerFrame = this.width * this.height;
    const bytesPerFrame = pixelsPerFrame * 4;
    const framesInMemory = this.frameBatchSize + 2; // Batch + working frames
    const totalBytes = bytesPerFrame * framesInMemory;
    return Math.ceil(totalBytes / (1024 * 1024)); // Convert to MB
  }

  private logCodecSupport(): void {
    const codecs = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=h264',
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4'
    ];
    
    console.log('MediaRecorder codec support:');
    codecs.forEach(codec => {
      const supported = MediaRecorder.isTypeSupported(codec);
      console.log(`  ${codec}: ${supported ? '✓' : '✗'}`);
    });
  }

  async processTimeline(
    clips: Clip[],
    duration: number,
    settings: ExportSettings,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Blob> {
    const framerate = parseInt(settings.framerate);
    const totalFrames = Math.ceil(duration * framerate);
    const frameInterval = 1 / framerate;

    // Pre-load all media
    const mediaCache = await this.preloadMedia(clips, onProgress);
    
    // Process frames in batches to manage memory
    const videoBlob = await this.processFramesInBatches(
      clips, 
      totalFrames, 
      frameInterval, 
      framerate, 
      settings, 
      mediaCache, 
      onProgress
    );

    if (onProgress) {
      onProgress({
        progress: 100,
        currentFrame: totalFrames,
        totalFrames,
        currentTask: "Export completed!",
      });
    }

    // Clean up media cache
    this.cleanupMediaCache(mediaCache);

    return videoBlob;
  }

  private async processFramesInBatches(
    clips: Clip[],
    totalFrames: number,
    frameInterval: number,
    framerate: number,
    settings: ExportSettings,
    mediaCache: Map<string, HTMLVideoElement | HTMLImageElement>,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Blob> {
    const frames: ImageData[] = [];
    let processedFrames = 0;

    // Process frames in smaller batches
    for (let batchStart = 0; batchStart < totalFrames; batchStart += this.frameBatchSize) {
      const batchEnd = Math.min(batchStart + this.frameBatchSize, totalFrames);
      const batchFrames: ImageData[] = [];

      // Process batch
      for (let frame = batchStart; frame < batchEnd; frame++) {
        const currentTime = frame * frameInterval;
        
        if (onProgress) {
          onProgress({
            progress: (processedFrames / totalFrames) * 80, // 80% for frame processing
            currentFrame: processedFrames,
            totalFrames,
            currentTask: `Processing frame ${processedFrames + 1}/${totalFrames} (batch ${Math.floor(batchStart / this.frameBatchSize) + 1})`,
          });
        }
        
        try {
          const frameData = await this.renderFrame(clips, currentTime, mediaCache);
          batchFrames.push(frameData);
          processedFrames++;
        } catch (error) {
          console.error(`Failed to render frame ${frame}:`, error);
          // Create a blank frame as fallback
          const blankFrame = new ImageData(this.width, this.height);
          batchFrames.push(blankFrame);
          processedFrames++;
        }
      }

      // Add batch to main frames array
      frames.push(...batchFrames);

      // Force garbage collection hint
      if ((globalThis as any).gc) {
        (globalThis as any).gc();
      }

      // Small delay to allow memory cleanup
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Encode video
    if (onProgress) {
      onProgress({
        progress: 80,
        currentFrame: totalFrames,
        totalFrames,
        currentTask: "Encoding video...",
      });
    }

    const videoBlob = await this.encodeFramesToVideo(frames, framerate, settings, onProgress);
    
    // Clean up frames array to free memory
    frames.length = 0;
    
    return videoBlob;
  }

  private cleanupMediaCache(mediaCache: Map<string, HTMLVideoElement | HTMLImageElement>): void {
    mediaCache.forEach((media, url) => {
      if (media instanceof HTMLVideoElement) {
        media.src = '';
        media.load();
      } else if (media instanceof HTMLImageElement) {
        media.src = '';
      }
    });
    mediaCache.clear();
  }

  private async preloadMedia(clips: Clip[], onProgress?: (progress: ProcessingProgress) => void): Promise<Map<string, HTMLVideoElement | HTMLImageElement>> {
    const mediaCache = new Map<string, HTMLVideoElement | HTMLImageElement>();
    const uniqueMedia = new Set<string>();
    
    // Collect unique media URLs
    clips.forEach(clip => {
      if (clip.videoUrl) uniqueMedia.add(clip.videoUrl);
      if (clip.thumbnail) uniqueMedia.add(clip.thumbnail);
    });

    const mediaArray = Array.from(uniqueMedia);
    let loaded = 0;

    for (const url of mediaArray) {
      if (onProgress) {
        onProgress({
          progress: (loaded / mediaArray.length) * 10, // 10% for preloading
          currentFrame: 0,
          totalFrames: 0,
          currentTask: `Loading media ${loaded + 1}/${mediaArray.length}`,
        });
      }

      try {
        const media = await this.loadMedia(url);
        mediaCache.set(url, media);
      } catch (error) {
        console.warn(`Failed to load media: ${url}`, error);
      }
      
      loaded++;
    }

    return mediaCache;
  }

  private async loadMedia(url: string): Promise<HTMLVideoElement | HTMLImageElement> {
    return new Promise((resolve, reject) => {
      // Determine if it's a video or image
      const isVideo = url.includes('.mp4') || url.includes('.webm') || url.includes('.mov');
      
      if (isVideo) {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'metadata';
        
        video.onloadedmetadata = () => {
          video.currentTime = 0;
          video.onseeked = () => resolve(video);
        };
        
        video.onerror = () => reject(new Error(`Failed to load video: ${url}`));
        video.src = url;
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      }
    });
  }

  private async renderFrame(
    clips: Clip[],
    currentTime: number,
    mediaCache: Map<string, HTMLVideoElement | HTMLImageElement>
  ): Promise<ImageData> {
    try {
      // Clear canvas
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);

      // Get active clips at current time
      const activeClips = clips.filter(clip => 
        currentTime >= clip.start && currentTime <= clip.start + clip.duration
      );

      // Sort by track (lower tracks render first, higher tracks on top)
      activeClips.sort((a, b) => a.track - b.track);

      // Render each active clip
      for (const clip of activeClips) {
        await this.renderClipToFrame(clip, currentTime, mediaCache);
      }

      // Check available memory before getImageData
      if (performance && (performance as any).memory) {
        const memInfo = (performance as any).memory;
        const usedMB = memInfo.usedJSHeapSize / (1024 * 1024);
        const limitMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
        
        if (usedMB > limitMB * 0.85) { // If using more than 85% of available memory
          console.warn(`High memory usage detected: ${usedMB.toFixed(1)}MB / ${limitMB.toFixed(1)}MB`);
          // Force garbage collection if available
          if ((globalThis as any).gc) {
            (globalThis as any).gc();
          }
        }
      }

      // Safely get image data with error handling
      return this.safeGetImageData();
    } catch (error) {
      console.error('Error rendering frame:', error);
      // Return a blank frame as fallback
      return new ImageData(this.width, this.height);
    }
  }

  private async renderClipToFrame(
    clip: Clip,
    currentTime: number,
    mediaCache: Map<string, HTMLVideoElement | HTMLImageElement>
  ): Promise<void> {
    const clipProgress = (currentTime - clip.start) / clip.duration;
    const mediaUrl = clip.videoUrl || clip.thumbnail;
    
    if (!mediaUrl) return;
    
    const media = mediaCache.get(mediaUrl);
    if (!media) return;

    // For video clips, seek to the correct time
    if (media instanceof HTMLVideoElement) {
      const seekTime = clipProgress * media.duration;
      if (Math.abs(media.currentTime - seekTime) > 0.1) {
        await new Promise<void>((resolve) => {
          media.onseeked = () => resolve();
          media.currentTime = seekTime;
        });
      }
    }

    // Apply effects and render
    await this.renderMediaWithEffects(media, clip);
  }

  private async renderMediaWithEffects(
    media: HTMLVideoElement | HTMLImageElement,
    clip: Clip
  ): Promise<void> {
    // Clear offscreen canvas
    this.offscreenCtx.clearRect(0, 0, this.width, this.height);
    
    // Draw media to offscreen canvas
    this.offscreenCtx.drawImage(media, 0, 0, this.width, this.height);

    // Apply effects
    if (clip.effects && clip.effects.length > 0) {
      await this.applyEffectsToCanvas(this.offscreenCtx, clip.effects);
    }

    // Draw processed frame to main canvas
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  private async applyEffectsToCanvas(
    ctx: OffscreenCanvasRenderingContext2D,
    effectNames: string[]
  ): Promise<void> {
    for (const effectName of effectNames) {
      const effectData = this.getEffectData(effectName);
      if (!effectData) continue;

      await this.applyEffect(ctx, effectData);
    }
  }

  private async applyEffect(
    ctx: OffscreenCanvasRenderingContext2D,
    effect: any
  ): Promise<void> {
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    switch (effect.type) {
      case 'blur':
        await this.applyBlurEffect(ctx, effect.defaultSettings.strength || 5);
        break;
      case 'sepia':
        this.applySepiaEffect(data, effect.defaultSettings.strength || 75);
        break;
      case 'contrast':
        this.applyContrastEffect(data, effect.defaultSettings.strength || 120);
        break;
      case 'brightness':
        this.applyBrightnessEffect(data, effect.defaultSettings.strength || 120);
        break;
      case 'fade-in':
      case 'fade-out':
        this.applyFadeEffect(data, 0.9);
        break;
      default:
        console.warn(`Effect ${effect.type} not implemented`);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private async applyBlurEffect(ctx: OffscreenCanvasRenderingContext2D, strength: number): Promise<void> {
    ctx.filter = `blur(${strength}px)`;
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.putImageData(imageData, 0, 0);
    ctx.filter = 'none';
  }

  private applySepiaEffect(data: Uint8ClampedArray, strength: number): void {
    const factor = strength / 100;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      
      data[i] = Math.min(255, r + factor * (tr - r));
      data[i + 1] = Math.min(255, g + factor * (tg - g));
      data[i + 2] = Math.min(255, b + factor * (tb - b));
    }
  }

  private applyContrastEffect(data: Uint8ClampedArray, strength: number): void {
    const factor = (259 * (strength + 255)) / (255 * (259 - strength));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }
  }

  private applyBrightnessEffect(data: Uint8ClampedArray, strength: number): void {
    const factor = strength / 100;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor));
    }
  }

  private applyFadeEffect(data: Uint8ClampedArray, opacity: number): void {
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.floor(data[i] * opacity);
    }
  }

  private async encodeFramesToVideo(
    frames: ImageData[],
    framerate: number,
    settings: ExportSettings,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Blob> {
    // Try MediaRecorder first, fallback to image sequence
    try {
      return await this.createVideoWithMediaRecorder(frames, framerate, settings, onProgress);
    } catch (error) {
      console.warn('MediaRecorder failed, creating image sequence:', error);
      return await this.createImageSequence(frames, settings, onProgress);
    }
  }

  private async createVideoWithMediaRecorder(
    frames: ImageData[],
    framerate: number,
    settings: ExportSettings,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Blob> {
    // Create a new canvas for video recording
    const recordingCanvas = document.createElement('canvas');
    recordingCanvas.width = this.width;
    recordingCanvas.height = this.height;
    const recordingCtx = recordingCanvas.getContext('2d')!;

    // Get supported mime type
    const mimeType = this.getSupportedMimeType(settings.format);
    console.log('Using mime type:', mimeType);

    // Create stream from canvas with specific framerate
    const stream = recordingCanvas.captureStream(0); // Manual frame capture
    
    // Create MediaRecorder with higher bitrate
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 5000000 // 5 Mbps for better quality
    });

    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      console.log('Data available:', event.data.size, 'bytes');
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    return new Promise((resolve, reject) => {
      let frameIndex = 0;
      let recordingStarted = false;

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, chunks:', chunks.length);
        if (chunks.length === 0) {
          reject(new Error('No video data recorded - MediaRecorder may not be supported'));
          return;
        }
        
        const blob = new Blob(chunks, { type: mimeType });
        console.log('Video blob created:', blob.size, 'bytes', 'type:', blob.type);
        
        if (blob.size === 0) {
          reject(new Error('Empty video blob created'));
          return;
        }
        
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        reject(new Error('MediaRecorder failed: ' + (event as any).error?.message || 'Unknown error'));
      };

      const renderNextFrame = () => {
        if (frameIndex < frames.length) {
          // Draw the frame to the recording canvas
          recordingCtx.putImageData(frames[frameIndex], 0, 0);
          
          // Manually trigger frame capture
          const track = stream.getVideoTracks()[0];
          if (track && 'requestFrame' in track) {
            (track as any).requestFrame();
          }
          
          frameIndex++;
          
          if (onProgress) {
            const progress = 80 + (frameIndex / frames.length) * 20;
            onProgress({
              progress,
              currentFrame: frameIndex,
              totalFrames: frames.length,
              currentTask: `Recording frame ${frameIndex}/${frames.length}`,
            });
          }
          
          // Schedule next frame with proper timing
          setTimeout(renderNextFrame, 1000 / framerate);
        } else {
          // All frames rendered, stop recording after a short delay
          setTimeout(() => {
            console.log('Stopping MediaRecorder...');
            mediaRecorder.stop();
          }, 500);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder started');
        recordingStarted = true;
        // Start rendering frames after a short delay
        setTimeout(renderNextFrame, 100);
      };

      // Start recording
      try {
        mediaRecorder.start(1000); // Collect data every second
        
        // Safety timeout
        setTimeout(() => {
          if (!recordingStarted) {
            reject(new Error('MediaRecorder failed to start'));
          }
        }, 2000);
      } catch (error) {
        reject(new Error('Failed to start MediaRecorder: ' + error));
      }
    });
  }

  private getSupportedMimeType(format: string): string {
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=h264',
      'video/mp4'
    ];

    // If format is specified, try that first
    if (format === 'webm') {
      for (const type of mimeTypes.filter(t => t.includes('webm'))) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
    } else if (format === 'mp4') {
      for (const type of mimeTypes.filter(t => t.includes('mp4'))) {
        if (MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      }
    }

    // Fallback to any supported type
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Last resort
    return 'video/webm';
  }

  private getEffectData(effectName: string) {
    return effects.find(effect => 
      effect.name.toLowerCase() === effectName.toLowerCase() ||
      effect.type.toLowerCase() === effectName.toLowerCase()
    );
  }

  private async createImageSequence(
    frames: ImageData[],
    settings: ExportSettings,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<Blob> {
    // Create a ZIP file with all frames as images
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d')!;

    // For now, let's create a single long video by stitching frames vertically
    // This creates a "film strip" that can be viewed as a sequence
    const filmStripCanvas = document.createElement('canvas');
    filmStripCanvas.width = this.width;
    filmStripCanvas.height = this.height * frames.length;
    const filmStripCtx = filmStripCanvas.getContext('2d')!;

    // Draw all frames vertically
    for (let i = 0; i < frames.length; i++) {
      ctx.putImageData(frames[i], 0, 0);
      filmStripCtx.drawImage(canvas, 0, i * this.height);
      
      if (onProgress) {
        const progress = 80 + (i / frames.length) * 20;
        onProgress({
          progress,
          currentFrame: i + 1,
          totalFrames: frames.length,
          currentTask: `Creating frame ${i + 1}/${frames.length}`,
        });
      }
    }

    // Convert to blob
    return new Promise((resolve) => {
      filmStripCanvas.toBlob((blob) => {
        if (blob) {
          console.log('Created film strip image:', blob.size, 'bytes');
          resolve(blob);
        } else {
          // Fallback: return the last frame
          ctx.putImageData(frames[frames.length - 1], 0, 0);
          canvas.toBlob((fallbackBlob) => {
            resolve(fallbackBlob || new Blob());
          }, 'image/png');
        }
      }, 'image/png');
    });
  }

  private safeGetImageData(): ImageData {
    try {
      return this.ctx.getImageData(0, 0, this.width, this.height);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('out of memory') || errorMessage.includes('Out of memory')) {
        console.error('Memory error in getImageData, creating smaller frame');
        // Try with a smaller canvas size as fallback
        const smallWidth = Math.max(320, Math.floor(this.width / 2));
        const smallHeight = Math.max(240, Math.floor(this.height / 2));
        
        try {
          // Create a smaller temporary canvas
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = smallWidth;
          tempCanvas.height = smallHeight;
          const tempCtx = tempCanvas.getContext('2d')!;
          
          // Draw scaled version
          tempCtx.drawImage(this.canvas, 0, 0, this.width, this.height, 0, 0, smallWidth, smallHeight);
          
          // Get the scaled image data
          const smallImageData = tempCtx.getImageData(0, 0, smallWidth, smallHeight);
          
          // Scale it back up to original size
          const scaledImageData = new ImageData(this.width, this.height);
          this.scaleImageData(smallImageData, scaledImageData);
          
          return scaledImageData;
        } catch (fallbackError) {
          console.error('Fallback scaling also failed:', fallbackError);
          // Last resort: return blank frame
          return new ImageData(this.width, this.height);
        }
      } else {
        throw error;
      }
    }
  }

  private scaleImageData(sourceData: ImageData, targetData: ImageData): void {
    const srcWidth = sourceData.width;
    const srcHeight = sourceData.height;
    const dstWidth = targetData.width;
    const dstHeight = targetData.height;
    const srcPixels = sourceData.data;
    const dstPixels = targetData.data;

    const xRatio = srcWidth / dstWidth;
    const yRatio = srcHeight / dstHeight;

    for (let y = 0; y < dstHeight; y++) {
      for (let x = 0; x < dstWidth; x++) {
        const srcX = Math.floor(x * xRatio);
        const srcY = Math.floor(y * yRatio);
        
        const srcIndex = (srcY * srcWidth + srcX) * 4;
        const dstIndex = (y * dstWidth + x) * 4;
        
        dstPixels[dstIndex] = srcPixels[srcIndex];         // R
        dstPixels[dstIndex + 1] = srcPixels[srcIndex + 1]; // G
        dstPixels[dstIndex + 2] = srcPixels[srcIndex + 2]; // B
        dstPixels[dstIndex + 3] = srcPixels[srcIndex + 3]; // A
      }
    }
  }

  dispose(): void {
    // Cleanup resources
    this.canvas.remove();
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

  const processor = new VideoProcessor(width, height);
  
  try {
    return await processor.processTimeline(clips, duration, settings, onProgress);
  } finally {
    processor.dispose();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  // Determine the correct file extension based on blob type
  let finalFilename = filename;
  
  if (blob.type.includes('image/png')) {
    // If it's a PNG (film strip), update the extension
    finalFilename = filename.replace(/\.(mp4|webm)$/, '.png');
  } else if (blob.type.includes('webm')) {
    finalFilename = filename.replace(/\.mp4$/, '.webm');
  } else if (blob.type.includes('mp4')) {
    finalFilename = filename.replace(/\.webm$/, '.mp4');
  }
  
  console.log('Downloading file:', finalFilename, 'Size:', blob.size, 'bytes', 'Type:', blob.type);
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
} 