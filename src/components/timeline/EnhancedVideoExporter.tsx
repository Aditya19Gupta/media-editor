import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Clip } from '@/types/clip';
import TimelinePreview from './TimelinePreview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Video, X, Play, Pause } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import useEditorStore from '@/store/editorStore';
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
import { Slider } from '@/components/ui/slider';

interface EnhancedVideoExporterProps {
  clips: Clip[];
  duration: number;
  timelineWidth?: number;
  timelineHeight?: number;
}

interface ExportSettings {
  quality: 'high' | 'medium' | 'low';
  format: 'mp4' | 'webm';
  frameRate: number;
  videoBitrate: number;
  audioBitrate: number;
  width: number;
  height: number;
}

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  quality: 'medium',
  format: 'webm', // WebM is better supported for MediaRecorder
  frameRate: 30,
  videoBitrate: 2500000,
  audioBitrate: 128000,
  width: 1280,
  height: 720,
};

const QUALITY_PRESETS = {
  high: {
    videoBitrate: 8000000,
    audioBitrate: 192000,
    width: 1920,
    height: 1080,
  },
  medium: {
    videoBitrate: 2500000,
    audioBitrate: 128000,
    width: 1280,
    height: 720,
  },
  low: {
    videoBitrate: 1000000,
    audioBitrate: 96000,
    width: 854,
    height: 480,
  },
};

