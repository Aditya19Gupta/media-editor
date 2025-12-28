import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Clip, TransitionEffect } from '@/types/clip';
import TimelinePreview from './TimelinePreview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Video, X, Play, Pause } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import useEditorStore from '@/store/editorStore';
import { effects } from '@/lib/data/effects';

interface SimpleVideoExporterProps {
  clips: Clip[];
  transitions?: TransitionEffect[];
  duration: number;
}

interface ExportSettings {
  quality: 'ultra' | 'high' | 'medium' | 'low' | 'fast';
  frameRate: number;
  width: number;
  height: number;
  format: 'mp4' | 'webm';
  videoBitrate: string;
  audioBitrate: string;
}

const EXPORT_PRESETS = {
  ultra: {
    width: 1920,
    height: 1080,
    frameRate: 60,
    videoBitrate: '12M',
    audioBitrate: '320k',
    format: 'mp4' as const
  },
  high: {
    width: 1920,
    height: 1080,
    frameRate: 30,
    videoBitrate: '8M',
    audioBitrate: '192k',
    format: 'mp4' as const
  },
  medium: {
    width: 1280,
    height: 720,
    frameRate: 30,
    videoBitrate: '4M',
    audioBitrate: '128k',
    format: 'mp4' as const
  },
  low: {
    width: 854,
    height: 480,
    frameRate: 24,
    videoBitrate: '2M',
    audioBitrate: '96k',
    format: 'mp4' as const
  },
  fast: {
    width: 1280,
    height: 720,
    frameRate: 24,
    videoBitrate: '3M',
    audioBitrate: '128k',
    format: 'mp4' as const
  },
};

