import React, { useRef, useState, useCallback } from 'react';
import { Clip } from '@/types/clip';
import TimelinePreview from './TimelinePreview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Video, X, Settings } from 'lucide-react';
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

interface VideoExporterProps {
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
  format: 'mp4',
  frameRate: 30,
  videoBitrate: 2500000, // 2.5 Mbps
  audioBitrate: 128000,  // 128 kbps
  width: 1920,
  height: 1080,
};

const QUALITY_PRESETS = {
  high: {
    videoBitrate: 5000000, // 5 Mbps
    audioBitrate: 192000,  // 192 kbps
    width: 1920,
    height: 1080,
  },
  medium: {
    videoBitrate: 2500000, // 2.5 Mbps
    audioBitrate: 128000,  // 128 kbps
    width: 1280,
    height: 720,
  },
  low: {
    videoBitrate: 1000000, // 1 Mbps
    audioBitrate: 96000,   // 96 kbps
    width: 854,
    height: 480,
  },
};

const VideoExporter: React.FC<VideoExporterProps> = ({
  clips,
  duration,
  timelineWidth = 1280,
  timelineHeight = 720,
}) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // References for export components
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  
  // Audio context for mixing multiple audio tracks
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

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

  // Create audio stream from all audio clips
  const createAudioStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // Get all audio clips that have audio URLs
      const audioClips = clips.filter(clip => 
        (clip.type === 'audio' || clip.type === 'video') && 
        (clip.audioUrl || clip.videoUrl)
      );

      if (audioClips.length === 0) {
        return null;
      }

      // Create audio context for mixing
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      // Process each audio clip
      for (const clip of audioClips) {
        try {
          const audioElement = document.createElement('audio');
          audioElement.src = clip.audioUrl || clip.videoUrl || '';
          audioElement.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            audioElement.oncanplaythrough = resolve;
            audioElement.onerror = reject;
            audioElement.load();
          });

          // Create audio source from element
          const audioSource = audioContextRef.current!.createMediaElementSource(audioElement);
          
          // Create gain node for volume control
          const gainNode = audioContextRef.current!.createGain();
          gainNode.gain.value = clip.muted ? 0 : 1;

          // Connect audio graph
          audioSource.connect(gainNode);
          gainNode.connect(audioDestinationRef.current!);

        } catch (error) {
          console.warn(`Failed to process audio for clip ${clip.id}:`, error);
        }
      }

      return audioDestinationRef.current.stream;
    } catch (error) {
      console.error('Failed to create audio stream:', error);
      return null;
    }
  }, [clips]);

  // Capture video frame to canvas
  const captureFrame = useCallback((currentTime: number): Promise<void> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const preview = previewRef.current;
      
      if (!canvas || !preview) {
        resolve();
        return;
      }

      const ctx = canvas.getContext('2d')!;
      
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Use html2canvas equivalent approach
      const previewRect = preview.getBoundingClientRect();
      const scaleX = canvas.width / previewRect.width;
      const scaleY = canvas.height / previewRect.height;

      // Save context state
      ctx.save();
      ctx.scale(scaleX, scaleY);

      // Draw the preview content to canvas
      // This is a simplified approach - in a real implementation,
      // you'd need to manually render each video frame, image, and text overlay
      try {
        // Find active video elements and draw them
        const videoElements = preview.querySelectorAll('video') as NodeListOf<HTMLVideoElement>;
        const imageElements = preview.querySelectorAll('img') as NodeListOf<HTMLImageElement>;
        
        // Draw videos
        videoElements.forEach((video) => {
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA
            ctx.drawImage(video, 0, 0, previewRect.width, previewRect.height);
          }
        });

        // Draw images
        imageElements.forEach((img) => {
          if (img.complete) {
            ctx.drawImage(img, 0, 0, previewRect.width, previewRect.height);
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
                  overlay.startTime <= currentTime && 
                  overlay.endTime >= currentTime) {
                
                // Calculate position coordinates correctly
                const x = (overlay.position.x / 100) * canvas.width;
                const y = (overlay.position.y / 100) * canvas.height;
                
                // Scale font size appropriately for export resolution
                const baseFontSize = overlay.style?.fontSize || 24;
                const scaleFactor = Math.min(canvas.width / 1920, canvas.height / 1080);
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
          console.warn('Error accessing editor store for text overlays in VideoExporter:', error);
        }

      } catch (error) {
        console.warn('Error capturing frame:', error);
      }

      // Restore context state
      ctx.restore();
      resolve();
    });
  }, []);

  // Main export function
  const startExport = useCallback(async () => {
    if (!canvasRef.current || isExporting) return;

    setIsExporting(true);
    setExportProgress(0);
    recordedChunksRef.current = [];

    try {
      const canvas = canvasRef.current;
      canvas.width = exportSettings.width;
      canvas.height = exportSettings.height;

      // Create video stream from canvas
      const videoStream = canvas.captureStream(exportSettings.frameRate);

      // Create audio stream
      const audioStream = await createAudioStream();

      // Combine video and audio streams
      let combinedStream = videoStream;
      if (audioStream) {
        const audioTracks = audioStream.getAudioTracks();
        audioTracks.forEach(track => combinedStream.addTrack(track));
      }

      // Configure MediaRecorder
      const mimeType = exportSettings.format === 'mp4' 
        ? 'video/mp4; codecs=h264,aac' 
        : 'video/webm; codecs=vp9,opus';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: mimeType,
        videoBitsPerSecond: exportSettings.videoBitrate,
        audioBitsPerSecond: exportSettings.audioBitrate,
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle recorded data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { 
          type: exportSettings.format === 'mp4' ? 'video/mp4' : 'video/webm' 
        });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `exported-video-${Date.now()}.${exportSettings.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Cleanup
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }

        setIsExporting(false);
        setExportProgress(100);
        
        toast({
          title: "Export completed",
          description: "Your video has been downloaded successfully.",
        });
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms

      // Simulate timeline playback for recording
      const frameInterval = 1000 / exportSettings.frameRate;
      let currentTime = 0;
      
      const renderFrame = async () => {
        if (currentTime >= duration) {
          mediaRecorder.stop();
          return;
        }

        await captureFrame(currentTime);
        
        // Update progress
        const progress = (currentTime / duration) * 100;
        setExportProgress(progress);

        currentTime += frameInterval / 1000;
        
        // Continue to next frame
        setTimeout(renderFrame, frameInterval);
      };

      // Start rendering frames
      renderFrame();

    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      toast({
        title: "Export failed",
        description: "An error occurred during video export. Please try again.",
        variant: "destructive",
      });
    }
  }, [isExporting, exportSettings, duration, createAudioStream, captureFrame, toast]);

  const cancelExport = useCallback(() => {
    if (mediaRecorderRef.current && isExporting) {
      mediaRecorderRef.current.stop();
      setIsExporting(false);
      setExportProgress(0);
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      toast({
        title: "Export cancelled",
        description: "Video export has been cancelled.",
      });
    }
  }, [isExporting, toast]);

  return (
    <div className="flex items-center gap-2">
      {/* Hidden canvas for recording */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={exportSettings.width}
        height={exportSettings.height}
      />

      {/* Hidden preview for capturing frames */}
      <div ref={previewRef} className="hidden">
        <TimelinePreview
          clips={clips}
          currentTime={0}
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
              Configure your video export settings before downloading.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Quality Preset */}
            <div>
              <Label htmlFor="quality">Quality Preset</Label>
              <Select
                value={exportSettings.quality}
                onValueChange={(value: 'high' | 'medium' | 'low') => 
                  applyQualityPreset(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High (1080p)</SelectItem>
                  <SelectItem value="medium">Medium (720p)</SelectItem>
                  <SelectItem value="low">Low (480p)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                value={exportSettings.format}
                onValueChange={(value: 'mp4' | 'webm') => 
                  updateExportSettings({ format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4</SelectItem>
                  <SelectItem value="webm">WebM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frame Rate */}
            <div>
              <Label htmlFor="framerate">Frame Rate</Label>
              <Select
                value={exportSettings.frameRate.toString()}
                onValueChange={(value) => 
                  updateExportSettings({ frameRate: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 FPS</SelectItem>
                  <SelectItem value="30">30 FPS</SelectItem>
                  <SelectItem value="60">60 FPS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Export Progress */}
            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Exporting...</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}

            {/* Export Actions */}
            <div className="flex justify-between pt-4">
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
                <div className="flex gap-2 w-full">
                  <Button 
                    onClick={() => setIsDialogOpen(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      startExport();
                      setIsDialogOpen(false);
                    }}
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Export Button (bypass dialog for default settings) */}
      <Button
        onClick={startExport}
        variant="outline"
        size="sm"
        disabled={clips.length === 0 || duration === 0 || isExporting}
        title="Quick export with default settings"
      >
        <Video className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default VideoExporter; 