const EnhancedVideoExporter: React.FC<EnhancedVideoExporterProps> = ({
  clips,
  duration,
}) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentExportTime, setCurrentExportTime] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // References
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const exportAnimationRef = useRef<number | null>(null);
  
  // Audio elements for export
  const audioElementsRef = useRef<{ [clipId: string]: HTMLAudioElement }>({});

  const updateExportSettings = useCallback((updates: Partial<ExportSettings>) => {
    setExportSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const applyQualityPreset = useCallback((quality: 'high' | 'medium' | 'low') => {
    const preset = QUALITY_PRESETS[quality];
    updateExportSettings({
      quality,
      ...preset,
    });
  }, [updateExportSettings]);

  // Create and manage audio elements for export
  const setupAudioElements = useCallback(() => {
    // Clean up existing audio elements
    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    audioElementsRef.current = {};

    // Create new audio elements for clips with audio
    clips.forEach(clip => {
      if ((clip.type === 'audio' || clip.type === 'video') && (clip.audioUrl || clip.videoUrl)) {
        const audio = new Audio();
        audio.src = clip.audioUrl || clip.videoUrl || '';
        audio.preload = 'metadata';
        audio.volume = clip.muted ? 0 : 1;
        audioElementsRef.current[clip.id] = audio;
      }
    });
  }, [clips]);

  // Capture current frame from TimelinePreview to canvas
  const captureFrameToCanvas = useCallback((time: number): Promise<void> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const previewContainer = previewContainerRef.current;
      
      if (!canvas || !previewContainer) {
        resolve();
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve();
        return;
      }

      // Set canvas size
      canvas.width = exportSettings.width;
      canvas.height = exportSettings.height;

      // Clear canvas with black background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      try {
        // Find the preview element inside the container
        const previewElement = previewContainer.querySelector('.timeline-preview-display') as HTMLElement;
        if (!previewElement) {
          resolve();
          return;
        }

        // Get scale factors
        const previewRect = previewElement.getBoundingClientRect();
        const scaleX = canvas.width / previewRect.width;
        const scaleY = canvas.height / previewRect.height;

        // Find active clips for current time
        const activeClips = clips.filter(clip => 
          time >= clip.start && time <= clip.start + clip.duration
        );

        // Render visual clips
        const visualClips = activeClips.filter(clip => 
          clip.type === 'video' || clip.type === 'image'
        );

        visualClips.forEach(clip => {
          const clipProgress = time - clip.start;
          
          if (clip.type === 'video' && clip.videoUrl) {
            // Find corresponding video element
            const videoElement = previewElement.querySelector(`video[src="${clip.videoUrl}"]`) as HTMLVideoElement;
            if (videoElement && videoElement.readyState >= 2) {
              // Set video time to match clip progress
              videoElement.currentTime = clipProgress;
              
              // Apply effects styling
              const effectStyles = getClipEffectStyles(clip, time);
              
              ctx.save();
              if (effectStyles.opacity !== undefined) {
                ctx.globalAlpha = effectStyles.opacity;
              }
              
              // Apply transforms
              if (effectStyles.transform) {
                const scale = effectStyles.transform.includes('scale') ? 
                  parseFloat(effectStyles.transform.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
                ctx.scale(scale, scale);
              }
              
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
          } else if (clip.type === 'image' && clip.videoUrl) {
            // Find corresponding image element
            const imageElement = previewElement.querySelector(`img[src="${clip.videoUrl}"]`) as HTMLImageElement;
            if (imageElement && imageElement.complete) {
              const effectStyles = getClipEffectStyles(clip, time);
              
              ctx.save();
              if (effectStyles.opacity !== undefined) {
                ctx.globalAlpha = effectStyles.opacity;
              }
              
              ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
          }
        });

        // Render text overlays from editor store (only those dropped in timeline)
        try {
          const editorStore = useEditorStore.getState();
          if (editorStore && editorStore.textOverlays) {
            editorStore.textOverlays.forEach((overlay: any) => {
              // Only render overlays that have been dropped in timeline, are visible, and within time range
              if (overlay.visible && 
                  overlay.droppedInTimeline && 
                  overlay.startTime <= time && 
                  overlay.endTime >= time) {
                
                // Calculate position coordinates correctly
                const x = (overlay.position.x / 100) * exportSettings.width;
                const y = (overlay.position.y / 100) * exportSettings.height;
                
                // Scale font size appropriately for export resolution
                const baseFontSize = overlay.style?.fontSize || 24;
                const scaleFactor = Math.min(exportSettings.width / 1920, exportSettings.height / 1080);
                const fontSize = Math.max(18, baseFontSize * scaleFactor);
                
                const text = overlay.content || '';
                
                if (text.trim()) {
                  // Set font properties
                  const fontWeight = overlay.style?.fontWeight || 'bold';
                  const fontFamily = overlay.style?.fontFamily || 'Arial, sans-serif';
                  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                  ctx.fillStyle = overlay.style?.color || '#ffffff';
                  
                  // Use consistent text alignment based on overlay's textAlign property
                  const textAlign = overlay.style?.textAlign || 'center';
                  ctx.textAlign = textAlign as CanvasTextAlign;
                  ctx.textBaseline = 'middle';
                  
                  // Add text shadow for better visibility
                  ctx.shadowColor = overlay.style?.textShadow ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.9)';
                  ctx.shadowBlur = 6;
                  ctx.shadowOffsetX = 2;
                  ctx.shadowOffsetY = 2;
                  
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
              }
            });
          }
        } catch (error) {
          console.warn('Error accessing editor store for text overlays in Enhanced exporter:', error);
        }

      } catch (error) {
        console.warn('Error capturing frame:', error);
      }

      resolve();
    });
  }, [clips, exportSettings.width, exportSettings.height]);

  // Helper function to get clip effect styles
  const getClipEffectStyles = useCallback((clip: Clip, currentTime: number) => {
    const effects = clip.effects || [];
    let opacity = 1;
    let transform = '';
    
    const clipProgress = (currentTime - clip.start) / clip.duration;
    
    effects.forEach(effect => {
      if (effect === 'fade-in') {
        opacity = Math.min(1, clipProgress * 2); // Fade in over first half
      } else if (effect === 'fade-out') {
        opacity = Math.min(1, (1 - clipProgress) * 2); // Fade out over last half
      } else if (effect === 'zoom-in') {
        transform += ` scale(${1 + clipProgress * 0.2})`;
      } else if (effect === 'zoom-out') {
        transform += ` scale(${1.2 - clipProgress * 0.2})`;
      }
    });
    
    return { opacity, transform: transform.trim() };
  }, []);

  // Sync audio for current export time
  const syncAudioForTime = useCallback((time: number) => {
    Object.entries(audioElementsRef.current).forEach(([clipId, audio]) => {
      const clip = clips.find(c => c.id === clipId);
      if (!clip) return;

      if (time >= clip.start && time <= clip.start + clip.duration) {
        const clipProgress = time - clip.start;
        if (Math.abs(audio.currentTime - clipProgress) > 0.1) {
          audio.currentTime = clipProgress;
        }
      }
    });
  }, [clips]);

  // Main export function
  const startExport = useCallback(async () => {
    if (!canvasRef.current || isExporting) return;

    setIsExporting(true);
    setExportProgress(0);
    setCurrentExportTime(0);
    recordedChunksRef.current = [];

    try {
      // Setup audio elements
      setupAudioElements();

      const canvas = canvasRef.current;
      
      // Create canvas stream
      const canvasStream = canvas.captureStream(exportSettings.frameRate);

      // Setup audio context for mixing
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      const destination = audioContextRef.current.createMediaStreamDestination();

      // Connect audio sources
      const audioClips = clips.filter(clip => 
        (clip.type === 'audio' || clip.type === 'video') && 
        (clip.audioUrl || clip.videoUrl)
      );

      for (const clip of audioClips) {
        const audio = audioElementsRef.current[clip.id];
        if (audio) {
          try {
            const source = audioContextRef.current!.createMediaElementSource(audio);
            const gainNode = audioContextRef.current!.createGain();
            gainNode.gain.value = clip.muted ? 0 : 1;
            
            source.connect(gainNode);
            gainNode.connect(destination);
          } catch (error) {
            console.warn(`Failed to connect audio for clip ${clip.id}:`, error);
          }
        }
      }

      // Combine video and audio streams
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm; codecs=vp9,opus',
        videoBitsPerSecond: exportSettings.videoBitrate,
        audioBitsPerSecond: exportSettings.audioBitrate,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        
        // Create download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `exported-video-${Date.now()}.webm`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Cleanup
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        Object.values(audioElementsRef.current).forEach(audio => {
          audio.pause();
        });

        setIsExporting(false);
        setExportProgress(100);
        
        toast({
          title: "Export completed",
          description: "Your video has been downloaded successfully.",
        });
      };

      // Start recording
      mediaRecorder.start(100);

      // Start frame rendering loop
      const frameInterval = 1000 / exportSettings.frameRate;
      let startTime = Date.now();
      let currentTime = 0;

      const renderLoop = async () => {
        if (currentTime >= duration) {
          mediaRecorder.stop();
          return;
        }

        // Sync audio
        syncAudioForTime(currentTime);

        // Capture frame
        await captureFrameToCanvas(currentTime);

        // Update progress
        const progress = (currentTime / duration) * 100;
        setExportProgress(progress);
        setCurrentExportTime(currentTime);

        // Calculate next frame time
        currentTime += frameInterval / 1000;

        // Schedule next frame
        exportAnimationRef.current = requestAnimationFrame(renderLoop);
      };

      renderLoop();

    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      toast({
        title: "Export failed",
        description: "An error occurred during video export. Please try again.",
        variant: "destructive",
      });
    }
  }, [isExporting, exportSettings, duration, clips, setupAudioElements, syncAudioForTime, captureFrameToCanvas, toast]);

  const cancelExport = useCallback(() => {
    if (exportAnimationRef.current) {
      cancelAnimationFrame(exportAnimationRef.current);
    }
    
    if (mediaRecorderRef.current && isExporting) {
      mediaRecorderRef.current.stop();
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    Object.values(audioElementsRef.current).forEach(audio => {
      audio.pause();
    });

    setIsExporting(false);
    setExportProgress(0);
    setCurrentExportTime(0);

    toast({
      title: "Export cancelled",
      description: "Video export has been cancelled.",
    });
  }, [isExporting, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (exportAnimationRef.current) {
        cancelAnimationFrame(exportAnimationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      Object.values(audioElementsRef.current).forEach(audio => {
        audio.pause();
      });
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Hidden canvas for recording */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={exportSettings.width}
        height={exportSettings.height}
      />

      {/* Hidden preview container for frame capture */}
      <div ref={previewContainerRef} className="hidden">
        <TimelinePreview
          clips={clips}
          currentTime={isExporting ? currentExportTime : 0}
          width={exportSettings.width}
          height={exportSettings.height}
          playing={false}
          onPlayToggle={() => {}}
        />
      </div>

      {/* Export Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="default" 
            size="sm"
            disabled={clips.length === 0 || duration === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Video
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5" />
              Export Video Settings
            </DialogTitle>
            <DialogDescription>
              Configure your video export settings. Preview shows export progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Export Preview */}
            {isExporting && (
              <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Export Preview</span>
                  <span className="text-xs text-gray-500">
                    {Math.round(currentExportTime * 10) / 10}s / {Math.round(duration * 10) / 10}s
                  </span>
                </div>
                <div className="export-dialog-preview">
                  <TimelinePreview
                    clips={clips}
                    currentTime={currentExportTime}
                    width={800}
                    height={450}
                    playing={false}
                    onPlayToggle={() => {}}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Exporting...</span>
                    <span>{Math.round(exportProgress)}%</span>
                  </div>
                  <Progress value={exportProgress} />
                </div>
              </div>
            )}

            {/* Quality Preset */}
            <div>
              <Label>Quality Preset</Label>
              <Select
                value={exportSettings.quality}
                onValueChange={(value: 'high' | 'medium' | 'low') => 
                  applyQualityPreset(value)
                }
                disabled={isExporting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High (1080p - 8 Mbps)</SelectItem>
                  <SelectItem value="medium">Medium (720p - 2.5 Mbps)</SelectItem>
                  <SelectItem value="low">Low (480p - 1 Mbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frame Rate */}
            <div>
              <Label>Frame Rate: {exportSettings.frameRate} FPS</Label>
              <Slider
                value={[exportSettings.frameRate]}
                onValueChange={([value]) => updateExportSettings({ frameRate: value })}
                min={24}
                max={60}
                step={6}
                disabled={isExporting}
                className="mt-2"
              />
            </div>

            {/* Resolution Display */}
            <div className="text-sm text-gray-500">
              Resolution: {exportSettings.width} × {exportSettings.height}
            </div>

            {/* Export Actions */}
            <div className="flex gap-2 pt-4">
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
                    onClick={startExport}
                    className="flex-1"
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
      <Button
        onClick={startExport}
        variant="outline"
        size="sm"
        disabled={clips.length === 0 || duration === 0 || isExporting}
        title="Quick export with current settings"
      >
        <Video className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default EnhancedVideoExporter; 