const SimpleVideoExporter: React.FC<SimpleVideoExporterProps> = ({
  clips,
  transitions = [],
  duration,
}) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [actualDuration, setActualDuration] = useState(0);
  const [ffmpegLoaded, setFFmpegLoaded] = useState(false);
  const [exportLog, setExportLog] = useState<string[]>([]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    quality: 'high',
    ...EXPORT_PRESETS.high,
  });

  // References
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);

  // Calculate actual video duration
  const calculateActualDuration = useCallback(() => {
    if (clips.length === 0) return 0;
    const maxEndTime = Math.max(...clips.map(clip => clip.start + clip.duration));
    return Math.max(maxEndTime, 5); // Minimum 5 seconds for very short videos
  }, [clips]);

  // Update actual duration when clips change
  useEffect(() => {
    const newDuration = calculateActualDuration();
    setActualDuration(newDuration);
  }, [clips, calculateActualDuration]);

  const updateExportSettings = useCallback((quality: 'ultra' | 'high' | 'medium' | 'low' | 'fast') => {
    setExportSettings({
      quality,
      ...EXPORT_PRESETS[quality],
    });
  }, []);

  // Initialize FFmpeg
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded) return;

    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      // Load FFmpeg with progress tracking
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
        setExportLog(prev => [...prev.slice(-10), message]); // Keep last 10 logs
      });

      ffmpeg.on('progress', ({ progress, time }) => {
        if (progress > 0) {
          setExportProgress(Math.min(progress * 100, 99));
        }
      });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setFFmpegLoaded(true);
      toast({
        title: "FFmpeg loaded successfully",
        description: "Ready for high-quality video export",
      });
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      toast({
        title: "FFmpeg loading failed",
        description: "Please try refreshing the page",
        variant: "destructive",
      });
    }
  }, [ffmpegLoaded, toast]);

  // Load FFmpeg on component mount
  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]);

  // Force update text overlays and effects at current time
  const updateTextAndEffects = useCallback(async (currentFrameTime: number) => {
    // Give DOM a moment to update with the new currentTime
    await new Promise(resolve => setTimeout(resolve, 5));
  }, []);

  // Apply effects using a more reliable approach
  const applyEffectsToImageData = useCallback((
    ctx: CanvasRenderingContext2D,
    clip: Clip,
    currentFrameTime: number,
    activeTransitions: TransitionEffect[],
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    let allEffects = [...(clip.effects || [])];

    // Add transition effects if this clip is in an active transition
    const relevantTransitions = activeTransitions.filter(transition =>
      transition.fromClipId === clip.id || transition.toClipId === clip.id
    );

    relevantTransitions.forEach(transition => {
      if (transition.settings?.effectType) {
        allEffects.push(transition.settings.effectType);
      }
    });

    if (allEffects.length === 0) return { opacity: 1 };

    let opacity = 1;
    const clipProgress = Math.max(0, Math.min(1, (currentFrameTime - clip.start) / clip.duration));

    allEffects.forEach(effectId => {
      const effect = effects.find(e => e.id === effectId);
      if (!effect) return;

      console.log(`✅ Applying effect: ${effect.name} (${effect.type})`);

      switch (effect.type) {
        case 'blur':
          // Apply blur using image data manipulation
          try {
            if (width > 0 && height > 0) {
              const imageData = ctx.getImageData(x, y, width, height);
              const blurredData = applyBlurEffect(imageData, effect.defaultSettings?.strength || 5);
              ctx.putImageData(blurredData, x, y);
            }
          } catch (e) {
            console.warn('Blur effect failed, skipping');
          }
          break;
        case 'sepia':
          try {
            if (width > 0 && height > 0) {
              const imageData = ctx.getImageData(x, y, width, height);
              const sepiaData = applySepiaEffect(imageData, (effect.defaultSettings?.strength || 75) / 100);
              ctx.putImageData(sepiaData, x, y);
            }
          } catch (e) {
            console.warn('Sepia effect failed, skipping');
          }
          break;
        case 'brightness':
          try {
            if (width > 0 && height > 0) {
              const imageData = ctx.getImageData(x, y, width, height);
              const brightnessData = applyBrightnessEffect(imageData, (effect.defaultSettings?.strength || 120) / 100);
              ctx.putImageData(brightnessData, x, y);
            }
          } catch (e) {
            console.warn('Brightness effect failed, skipping');
          }
          break;
        case 'contrast':
          try {
            if (width > 0 && height > 0) {
              const imageData = ctx.getImageData(x, y, width, height);
              const contrastData = applyContrastEffect(imageData, (effect.defaultSettings?.strength || 120) / 100);
              ctx.putImageData(contrastData, x, y);
            }
          } catch (e) {
            console.warn('Contrast effect failed, skipping');
          }
          break;
        case 'fade-in':
          const fadeInDuration = Math.min(effect.defaultSettings?.duration || 1.5, clip.duration);
          const fadeInProgress = Math.min(1, (currentFrameTime - clip.start) / fadeInDuration);
          opacity *= Math.max(0, Math.min(1, fadeInProgress));
          break;
        case 'fade-out':
          const fadeOutDuration = Math.min(effect.defaultSettings?.duration || 1.5, clip.duration);
          const timeFromEnd = (clip.start + clip.duration) - currentFrameTime;
          const fadeOutProgress = Math.min(1, timeFromEnd / fadeOutDuration);
          opacity *= Math.max(0, Math.min(1, fadeOutProgress));
          break;
      }
    });

    return { opacity };
  }, []);

  // Image data effect functions
  const applyBlurEffect = useCallback((imageData: ImageData, radius: number): ImageData => {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    // Optimized box blur for better performance - reduced radius for speed
    const blurRadius = Math.max(1, Math.min(radius / 2, 3)); // Reduce radius for speed

    // Use step size for faster processing on large images
    const step = width > 200 ? 2 : 1;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;

        for (let dy = -blurRadius; dy <= blurRadius; dy += step) {
          for (let dx = -blurRadius; dx <= blurRadius; dx += step) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const idx = (ny * width + nx) * 4;
              r += imageData.data[idx];
              g += imageData.data[idx + 1];
              b += imageData.data[idx + 2];
              a += imageData.data[idx + 3];
              count++;
            }
          }
        }

        if (count > 0) {
          const idx = (y * width + x) * 4;
          data[idx] = r / count;
          data[idx + 1] = g / count;
          data[idx + 2] = b / count;
          data[idx + 3] = a / count;

          // Fill adjacent pixels if using step > 1
          if (step > 1 && x + 1 < width) {
            const nextIdx = (y * width + x + 1) * 4;
            data[nextIdx] = data[idx];
            data[nextIdx + 1] = data[idx + 1];
            data[nextIdx + 2] = data[idx + 2];
            data[nextIdx + 3] = data[idx + 3];
          }
        }
      }
    }

    return new ImageData(data, width, height);
  }, []);

  const applySepiaEffect = useCallback((imageData: ImageData, intensity: number): ImageData => {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const tr = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
      const tg = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
      const tb = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));

      data[i] = r + intensity * (tr - r);
      data[i + 1] = g + intensity * (tg - g);
      data[i + 2] = b + intensity * (tb - b);
    }

    return new ImageData(data, imageData.width, imageData.height);
  }, []);

  const applyBrightnessEffect = useCallback((imageData: ImageData, brightness: number): ImageData => {
    const data = new Uint8ClampedArray(imageData.data);
    const factor = brightness;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
    }

    return new ImageData(data, imageData.width, imageData.height);
  }, []);

  const applyContrastEffect = useCallback((imageData: ImageData, contrast: number): ImageData => {
    const data = new Uint8ClampedArray(imageData.data);
    const factor = contrast;
    const intercept = 128 * (1 - factor);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * factor + intercept));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor + intercept));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor + intercept));
    }

    return new ImageData(data, imageData.width, imageData.height);
  }, []);

  // Get transition opacity for overlapping transitions
  const getTransitionOpacity = useCallback((
    clip: Clip,
    currentFrameTime: number,
    activeTransitions: TransitionEffect[]
  ) => {
    const relevantTransitions = activeTransitions.filter(transition =>
      transition.fromClipId === clip.id || transition.toClipId === clip.id
    );

    if (relevantTransitions.length === 0) return 1;

    let transitionOpacity = 1;

    relevantTransitions.forEach(transition => {
      const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
      const midPoint = transition.startTime + overlapPerSide;

      if (transition.type === 'crossfade') {
        if (transition.fromClipId === clip.id) {
          // First clip: full opacity until midpoint, then fade out
          if (currentFrameTime <= midPoint) {
            transitionOpacity = 1;
          } else {
            const fadeProgress = (currentFrameTime - midPoint) / overlapPerSide;
            transitionOpacity = Math.max(0, 1 - fadeProgress);
          }
        } else if (transition.toClipId === clip.id) {
          // Second clip: fade in from midpoint onwards
          if (currentFrameTime < midPoint) {
            const fadeProgress = (currentFrameTime - transition.startTime) / overlapPerSide;
            transitionOpacity = Math.max(0, fadeProgress);
          } else {
            transitionOpacity = 1;
          }
        }
      }
    });

    return transitionOpacity;
  }, []);

  // Generate video frames from timeline
  const generateFrames = useCallback(async (): Promise<string[]> => {
    const frameFiles: string[] = [];
    const frameInterval = 1 / exportSettings.frameRate;
    const totalFrames = Math.ceil(actualDuration * exportSettings.frameRate);

    const canvas = canvasRef.current;
    const hiddenPreview = hiddenPreviewRef.current;

    if (!canvas || !hiddenPreview) {
      throw new Error('Canvas or preview element not found');
    }

    const ctx = canvas.getContext('2d', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    }) as CanvasRenderingContext2D;
    if (!ctx) throw new Error('Canvas context not available');

    // Set canvas size
    canvas.width = exportSettings.width;
    canvas.height = exportSettings.height;

    // Set high-quality rendering options
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    console.log(`Starting frame generation: ${totalFrames} frames at ${exportSettings.frameRate}fps`);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const currentFrameTime = frameIndex * frameInterval;
      setCurrentTime(currentFrameTime);

      // Update text and effects for current time
      await updateTextAndEffects(currentFrameTime);

      // Optimized wait time for faster export
      await new Promise(resolve => setTimeout(resolve, 5)); // Reduced from 15 to 5

      // Clear canvas with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, exportSettings.width, exportSettings.height);

      try {
        // Find the preview display element
        const previewDisplay = hiddenPreview.querySelector('.timeline-preview-display') as HTMLElement;
        if (previewDisplay) {
          // Wait for DOM to update with current time
          await new Promise(resolve => setTimeout(resolve, 3)); // Reduced from 8 to 3

          // Render videos with consistent aspect ratio handling AND EFFECTS
          const videos = previewDisplay.querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
          for (const video of Array.from(videos)) {
            if (video.readyState >= 2) {
              // Ensure video is at correct time
              if (Math.abs(video.currentTime - currentFrameTime) > 0.1) {
                video.currentTime = currentFrameTime;
                await new Promise(resolve => setTimeout(resolve, 3)); // Reduced for speed
              }

              // Find the corresponding clip for effects
              const videoSrc = video.src;
              const currentClip = clips.find(clip =>
                (clip.type === 'video' || clip.type === 'audio') &&
                clip.videoUrl === videoSrc &&
                currentFrameTime >= clip.start &&
                currentFrameTime <= clip.start + clip.duration
              );

              if (!currentClip) continue;

              // Get active transitions for this frame
              const activeTransitions = transitions.filter(transition =>
                currentFrameTime >= transition.startTime &&
                currentFrameTime <= transition.startTime + transition.duration
              );

              // Use consistent aspect ratio handling - contain mode (same as preview)
              const videoAspect = video.videoWidth / video.videoHeight;
              const canvasAspect = exportSettings.width / exportSettings.height;

              let drawWidth, drawHeight, offsetX, offsetY;

              // Use 'contain' logic - video fits within canvas maintaining aspect ratio
              if (videoAspect > canvasAspect) {
                // Video is wider than canvas - fit to width
                drawWidth = exportSettings.width;
                drawHeight = exportSettings.width / videoAspect;
                offsetX = 0;
                offsetY = (exportSettings.height - drawHeight) / 2;
              } else {
                // Video is taller than canvas - fit to height
                drawHeight = exportSettings.height;
                drawWidth = exportSettings.height * videoAspect;
                offsetX = (exportSettings.width - drawWidth) / 2;
                offsetY = 0;
              }

              // Save canvas state
              ctx.save();

              // Get transition opacity first
              const transitionOpacity = getTransitionOpacity(currentClip, currentFrameTime, activeTransitions);

              // Apply base opacity for transitions
              ctx.globalAlpha = transitionOpacity;

              // Draw video first
              ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

              // Apply effects to the drawn video (post-processing)
              const effectsResult = applyEffectsToImageData(ctx, currentClip, currentFrameTime, activeTransitions, offsetX, offsetY, drawWidth, drawHeight);

              // Apply additional fade effects if needed
              if (effectsResult.opacity !== 1) {
                // Re-draw with opacity if fade effects are present
                ctx.globalAlpha = transitionOpacity * effectsResult.opacity;
                ctx.clearRect(offsetX, offsetY, drawWidth, drawHeight);
                ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
              }

              console.log(`🎬 Rendered video "${currentClip.title}" with effects:`, {
                effects: currentClip.effects,
                opacity: transitionOpacity * effectsResult.opacity,
                time: currentFrameTime.toFixed(2)
              });

              // Restore canvas state
              ctx.restore();
            }
          }

          // Render images with transformation support AND EFFECTS - consistent with preview
          const images = previewDisplay.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
          for (const img of Array.from(images)) {
            if (img.complete && img.naturalWidth > 0) {
              // Get the corresponding clip data for transformations and effects
              const imgSrc = img.src;
              const currentClip = clips.find(clip =>
                clip.type === 'image' &&
                clip.videoUrl === imgSrc &&
                currentFrameTime >= clip.start &&
                currentFrameTime <= clip.start + clip.duration
              );

              if (!currentClip) continue;

              // Get active transitions for this frame
              const activeTransitions = transitions.filter(transition =>
                currentFrameTime >= transition.startTime &&
                currentFrameTime <= transition.startTime + transition.duration
              );

              // Use consistent aspect ratio handling - contain mode (same as preview)
              const imgAspect = img.naturalWidth / img.naturalHeight;
              const canvasAspect = exportSettings.width / exportSettings.height;

              let drawWidth, drawHeight, offsetX, offsetY;

              // Use 'contain' logic - image fits within canvas maintaining aspect ratio
              if (imgAspect > canvasAspect) {
                // Image is wider than canvas - fit to width
                drawWidth = exportSettings.width;
                drawHeight = exportSettings.width / imgAspect;
                offsetX = 0;
                offsetY = (exportSettings.height - drawHeight) / 2;
              } else {
                // Image is taller than canvas - fit to height
                drawHeight = exportSettings.height;
                drawWidth = exportSettings.height * imgAspect;
                offsetX = (exportSettings.width - drawWidth) / 2;
                offsetY = 0;
              }

              // Apply transformations AND effects
              ctx.save();

              // Get transition opacity
              const transitionOpacity = getTransitionOpacity(currentClip, currentFrameTime, activeTransitions);

              if (currentClip?.imageTransform) {
                const transform = currentClip.imageTransform;
                const centerX = exportSettings.width / 2;
                const centerY = exportSettings.height / 2;

                // Move to center for transformations
                ctx.translate(centerX, centerY);

                // Apply scale - use scaleX/scaleY if available, otherwise fall back to uniform scale
                const scaleX = transform.scaleX || transform.scale || 1;
                const scaleY = transform.scaleY || transform.scale || 1;

                if (scaleX !== 1 || scaleY !== 1) {
                  ctx.scale(scaleX, scaleY);
                }

                // Apply flips
                if (transform.flipHorizontal || transform.flipVertical) {
                  ctx.scale(
                    transform.flipHorizontal ? -1 : 1,
                    transform.flipVertical ? -1 : 1
                  );
                }

                // Apply rotation
                if (transform.rotation && transform.rotation !== 0) {
                  ctx.rotate(transform.rotation * Math.PI / 180);
                }

                // Apply position offset
                let finalOffsetX = offsetX - centerX;
                let finalOffsetY = offsetY - centerY;

                if (transform.offsetX || transform.offsetY) {
                  finalOffsetX += (transform.offsetX || 0) * exportSettings.width / 100;
                  finalOffsetY += (transform.offsetY || 0) * exportSettings.height / 100;
                }

                // Apply base opacity (transform + transition)
                let baseOpacity = transitionOpacity;
                if (transform.opacity !== undefined && transform.opacity !== 1) {
                  baseOpacity *= transform.opacity;
                }
                ctx.globalAlpha = baseOpacity;

                // Draw image first
                ctx.drawImage(img, finalOffsetX, finalOffsetY, drawWidth, drawHeight);

                // Apply effects to the drawn image (post-processing)
                const effectsResult = applyEffectsToImageData(ctx, currentClip, currentFrameTime, activeTransitions, finalOffsetX, finalOffsetY, drawWidth, drawHeight);

                // Apply additional fade effects if needed
                if (effectsResult.opacity !== 1) {
                  ctx.globalAlpha = baseOpacity * effectsResult.opacity;
                  ctx.clearRect(finalOffsetX, finalOffsetY, drawWidth, drawHeight);
                  ctx.drawImage(img, finalOffsetX, finalOffsetY, drawWidth, drawHeight);
                }

                console.log(`🖼️ Rendered image "${currentClip.title}" with effects and transforms:`, {
                  effects: currentClip.effects,
                  opacity: baseOpacity * effectsResult.opacity,
                  transform: transform,
                  time: currentFrameTime.toFixed(2)
                });
              } else {
                // No transformations - apply base opacity and draw first
                ctx.globalAlpha = transitionOpacity;

                // Draw image first
                const drawX = offsetX - exportSettings.width / 2;
                const drawY = offsetY - exportSettings.height / 2;
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

                // Apply effects to the drawn image (post-processing)
                const effectsResult = applyEffectsToImageData(ctx, currentClip, currentFrameTime, activeTransitions, drawX, drawY, drawWidth, drawHeight);

                // Apply additional fade effects if needed
                if (effectsResult.opacity !== 1) {
                  ctx.globalAlpha = transitionOpacity * effectsResult.opacity;
                  ctx.clearRect(drawX, drawY, drawWidth, drawHeight);
                  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                }

                console.log(`🖼️ Rendered image "${currentClip.title}" with effects only:`, {
                  effects: currentClip.effects,
                  opacity: transitionOpacity * effectsResult.opacity,
                  time: currentFrameTime.toFixed(2)
                });
              }

              ctx.restore();
            }
          }

          // Render text overlays from multiple sources
          try {
            // Method 1: Render text clips dropped in timeline
            const currentTextClips = clips.filter(clip =>
              clip.type === 'text' &&
              clip.visible !== false &&
              clip.textContent &&
              currentFrameTime >= clip.start &&
              currentFrameTime <= clip.start + clip.duration
            );

            currentTextClips.forEach((clip) => {
              const x = ((clip.textPosition?.x || 50) / 100) * exportSettings.width;
              const y = ((clip.textPosition?.y || 50) / 100) * exportSettings.height;

              // Scale font size appropriately for export resolution
              const baseFontSize = clip.textStyle?.fontSize || 24;
              const scaleFactor = Math.min(exportSettings.width / 1920, exportSettings.height / 1080);
              const fontSize = Math.max(16, baseFontSize * scaleFactor);

              const text = clip.textContent || '';

              if (text.trim()) {
                // Set font properties
                const fontWeight = clip.textStyle?.fontWeight || 'bold';
                const fontFamily = clip.textStyle?.fontFamily || 'Inter, sans-serif';
                ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = clip.textStyle?.color || '#ffffff';

                // Use consistent text alignment
                const textAlign = clip.textStyle?.textAlign || 'center';
                ctx.textAlign = textAlign as CanvasTextAlign;
                ctx.textBaseline = 'middle';

                // Add text shadow for better visibility
                ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                // Add text outline for better visibility
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.lineWidth = Math.max(2, fontSize / 12);

                const lines = text.split('\n');
                const lineHeight = fontSize * 1.2;
                const startY = y - ((lines.length - 1) * lineHeight / 2);

                lines.forEach((line: string, index: number) => {
                  if (line.trim()) {
                    const lineY = startY + (lineHeight * index);
                    // Draw outline first, then fill
                    ctx.strokeText(line, x, lineY);
                    ctx.fillText(line, x, lineY);

                    if (frameIndex === 0) {
                      console.log(`✅ Rendered text clip: "${line}" at (${x.toFixed(1)}, ${lineY.toFixed(1)}) with align: ${textAlign}`);
                    }
                  }
                });

                // Reset styles
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.strokeStyle = 'transparent';
                ctx.lineWidth = 1;
              }
            });

            // Method 2: Render text overlays directly from editor store (floating overlays)
            const editorStore = useEditorStore.getState();
            if (editorStore && editorStore.textOverlays) {
              const activeOverlays = editorStore.textOverlays.filter(overlay =>
                overlay.visible &&
                overlay.startTime <= currentFrameTime &&
                overlay.endTime >= currentFrameTime &&
                !overlay.droppedInTimeline // Only render overlays NOT dropped in timeline
              );

              activeOverlays.forEach((overlay: any) => {
                const x = (overlay.position.x / 100) * exportSettings.width;
                const y = (overlay.position.y / 100) * exportSettings.height;

                // Scale font size appropriately for export resolution
                const baseFontSize = overlay.style?.fontSize || 24;
                const scaleFactor = Math.min(exportSettings.width / 1920, exportSettings.height / 1080);
                const fontSize = Math.max(16, baseFontSize * scaleFactor);

                const text = overlay.content || '';

                if (text.trim()) {
                  // Set font properties
                  const fontWeight = overlay.style?.fontWeight || 'bold';
                  const fontFamily = overlay.style?.fontFamily || 'Inter, sans-serif';
                  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                  ctx.fillStyle = overlay.style?.color || '#ffffff';

                  // Use consistent text alignment
                  const textAlign = overlay.style?.textAlign || 'center';
                  ctx.textAlign = textAlign as CanvasTextAlign;
                  ctx.textBaseline = 'middle';

                  // Add text shadow for better visibility
                  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                  ctx.shadowBlur = 8;
                  ctx.shadowOffsetX = 3;
                  ctx.shadowOffsetY = 3;

                  // Add text outline for better visibility
                  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
                  ctx.lineWidth = Math.max(2, fontSize / 12);

                  const lines = text.split('\n');
                  const lineHeight = fontSize * 1.2;
                  const startY = y - ((lines.length - 1) * lineHeight / 2);

                  lines.forEach((line: string, index: number) => {
                    if (line.trim()) {
                      const lineY = startY + (lineHeight * index);
                      // Draw outline first, then fill
                      ctx.strokeText(line, x, lineY);
                      ctx.fillText(line, x, lineY);

                      if (frameIndex === 0) {
                        console.log(`✅ Rendered floating overlay: "${line}" at (${x.toFixed(1)}, ${lineY.toFixed(1)}) with align: ${textAlign}`);
                      }
                    }
                  });

                  // Reset styles
                  ctx.shadowColor = 'transparent';
                  ctx.shadowBlur = 0;
                  ctx.shadowOffsetX = 0;
                  ctx.shadowOffsetY = 0;
                  ctx.strokeStyle = 'transparent';
                  ctx.lineWidth = 1;
                }
              });

              if (frameIndex === 0) {
                console.log(`📝 Text rendering summary: ${currentTextClips.length} text clips + ${activeOverlays.length} floating overlays`);
              }
            }
          } catch (error) {
            console.warn('Error rendering text overlays:', error);
          }



          // Render visual effects overlays
          const effectsOverlays = previewDisplay.querySelectorAll('.effect-overlay, .visual-effect, .filter-overlay, .effect-element') as NodeListOf<HTMLElement>;
          for (const effectEl of Array.from(effectsOverlays)) {
            if (effectEl.style.display !== 'none' && effectEl.offsetWidth > 0 && effectEl.offsetHeight > 0) {
              const rect = effectEl.getBoundingClientRect();
              const previewRect = previewDisplay.getBoundingClientRect();

              if (rect.width > 0 && rect.height > 0) {
                const x = ((rect.left - previewRect.left) / previewRect.width) * exportSettings.width;
                const y = ((rect.top - previewRect.top) / previewRect.height) * exportSettings.height;
                const width = (rect.width / previewRect.width) * exportSettings.width;
                const height = (rect.height / previewRect.height) * exportSettings.height;

                // Apply the effect styles
                const computedStyle = window.getComputedStyle(effectEl);

                // Handle background effects
                if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                  ctx.fillStyle = computedStyle.backgroundColor;
                  ctx.fillRect(x, y, width, height);
                }

                // Handle border effects
                if (computedStyle.border && computedStyle.border !== 'none') {
                  ctx.strokeStyle = computedStyle.borderColor || '#ffffff';
                  ctx.lineWidth = parseInt(computedStyle.borderWidth) || 1;
                  ctx.strokeRect(x, y, width, height);
                }

                // Handle opacity effects
                if (computedStyle.opacity && computedStyle.opacity !== '1') {
                  ctx.globalAlpha = parseFloat(computedStyle.opacity);
                  // Re-draw with opacity
                  if (computedStyle.backgroundColor && computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    ctx.fillStyle = computedStyle.backgroundColor;
                    ctx.fillRect(x, y, width, height);
                  }
                  ctx.globalAlpha = 1.0; // Reset opacity
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error rendering frame:', error);
      }

      // Convert canvas to blob and save as frame - optimized for speed
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.75); // Reduced quality for faster processing
      });

      const frameFilename = `frame_${frameIndex.toString().padStart(6, '0')}.jpg`;
      const arrayBuffer = await blob.arrayBuffer();

      if (ffmpegRef.current) {
        await ffmpegRef.current.writeFile(frameFilename, new Uint8Array(arrayBuffer));
        frameFiles.push(frameFilename);
      }

      // Update progress more efficiently - only every 10 frames for performance
      if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
        const progress = (frameIndex / totalFrames) * 60; // 60% for frame generation
        setExportProgress(progress);
      }
    }

    console.log(`Generated ${frameFiles.length} frames`);
    return frameFiles;
  }, [exportSettings, actualDuration, updateTextAndEffects, clips]);

  // Prepare audio inputs for FFmpeg
  const prepareAudioInputs = useCallback(async () => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error('FFmpeg not initialized');

    const audioInputs: string[] = [];
    let inputIndex = 0;

    for (const clip of clips) {
      if ((clip.type === 'audio' || clip.type === 'video') && !clip.muted) {
        const audioUrl = clip.audioUrl || clip.videoUrl;
        if (audioUrl) {
          try {
            const filename = `audio_${inputIndex}.${clip.type === 'audio' ? 'mp3' : 'mp4'}`;
            const fileData = await fetchFile(audioUrl);
            await ffmpeg.writeFile(filename, fileData);
            audioInputs.push(filename);
            inputIndex++;
          } catch (error) {
            console.warn(`Failed to load audio for clip ${clip.id}:`, error);
          }
        }
      }
    }

    return audioInputs;
  }, [clips]);

  // Main export function using FFmpeg
  const startExport = useCallback(async () => {
    if (!ffmpegRef.current || !ffmpegLoaded || isExporting) return;

    setIsExporting(true);
    setExportProgress(0);
    setCurrentTime(0);
    setExportLog([]);

    try {
      const ffmpeg = ffmpegRef.current;

      toast({
        title: "Export started",
        description: "Generating frames and processing with FFmpeg...",
      });

      // Step 1: Generate video frames from timeline (0-60%)
      const frameFiles = await generateFrames();

      // Step 2: Create video from frames (60-80%)
      setExportProgress(60);

      // Ultra-fast video encoding arguments for maximum speed
      const videoArgs = [
        '-framerate', exportSettings.frameRate.toString(),
        '-i', 'frame_%06d.jpg',
        '-c:v', 'libx264',
        '-preset', 'veryfast', // Even faster than ultrafast for better quality/speed balance
        '-crf', '25', // Higher CRF for faster encoding
        '-pix_fmt', 'yuv420p',
        '-g', (exportSettings.frameRate).toString(), // Smaller GOP for faster encoding
        '-bf', '0', // No B-frames for faster encoding
        '-refs', '1', // Fewer reference frames
        '-me_method', 'hex', // Faster motion estimation
        '-subq', '6', // Lower subpixel quality for speed
        '-threads', '0', // Use all available CPU threads
        '-movflags', '+faststart',
        '-r', exportSettings.frameRate.toString(),
        '-t', actualDuration.toString(),
        'temp_video.mp4'
      ];

      await ffmpeg.exec(videoArgs);

      // Step 3: Process audio if available (80-90%)
      setExportProgress(80);

      const audioInputs = await prepareAudioInputs();
      let finalArgs: string[] = ['-i', 'temp_video.mp4'];

      if (audioInputs.length > 0) {
        // Add audio inputs
        audioInputs.forEach(audioFile => {
          finalArgs.push('-i', audioFile);
        });

        // Optimized audio processing
        const audioFilters: string[] = [];
        let audioClipIndex = 0;

        for (const clip of clips) {
          if ((clip.type === 'audio' || clip.type === 'video') && !clip.muted) {
            const inputIdx = audioClipIndex + 1; // +1 because video is input 0
            // Simplified audio filter for faster processing
            audioFilters.push(
              `[${inputIdx}:a]adelay=${clip.start * 1000}|${clip.start * 1000}[a${audioClipIndex}]`
            );
            audioClipIndex++;
          }
        }

        if (audioFilters.length > 0) {
          const mixFilter = audioFilters.join(';') + ';' +
            audioFilters.map((_, i) => `[a${i}]`).join('') +
            `amix=inputs=${audioFilters.length}:duration=longest[aout]`;

          finalArgs.push(
            '-filter_complex', mixFilter,
            '-map', '0:v',
            '-map', '[aout]',
            '-c:v', 'copy', // Copy video stream to avoid re-encoding
            '-c:a', 'aac',
            '-ac', '2', // Force stereo output
            '-ar', '44100', // Standard sample rate
            '-b:a', exportSettings.audioBitrate,
            '-threads', '0', // Use all available CPU threads
            '-shortest'
          );
        } else {
          finalArgs.push('-c:v', 'copy');
        }
      } else {
        // No audio, just copy video
        finalArgs.push('-c:v', 'copy');
      }

      // Step 4: Final output (90-95%)
      setExportProgress(90);

      const outputFilename = `output.${exportSettings.format}`;
      finalArgs.push(outputFilename);

      await ffmpeg.exec(finalArgs);

      // Step 5: Download the result (95-100%)
      setExportProgress(95);

      const outputData = await ffmpeg.readFile(outputFilename);
      let outputBlob: Blob;

      if (outputData instanceof Uint8Array) {
        // Create a new Uint8Array with ArrayBuffer to ensure proper typing
        outputBlob = new Blob([new Uint8Array(outputData)], {
          type: exportSettings.format === 'mp4' ? 'video/mp4' : 'video/webm',
        });
      } else if (typeof outputData === 'string') {
        outputBlob = new Blob([new TextEncoder().encode(outputData)], {
          type: exportSettings.format === 'mp4' ? 'video/mp4' : 'video/webm',
        });
      } else {
        outputBlob = new Blob([new Uint8Array(outputData)], {
          type: exportSettings.format === 'mp4' ? 'video/mp4' : 'video/webm',
        });
      }


      // Download the file
      const url = URL.createObjectURL(outputBlob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.download = `video-export-${timestamp}-${exportSettings.quality}.${exportSettings.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Cleanup FFmpeg filesystem
      try {
        // Clean up in batches for better performance
        const cleanupPromises = frameFiles.map(async (filename) => {
          try { await ffmpeg.deleteFile(filename); } catch { }
        });
        await Promise.all(cleanupPromises.slice(0, 10)); // Clean first 10 files immediately

        // Clean the rest in the background
        setTimeout(async () => {
          await Promise.all(cleanupPromises.slice(10));
          try { await ffmpeg.deleteFile('temp_video.mp4'); } catch { }
          try { await ffmpeg.deleteFile(outputFilename); } catch { }
          audioInputs.forEach(async (filename) => {
            try { await ffmpeg.deleteFile(filename); } catch { }
          });
        }, 100);

      } catch (error) {
        console.warn('Cleanup warning:', error);
      }

      setExportProgress(100);
      setIsExporting(false);

      toast({
        title: "Export completed successfully!",
        description: `Your ${exportSettings.quality} quality video (${Math.round(actualDuration)}s) has been downloaded in ${((Date.now() - performance.now()) / 1000).toFixed(1)}s.`,
      });

    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);

      toast({
        title: "Export failed",
        description: `An error occurred during video export: ${error}`,
        variant: "destructive",
      });
    }
  }, [
    ffmpegLoaded,
    isExporting,
    exportSettings,
    actualDuration,
    clips,
    generateFrames,
    prepareAudioInputs,
    toast
  ]);

  const cancelExport = useCallback(() => {
    setIsExporting(false);
    setExportProgress(0);
    setCurrentTime(0);

    toast({
      title: "Export cancelled",
      description: "Video export has been cancelled.",
    });
  }, [toast]);

  // Preview playback for testing
  const togglePreview = useCallback(() => {
    setIsPreviewPlaying(!isPreviewPlaying);
  }, [isPreviewPlaying]);

  return (
    <div className="flex items-center gap-2">
      {/* Hidden high-resolution canvas for frame generation */}
      <canvas
        ref={canvasRef}
        className="hidden"
        style={{
          width: exportSettings.width,
          height: exportSettings.height,
        }}
      />

      {/* Hidden preview for frame capture */}
      <div ref={hiddenPreviewRef} className="fixed -top-[4000px] -left-[4000px] opacity-0 pointer-events-none">
        <TimelinePreview
          clips={clips}
          transitions={transitions}
          currentTime={currentTime}
          width={exportSettings.width}
          height={exportSettings.height}
          playing={false}
          onPlayToggle={() => { }}
        />
      </div>

      {/* Export Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={clips.length === 0 || actualDuration === 0 || !ffmpegLoaded}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Video
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Export High-Quality Video
            </DialogTitle>
            <DialogDescription>
              Export your {Math.round(actualDuration)}s video with FFmpeg for professional quality.
              {!ffmpegLoaded && " (Loading FFmpeg...)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* FFmpeg Loading Status */}
            {!ffmpegLoaded && (
              <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium">Loading FFmpeg...</span>
                </div>
              </div>
            )}

            {/* Export Progress */}
            {isExporting && (
              <div className="space-y-3">
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="aspect-video bg-black rounded overflow-hidden mb-3">
                    <TimelinePreview
                      clips={clips}
                      transitions={transitions}
                      currentTime={currentTime}
                      width={400}
                      height={225}
                      playing={false}
                      onPlayToggle={() => { }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">Exporting with FFmpeg...</span>
                    <span className="font-bold">{Math.round(exportProgress)}%</span>
                  </div>
                  <Progress value={exportProgress} className="h-2" />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{Math.round(currentTime * 10) / 10}s / {Math.round(actualDuration * 10) / 10}s</span>
                    <span>{exportSettings.width}×{exportSettings.height} @ {exportSettings.frameRate}fps</span>
                  </div>
                  {/* FFmpeg logs */}
                  {exportLog.length > 0 && (
                    <div className="mt-2 p-2 bg-black text-green-400 text-xs font-mono rounded max-h-20 overflow-y-auto">
                      {exportLog.slice(-3).map((log, index) => (
                        <div key={index}>{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quality Settings */}
            {!isExporting && ffmpegLoaded && (
              <div className="space-y-4">
                <div>
                  <Label>Export Quality</Label>
                  <Select
                    value={exportSettings.quality}
                    onValueChange={(value: 'ultra' | 'high' | 'medium' | 'low' | 'fast') =>
                      updateExportSettings(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultra">
                        <div className="flex flex-col items-start">
                          <span>Ultra Quality (1080p, 60fps)</span>
                          <span className="text-xs text-gray-500">H.264 • Best for professional use</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex flex-col items-start">
                          <span>High Quality (1080p, 30fps)</span>
                          <span className="text-xs text-gray-500">H.264 • Great for social media</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex flex-col items-start">
                          <span>Medium Quality (720p, 30fps)</span>
                          <span className="text-xs text-gray-500">H.264 • Good for web sharing</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="low">
                        <div className="flex flex-col items-start">
                          <span>Low Quality (480p, 24fps)</span>
                          <span className="text-xs text-gray-500">H.264 • Fast export</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="fast">
                        <div className="flex flex-col items-start">
                          <span>Fast Quality (720p, 24fps)</span>
                          <span className="text-xs text-gray-500">H.264 • Fast export</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-gray-500 mt-1">
                    Resolution: {exportSettings.width} × {exportSettings.height} •
                    Video: {exportSettings.videoBitrate} •
                    Audio: {exportSettings.audioBitrate}
                  </div>
                </div>

                {/* Preview Controls */}
                <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                  <div className="aspect-video bg-black rounded overflow-hidden mb-2">
                    <TimelinePreview
                      clips={clips}
                      transitions={transitions}
                      currentTime={isPreviewPlaying ? currentTime : 0}
                      width={320}
                      height={180}
                      playing={isPreviewPlaying}
                      onPlayToggle={togglePreview}
                    />
                  </div>
                  <Button
                    onClick={togglePreview}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isPreviewPlaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause Preview
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Preview Export
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Export Actions */}
            <div className="flex gap-3 pt-2">
              {isExporting ? (
                <Button
                  onClick={cancelExport}
                  variant="destructive"
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel Export
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setIsDialogOpen(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setIsPreviewPlaying(false);
                      startExport();
                    }}
                    className="flex-1"
                    disabled={clips.length === 0 || actualDuration === 0 || !ffmpegLoaded}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Start Export
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Export Button */}
      {/* <Button
        onClick={() => {
          setIsPreviewPlaying(false);
          startExport();
        }}
        variant="outline"
        size="sm"
        disabled={clips.length === 0 || actualDuration === 0 || isExporting || !ffmpegLoaded}
        title={`Quick export: ${exportSettings.quality} quality (${Math.round(actualDuration)}s)`}
      >
        <Video className="w-4 h-4" />
      </Button> */}
    </div>
  );
};

export default SimpleVideoExporter; 