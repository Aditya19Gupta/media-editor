"use client";
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Clip, TimelineState, TrackType, TransitionEffect } from '@/types/clip';
import TimelineClip from './TimelineClip';
import TimelineRuler from './TimelineRuler';
import TimelineTrack from './TimelineTrack';
import PlayHead from './PlayHead';
import PlaybackControls from './PlaybackControls';
import ZoomControls from './ZoomControls';
import { calculateTimeFromPosition, calculatePosition, formatTime, findAllGaps, removeGap, findAdjacentClips } from '@/utils/timelineUtils';
import { useToast } from '@/components/ui/use-toast';
import { MediaItem } from '@/types/media';
import TimelinePreview from './TimelinePreview';
import { Button } from '@/components/ui/button';
import { Plus, Component, ShipWheel, Trash2  } from 'lucide-react';
import TimelineTextTrack from './TimelineTextTrack';
import useEditorStore from '@/store/editorStore';
import SimpleVideoExporter from './SimpleVideoExporter';
import CollapseControl from './CollapseControl';
import FitTimelineControls from './FitTimelineControls';
import GapIndicator from './GapIndicator';
import { useTimeline } from '@/contexts/TimelineContext';


// Throttle function to limit execution frequency
const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): T => {
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
};

// Debounce function to delay execution
const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): T => {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  }) as T;
};

const calculateMaxDuration = (clips: Clip[], minDuration: number = 60): number => {
  let maxDuration = minDuration;
  clips.forEach(clip => {
    const clipEnd = clip.start + clip.duration;
    if (clipEnd > maxDuration) {
      maxDuration = clipEnd;
    }
  });
  return maxDuration;
};

// Helper functions for clip creation (moved outside component for better performance)
const createClipFromFile = (file: File, timePosition: number, trackIndex: number, trackType: TrackType): Promise<Clip> => {
  return new Promise((resolve, reject) => {
    const fileType = file.type;
    const fileUrl = URL.createObjectURL(file);
    console.log(`Creating clip for ${file.name} (${fileType}), URL: ${fileUrl}, Target Start: ${timePosition.toFixed(2)}s`);
    
    let duration: number;
    if (fileType.startsWith('video/')) {
      duration = 60; // Increased default for video before metadata (was 10)
    } else if (fileType.startsWith('audio/')) {
      duration = 30; // Default for audio
    } else {
      duration = 5;  // Default for image
    }

    const baseClipData = {
      id: `${file.name}-${Date.now()}`,
      type: fileType.startsWith('video/') ? 'video' : fileType.startsWith('audio/') ? 'audio' : 'image',
      title: file.name,
      start: timePosition,
      track: trackIndex,
      trackType: trackType,
      videoUrl: fileType.startsWith('video/') || fileType.startsWith('image/') ? fileUrl : undefined,
      audioUrl: fileType.startsWith('audio/') ? fileUrl : undefined,
      effects: [],
      trimStart: 0, // Start from beginning of original media
      trimEnd: undefined, // Will be set when we know the actual duration
      originalDuration: undefined // Will be set when we know the actual duration
    };

    if (fileType.startsWith('video/')) {
      console.log(`Attempting to load metadata for video: ${file.name}`);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous'; // Help with CORS issues
      
      // Set a timeout for metadata loading
      const metadataTimeout = setTimeout(() => {
        console.warn(`Metadata loading timeout for video: ${file.name}, using default duration: ${duration}`);
        resolve({
          ...baseClipData,
          duration: duration,
          trimEnd: duration,
          originalDuration: duration,
        } as Clip);
      }, 10000);

      video.onloadedmetadata = () => {
        clearTimeout(metadataTimeout);
        const actualDuration = video.duration;
        console.log(`Successfully loaded metadata for video: ${file.name}, Duration: ${actualDuration}s`);
        resolve({
          ...baseClipData,
          duration: actualDuration,
          trimEnd: actualDuration,
          originalDuration: actualDuration,
        } as Clip);
      };
      
      video.onerror = (err) => {
        clearTimeout(metadataTimeout);
        console.error(`Error loading video metadata for ${file.name}:`, err);
        console.warn(`Falling back to default duration (${duration}s) for video: ${file.name}`);
        resolve({
          ...baseClipData,
          duration: duration, // Now uses 60s instead of 10s
          trimEnd: duration,
          originalDuration: duration,
        } as Clip);
      };
      
      video.src = fileUrl;
    } else if (fileType.startsWith('audio/')) {
      console.log(`Attempting to load metadata for audio: ${file.name}`);
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      
      const metadataTimeout = setTimeout(() => {
        console.warn(`Metadata loading timeout for audio: ${file.name}, using default duration: ${duration}`);
        resolve({
          ...baseClipData,
          duration: duration,
          trimEnd: duration,
          originalDuration: duration,
        } as Clip);
      }, 10000);

      audio.onloadedmetadata = () => {
        clearTimeout(metadataTimeout);
        const actualDuration = audio.duration;
        console.log(`Successfully loaded metadata for audio: ${file.name}, Duration: ${actualDuration}s`);
        resolve({
          ...baseClipData,
          duration: actualDuration,
          trimEnd: actualDuration,
          originalDuration: actualDuration,
        } as Clip);
      };
      
      audio.onerror = (err) => {
        clearTimeout(metadataTimeout);
        console.error(`Error loading audio metadata for ${file.name}:`, err);
        console.warn(`Falling back to default duration (${duration}s) for audio: ${file.name}`);
        resolve({
          ...baseClipData,
          duration: duration,
          trimEnd: duration,
          originalDuration: duration,
        } as Clip);
      };
      
      audio.src = fileUrl;
    } else { // For images or other types
      console.log(`Using default duration (${duration}s) for image/other: ${file.name}`);
      resolve({
        ...baseClipData,
        duration: duration,
        trimEnd: duration,
        originalDuration: duration,
      } as Clip);
    }
  });
};

const createClipFromMedia = (mediaItem: any, timePosition: number, trackIndex: number, trackType: TrackType): Promise<Clip> => {
  return new Promise((resolve, reject) => {
    console.log(`Creating clip from media: ${mediaItem.name} (${mediaItem.type}), Duration from media: ${mediaItem.duration}s, URL: ${mediaItem.url}`);
    
    const baseClipData = {
      id: `${mediaItem.name}-${Date.now()}`,
      type: mediaItem.type.startsWith('video/') ? 'video' : mediaItem.type.startsWith('audio/') ? 'audio' : 'image',
      title: mediaItem.name,
      start: timePosition,
      track: trackIndex,
      trackType: trackType,
      videoUrl: mediaItem.type.startsWith('video/') || mediaItem.type.startsWith('image/') ? mediaItem.url : undefined,
      audioUrl: mediaItem.type.startsWith('audio/') ? mediaItem.url : undefined,
      effects: [],
      trimStart: 0, // Start from beginning of original media
      trimEnd: undefined, // Will be set when we know the actual duration
      originalDuration: undefined // Will be set when we know the actual duration
    };

    // If duration is missing or 0, try to load metadata
    if (!mediaItem.duration || mediaItem.duration === 0) {
      console.log(`Media item ${mediaItem.name} has no duration (${mediaItem.duration}), attempting to load metadata...`);
      
      if (mediaItem.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.crossOrigin = 'anonymous';
        
        const metadataTimeout = setTimeout(() => {
          console.warn(`Metadata loading timeout for media video: ${mediaItem.name}, using default duration: 60s`);
          resolve({
            ...baseClipData,
            duration: 60,
            trimEnd: 60,
            originalDuration: 60,
          } as Clip);
        }, 10000);

        video.onloadedmetadata = () => {
          clearTimeout(metadataTimeout);
          const actualDuration = video.duration;
          console.log(`Successfully loaded metadata for media video: ${mediaItem.name}, Duration: ${actualDuration}s`);
          resolve({
            ...baseClipData,
            duration: actualDuration,
            trimEnd: actualDuration,
            originalDuration: actualDuration,
          } as Clip);
        };
        
        video.onerror = (err) => {
          clearTimeout(metadataTimeout);
          console.error(`Error loading video metadata for media: ${mediaItem.name}:`, err);
          console.warn(`Falling back to default duration (60s) for media video: ${mediaItem.name}`);
          resolve({
            ...baseClipData,
            duration: 60,
            trimEnd: 60,
            originalDuration: 60,
          } as Clip);
        };
        
        video.src = mediaItem.url;
      } else if (mediaItem.type.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        
        const metadataTimeout = setTimeout(() => {
          console.warn(`Metadata loading timeout for media audio: ${mediaItem.name}, using default duration: 30s`);
          resolve({
            ...baseClipData,
            duration: 30,
            trimEnd: 30,
            originalDuration: 30,
          } as Clip);
        }, 10000);

        audio.onloadedmetadata = () => {
          clearTimeout(metadataTimeout);
          const actualDuration = audio.duration;
          console.log(`Successfully loaded metadata for media audio: ${mediaItem.name}, Duration: ${actualDuration}s`);
          resolve({
            ...baseClipData,
            duration: actualDuration,
            trimEnd: actualDuration,
            originalDuration: actualDuration,
          } as Clip);
        };
        
        audio.onerror = (err) => {
          clearTimeout(metadataTimeout);
          console.error(`Error loading audio metadata for media: ${mediaItem.name}:`, err);
          console.warn(`Falling back to default duration (30s) for media audio: ${mediaItem.name}`);
          resolve({
            ...baseClipData,
            duration: 30,
            trimEnd: 30,
            originalDuration: 30,
          } as Clip);
        };
        
        audio.src = mediaItem.url;
      } else {
        // For images, use a default duration
        console.log(`Using default duration (5s) for media image: ${mediaItem.name}`);
        resolve({
          ...baseClipData,
          duration: 5,
          trimEnd: 5,
          originalDuration: 5,
        } as Clip);
      }
    } else {
      // Use the duration from the media item if it's valid
      console.log(`Using media item duration: ${mediaItem.duration}s for ${mediaItem.name}`);
      resolve({
        ...baseClipData,
        duration: mediaItem.duration,
        trimEnd: mediaItem.duration,
        originalDuration: mediaItem.duration,
      } as Clip);
    }
  });
};

// Define initial track configuration in DESCENDING order (newest first)
const INITIAL_TRACK_CONFIG = [
  { type: TrackType.VIDEO, label: 'Visual 2' }, // Can accept video, image, text
  { type: TrackType.VIDEO, label: 'Visual 1' }, // Can accept video, image, text
  { type: TrackType.AUDIO, label: 'Audio 1' }   // Audio only
];

interface TimelineProps {
  initialClips?: Clip[];
  isPreview?: boolean;
}

const Timeline: React.FC<TimelineProps> = ({
  initialClips = [],
  isPreview = false
}) => {
  const { toast } = useToast();
  const setEditorCurrentTime = useEditorStore((state: any) => state.setCurrentTime);
  const textOverlays = useEditorStore((state: any) => state.textOverlays); // Get text overlays for synchronization
  const updateTextOverlay = useEditorStore((state: any) => state.updateTextOverlay);
  
  // Shared timeline context for sidebar export
  const { setTimelineState } = useTimeline();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeTrack, setActiveTrack] = useState<number | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [copiedClip, setCopiedClip] = useState<Clip | null>(null);
  const [previewSize] = useState({ width: 640, height: 360 });
  const [playHeadPosition, setPlayHeadPosition] = useState(1); // initial position
  
  //collapse
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [fitZoomLevel, setFitZoomLevel] = useState<number | null>(null); // Track fit timeline zoom level
  
  // Track which adjacent clip pairs should show transition buttons
  const [adjacentTransitionButtons, setAdjacentTransitionButtons] = useState<Set<string>>(new Set());

  // Track dropped effects for visual feedback
  const [droppedEffects, setDroppedEffects] = useState<Map<string, { effectName: string; timestamp: number }>>(new Map());

  // Dynamic track insertion states
  const [dragIndicator, setDragIndicator] = useState<{
    show: boolean;
    position: number;
    trackType: TrackType;
  }>({ show: false, position: -1, trackType: TrackType.VIDEO });
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Dynamic track configuration
  const [trackConfig, setTrackConfig] = useState(INITIAL_TRACK_CONFIG);

  const [state, setState] = useState<TimelineState>({
    clips: initialClips.length > 0 ? initialClips : [],
    transitions: [],
    zoom: 50,
    currentTime: 0,
    duration: calculateMaxDuration(initialClips.length > 0 ? initialClips : []),
    playing: false
  });

  // Sync timeline state with shared context for sidebar export
  useEffect(() => {
    setTimelineState(state);
  }, [state, setTimelineState]);

  const animationRef = useRef<number | null>(null);
  const lastFrameTime = useRef<number | null>(null);
  const currentTimeRef = useRef<number>(state.currentTime);
  const lastStateUpdateTime = useRef<number>(0);

  // Helper function to determine track type from file or media content
  const getTrackTypeFromContent = useCallback((contentType: string): TrackType => {
    if (contentType.startsWith('video/')) return TrackType.VIDEO;
    if (contentType.startsWith('image/')) return TrackType.VIDEO; // Images go to visual tracks
    if (contentType.startsWith('audio/')) return TrackType.AUDIO;
    if (contentType === 'text' || contentType === 'text/overlay') return TrackType.VIDEO; // Text goes to visual tracks
    return TrackType.VIDEO; // Default to video track
  }, []);

  // Helper function to insert a new track at a specific position
  const insertTrackAtPosition = useCallback((position: number, trackType: TrackType) => {
    setTrackConfig(prev => {
      // Count existing tracks of the target type for proper naming
      const existingCount = prev.filter(t => t.type === trackType).length;
      
      const newTrack = {
        type: trackType,
        label: trackType === TrackType.AUDIO 
          ? `Audio ${existingCount + 1}`
          : `Visual ${existingCount + 1}`
      };
      
      // Always add at the TOP of the respective section for descending order
      let insertPosition = position;
      
      if (trackType === TrackType.VIDEO) {
        // Add at the very beginning (top) for descending order
        insertPosition = 0;
      } else if (trackType === TrackType.AUDIO) {
        // Find first audio track and insert before it for descending order
        let firstAudioIndex = prev.findIndex(t => t.type === TrackType.AUDIO);
        if (firstAudioIndex === -1) {
          // No audio tracks exist, add at the end
          insertPosition = prev.length;
        } else {
          insertPosition = firstAudioIndex;
        }
      }
      
      const newConfig = [...prev];
      newConfig.splice(insertPosition, 0, newTrack);
      return newConfig;
    });

    // Update existing clips' track indices that are at or after the insertion position
    setState(prevState => ({
      ...prevState,
      clips: prevState.clips.map(clip => ({
        ...clip,
        track: clip.track >= position ? clip.track + 1 : clip.track
      })),
      transitions: prevState.transitions || []
    }));
  }, []);

  // Helper function to get the appropriate insertion position based on track type
  const getInsertionPosition = useCallback((trackType: TrackType, dropPosition: number): number => {
    if (trackType === TrackType.AUDIO) {
      // For audio tracks, find the last audio track position + 1
      let lastAudioIndex = -1;
      trackConfig.forEach((track, index) => {
        if (track.type === TrackType.AUDIO) {
          lastAudioIndex = index;
        }
      });
      
      // If dropping between tracks, use the drop position
      // Otherwise, add after the last audio track
      if (dropPosition >= 0 && dropPosition <= trackConfig.length) {
        return Math.max(dropPosition, lastAudioIndex + 1);
      }
      return lastAudioIndex + 1;
    } else {
      // For visual tracks, find the last visual track position + 1
      let lastVisualIndex = -1;
      trackConfig.forEach((track, index) => {
        if (track.type === TrackType.VIDEO) {
          lastVisualIndex = index;
        }
      });
      
      // If dropping between tracks, use the drop position
      // Otherwise, add after the last visual track
      if (dropPosition >= 0 && dropPosition <= lastVisualIndex + 1) {
        return dropPosition;
      }
      return lastVisualIndex + 1;
    }
  }, [trackConfig]);

  // Handle clip copy
  const handleClipCopy = useCallback((clipId: string) => {
    const clipToCopy = state.clips.find(c => c.id === clipId);
    if (clipToCopy) {
      setCopiedClip(clipToCopy);
      toast({
        title: "Clip copied",
        description: `${clipToCopy.title} has been copied to clipboard`,
      });
    }
  }, [state.clips, toast]);

  // Handle clip paste
  const handleClipPaste = useCallback(() => {
    if (!copiedClip) return;

    const newClip = {
      ...copiedClip,
      id: `${copiedClip.id}-copy-${Date.now()}`,
      start: state.currentTime
    };

    setState(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
      duration: calculateMaxDuration([...prev.clips, newClip]),
      transitions: prev.transitions || []
    }));

    toast({
      title: "Clip pasted",
      description: `${copiedClip.title} has been pasted at ${state.currentTime.toFixed(2)}s`,
    });
  }, [copiedClip, state.currentTime, toast]);

  // Handle transition add
  const handleTransitionAdd = useCallback((leftClipId: string, rightClipId: string, transitionType: string) => {
    setState(prev => {
      const leftClipIndex = prev.clips.findIndex(c => c.id === leftClipId);
      const rightClipIndex = prev.clips.findIndex(c => c.id === rightClipId);
      
      if (leftClipIndex === -1 || rightClipIndex === -1) return prev;

      const updatedClips = [...prev.clips];
      
      // Add transition to the left clip (transition out)
      updatedClips[leftClipIndex] = {
        ...updatedClips[leftClipIndex],
        transition: {
          id: `transition-${Date.now()}`,
          type: transitionType,
          duration: 2.5, // 2.5 second transition duration
          settings: {
            effectType: transitionType,
            isTransition: true,
            transitionPoint: updatedClips[leftClipIndex].start + updatedClips[leftClipIndex].duration,
          }
        },
        // Also add to effects array for rendering in TimelinePreview
        effects: [
          ...(updatedClips[leftClipIndex].effects || []),
          transitionType
        ]
      };

      // Also add transition info to the right clip for proper rendering
      updatedClips[rightClipIndex] = {
        ...updatedClips[rightClipIndex],
        transition: {
          id: `transition-${Date.now()}`,
          type: transitionType,
          duration: 2.5, // 2.5 second transition duration
          settings: {
            effectType: transitionType,
            isTransition: true,
            transitionPoint: updatedClips[leftClipIndex].start + updatedClips[leftClipIndex].duration,
          }
        },
        // Also add to effects array for rendering in TimelinePreview
        effects: [
          ...(updatedClips[rightClipIndex].effects || []),
          transitionType
        ]
      };

      return {
        ...prev,
        clips: updatedClips
      };
    });

    toast({
      title: "Transition added",
      description: `${transitionType} transition added between clips (2.5s duration)`,
    });
  }, [toast]);

  // Handle transition remove
  const handleTransitionRemove = useCallback((leftClipId: string, rightClipId: string) => {
    setState(prev => {
      const leftClipIndex = prev.clips.findIndex(c => c.id === leftClipId);
      const rightClipIndex = prev.clips.findIndex(c => c.id === rightClipId);
      
      if (leftClipIndex === -1 || rightClipIndex === -1) return prev;

      const updatedClips = [...prev.clips];
      
      // Remove transition from both clips
      if (updatedClips[leftClipIndex].transition) {
        const transitionType = updatedClips[leftClipIndex].transition.type;
        updatedClips[leftClipIndex] = {
          ...updatedClips[leftClipIndex],
          transition: undefined,
          // Also remove from effects array
          effects: (updatedClips[leftClipIndex].effects || []).filter(effect => effect !== transitionType)
        };
      }
      
      if (updatedClips[rightClipIndex].transition) {
        const transitionType = updatedClips[rightClipIndex].transition.type;
        updatedClips[rightClipIndex] = {
          ...updatedClips[rightClipIndex],
          transition: undefined,
          // Also remove from effects array
          effects: (updatedClips[rightClipIndex].effects || []).filter(effect => effect !== transitionType)
        };
      }

      return {
        ...prev,
        clips: updatedClips
      };
    });

    toast({
      title: "Transition removed",
      description: "Transition has been removed between clips",
    });
  }, [toast]);

  // Handle container resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 60);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  // Handle clip selection
  const handleClipSelect = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
    const clip = state.clips.find(c => c.id === clipId);
    if (clip) {
      toast({
        title: "Clip selected",
        description: `${clip.title} - Duration: ${clip.duration}s`,
      });
    }
  }, [state.clips, toast]);

  // Handle clip movement
  // NOTE: This function has been replaced by handleClipMoveFixed which properly handles track index mapping
  // between display indices and original track indices for audio/visual separation

  // Handle clip splitting
  const handleClipSplit = useCallback((clipId: string, splitTime: number) => {
    setState(prev => {
      const clipIndex = prev.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return prev;

      const clipToSplit = prev.clips[clipIndex];
      const clipSplitPosition = splitTime - clipToSplit.start;
      
      if (clipSplitPosition <= 0 || clipSplitPosition >= clipToSplit.duration) {
        return prev;
      }

      const timestamp = Date.now();
      const newClipId1 = `${clipToSplit.id}-part1-${timestamp}`;
      const newClipId2 = `${clipToSplit.id}-part2-${timestamp}`;

      // Calculate original duration if not set
      const originalDuration = clipToSplit.originalDuration || clipToSplit.duration;
      const currentTrimStart = clipToSplit.trimStart || 0;
      const currentTrimEnd = clipToSplit.trimEnd || originalDuration;

      const firstPart: Clip = {
        id: newClipId1,
        title: clipToSplit.title,
        type: clipToSplit.type,
        duration: clipSplitPosition,
        start: clipToSplit.start,
        track: clipToSplit.track,
        trackType: clipToSplit.trackType,
        videoUrl: clipToSplit.videoUrl,
        audioUrl: clipToSplit.audioUrl,
        thumbnail: clipToSplit.thumbnail,
        color: clipToSplit.color,
        effects: clipToSplit.effects || [],
        muted: clipToSplit.muted,
        transition: clipToSplit.transition,
        textContent: clipToSplit.textContent,
        textStyle: clipToSplit.textStyle,
        textPosition: clipToSplit.textPosition,
        visible: clipToSplit.visible,
        textOverlayId: clipToSplit.textOverlayId,
        imageTransform: clipToSplit.imageTransform,
        trimStart: currentTrimStart,
        trimEnd: currentTrimStart + clipSplitPosition,
        originalDuration: originalDuration
      };

      const secondPart: Clip = {
        id: newClipId2,
        title: clipToSplit.title,
        type: clipToSplit.type,
        duration: clipToSplit.duration - clipSplitPosition,
        start: clipToSplit.start + clipSplitPosition,
        track: clipToSplit.track,
        trackType: clipToSplit.trackType,
        videoUrl: clipToSplit.videoUrl,
        audioUrl: clipToSplit.audioUrl,
        thumbnail: clipToSplit.thumbnail,
        color: clipToSplit.color,
        effects: clipToSplit.effects || [],
        muted: clipToSplit.muted,
        transition: undefined, // Clear transition for second part
        textContent: clipToSplit.textContent,
        textStyle: clipToSplit.textStyle,
        textPosition: clipToSplit.textPosition,
        visible: clipToSplit.visible,
        textOverlayId: clipToSplit.textOverlayId,
        imageTransform: clipToSplit.imageTransform,
        trimStart: currentTrimStart + clipSplitPosition,
        trimEnd: currentTrimEnd,
        originalDuration: originalDuration
      };

      let newClips = [...prev.clips];
      let clipsToAdd = [firstPart, secondPart];
      let clipsToRemove = [clipToSplit.id];

      // Handle linked clips
      if (clipToSplit.type === 'video') {
        // If splitting a video clip, also split its linked audio clip
        const linkedAudioId = `${clipId}-audio`;
        const linkedAudioClip = prev.clips.find(c => c.id === linkedAudioId);
        
        if (linkedAudioClip) {
          // Calculate original duration for audio clip if not set
          const audioOriginalDuration = linkedAudioClip.originalDuration || linkedAudioClip.duration;
          const audioCurrentTrimStart = linkedAudioClip.trimStart || 0;
          const audioCurrentTrimEnd = linkedAudioClip.trimEnd || audioOriginalDuration;

          const audioFirstPart: Clip = {
            id: `${newClipId1}-audio`,
            title: linkedAudioClip.title,
            type: linkedAudioClip.type,
            duration: clipSplitPosition,
            start: linkedAudioClip.start,
            track: linkedAudioClip.track,
            trackType: linkedAudioClip.trackType,
            videoUrl: linkedAudioClip.videoUrl,
            audioUrl: linkedAudioClip.audioUrl,
            thumbnail: linkedAudioClip.thumbnail,
            color: linkedAudioClip.color,
            effects: linkedAudioClip.effects || [],
            muted: linkedAudioClip.muted,
            transition: linkedAudioClip.transition,
            textContent: linkedAudioClip.textContent,
            textStyle: linkedAudioClip.textStyle,
            textPosition: linkedAudioClip.textPosition,
            visible: linkedAudioClip.visible,
            textOverlayId: linkedAudioClip.textOverlayId,
            imageTransform: linkedAudioClip.imageTransform,
            trimStart: audioCurrentTrimStart,
            trimEnd: audioCurrentTrimStart + clipSplitPosition,
            originalDuration: audioOriginalDuration
          };

          const audioSecondPart: Clip = {
            id: `${newClipId2}-audio`,
            title: linkedAudioClip.title,
            type: linkedAudioClip.type,
            duration: linkedAudioClip.duration - clipSplitPosition,
            start: linkedAudioClip.start + clipSplitPosition,
            track: linkedAudioClip.track,
            trackType: linkedAudioClip.trackType,
            videoUrl: linkedAudioClip.videoUrl,
            audioUrl: linkedAudioClip.audioUrl,
            thumbnail: linkedAudioClip.thumbnail,
            color: linkedAudioClip.color,
            effects: linkedAudioClip.effects || [],
            muted: linkedAudioClip.muted,
            transition: undefined, // Clear transition for second part
            textContent: linkedAudioClip.textContent,
            textStyle: linkedAudioClip.textStyle,
            textPosition: linkedAudioClip.textPosition,
            visible: linkedAudioClip.visible,
            textOverlayId: linkedAudioClip.textOverlayId,
            imageTransform: linkedAudioClip.imageTransform,
            trimStart: audioCurrentTrimStart + clipSplitPosition,
            trimEnd: audioCurrentTrimEnd,
            originalDuration: audioOriginalDuration
          };

          clipsToAdd.push(audioFirstPart, audioSecondPart);
          clipsToRemove.push(linkedAudioId);
        }
      } else if (clipToSplit.type === 'audio' && clipId.endsWith('-audio')) {
        // If splitting an audio clip that's linked to a video, also split the video clip
        const videoClipId = clipId.replace('-audio', '');
        const videoClip = prev.clips.find(c => c.id === videoClipId);
        
        if (videoClip) {
          const videoFirstPart = {
            ...videoClip,
            id: newClipId1.replace('-audio', ''),
            duration: clipSplitPosition
          };

          const videoSecondPart = {
            ...videoClip,
            id: newClipId2.replace('-audio', ''),
            start: videoClip.start + clipSplitPosition,
            duration: videoClip.duration - clipSplitPosition
          };

          clipsToAdd.push(videoFirstPart, videoSecondPart);
          clipsToRemove.push(videoClipId);
          
          // Update audio clip IDs to match the new video clips
          clipsToAdd[0].id = `${videoFirstPart.id}-audio`;
          clipsToAdd[1].id = `${videoSecondPart.id}-audio`;
        }
      }

      // Remove original clips
      newClips = newClips.filter(clip => !clipsToRemove.includes(clip.id));
      
      // Add new split clips
      newClips.push(...clipsToAdd);

      return {
        ...prev,
        clips: newClips,
        duration: calculateMaxDuration(newClips)
      };
    });

    const clip = state.clips.find(c => c.id === clipId);
    toast({
      title: "Clip split",
      description: clip?.type === 'video' 
        ? "Video and its audio track have been split into two parts"
        : "The clip has been split into two parts",
    });
  }, [state.clips, toast]);

  // Handle clip deletion
  const handleClipDelete = useCallback((clipId: string) => {
    setState(prev => {
      const clipToDelete = prev.clips.find(clip => clip.id === clipId);
      let idsToDelete = [clipId];
      
      // If deleting a video clip, also delete its linked audio clip
      if (clipToDelete?.type === 'video') {
        const linkedAudioId = `${clipId}-audio`;
        if (prev.clips.some(clip => clip.id === linkedAudioId)) {
          idsToDelete.push(linkedAudioId);
        }
      }
      // If deleting an audio clip that's linked to a video, also delete the video clip
      else if (clipToDelete?.type === 'audio' && clipId.endsWith('-audio')) {
        const videoClipId = clipId.replace('-audio', '');
        if (prev.clips.some(clip => clip.id === videoClipId)) {
          idsToDelete.push(videoClipId);
        }
      }
      
      const newClips = prev.clips.filter(clip => !idsToDelete.includes(clip.id));
      return {
        ...prev,
        clips: newClips,
        duration: calculateMaxDuration(newClips)
      };
    });

    const deletedClip = state.clips.find(c => c.id === clipId);
    toast({
      title: "Clip deleted",
      description: deletedClip?.type === 'video' 
        ? "Video and its audio track have been removed from the timeline"
        : "The clip has been removed from the timeline",
    });
  }, [state.clips, toast]);

  // Handle clip update for transformations
  const handleClipUpdate = useCallback((clipId: string, updates: Partial<Clip>) => {
    setState(prev => {
      const newClips = prev.clips.map(clip => 
        clip.id === clipId ? { ...clip, ...updates } : clip
      );
      return {
        ...prev,
        clips: newClips,
        duration: calculateMaxDuration(newClips)
      };
    });
  }, []);

  // Handle clip duplication
  const handleClipDuplicate = useCallback((clipId: string) => {
    setState(prev => {
      const clipToDuplicate = prev.clips.find(c => c.id === clipId);
      if (!clipToDuplicate) return prev;

      const newStart = clipToDuplicate.start + clipToDuplicate.duration + 0.01;
      let clipsToAdd = [];
      
      // Create the duplicate of the main clip
      const newClip = {
        ...clipToDuplicate,
        id: `${clipId}-copy-${Date.now()}`,
        start: newStart
      };
      clipsToAdd.push(newClip);
      
      // If duplicating a video clip, also duplicate its linked audio clip
      if (clipToDuplicate.type === 'video') {
        const linkedAudioId = `${clipId}-audio`;
        const linkedAudioClip = prev.clips.find(c => c.id === linkedAudioId);
        
        if (linkedAudioClip) {
          const newAudioClip = {
            ...linkedAudioClip,
            id: `${newClip.id}-audio`,
            start: newStart
          };
          clipsToAdd.push(newAudioClip);
        }
      }
      // If duplicating an audio clip that's linked to a video, also duplicate the video clip
      else if (clipToDuplicate.type === 'audio' && clipId.endsWith('-audio')) {
        const videoClipId = clipId.replace('-audio', '');
        const videoClip = prev.clips.find(c => c.id === videoClipId);
        
        if (videoClip) {
          const newVideoClip = {
            ...videoClip,
            id: `${videoClipId}-copy-${Date.now()}`,
            start: newStart
          };
          clipsToAdd.push(newVideoClip);
          
          // Update the audio clip ID to match the new video clip
          clipsToAdd[0].id = `${newVideoClip.id}-audio`;
        }
      }

      const newClips = [...prev.clips, ...clipsToAdd];
      return {
        ...prev,
        clips: newClips,
        duration: calculateMaxDuration(newClips)
      };
    });

    const duplicatedClip = state.clips.find(c => c.id === clipId);
    toast({
      title: "Clip duplicated",
      description: duplicatedClip?.type === 'video'
        ? "Video and its audio track have been duplicated"
        : "A copy of the clip has been added to the timeline",
    });
  }, [state.clips, toast]);

  // Handle clip mute/unmute
  const handleClipMute = useCallback((clipId: string) => {
    setState(prev => {
      const clipToMute = prev.clips.find(c => c.id === clipId);
      if (!clipToMute || clipToMute.type !== 'audio') return prev;

      const newClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            muted: !clip.muted
          };
        }
        return clip;
      });

      return {
        ...prev,
        clips: newClips
      };
    });

    const clip = state.clips.find(c => c.id === clipId);
    if (clip) {
      toast({
        title: clip.muted ? "Audio unmuted" : "Audio muted",
        description: `${clip.title} has been ${clip.muted ? 'unmuted' : 'muted'}`,
      });
    }
  }, [state.clips, toast]);

  // Optimized timeline click handler with throttling
  const handleTimelineClickCore = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Check if the click originated from a clip
    const target = e.target as HTMLElement;
    const clickedOnClip = target.closest('.timeline-clip');
    
    if (clickedOnClip || state.playing) {
      return;
    }
  
    // Use requestAnimationFrame for DOM calculations
    requestAnimationFrame(() => {
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft - 60; // Subtract 60px for track labels
        const newTime = calculateTimeFromPosition(clickX, state.zoom);
  
        if (newTime >= 0 && newTime <= state.duration) {
          setState(prev => ({
            ...prev,
            currentTime: newTime
          }));
        }
      }
    });
  }, [state.duration, state.playing, state.zoom]);

  // Throttled version of timeline click handler
  const handleTimelineClick = useMemo(
    () => throttle(handleTimelineClickCore, 50),
    [handleTimelineClickCore]
  );

  // Memoize expensive calculations
  const timelineWidth = useMemo(() => 
    (state.duration + 5) * state.zoom, 
    [state.duration, state.zoom]
  );

  // Memoize playhead position using currentTimeRef for smoother updates
  const playheadPosition = useMemo(() => 
    calculatePosition(currentTimeRef.current, state.zoom),
    [state.currentTime, state.zoom]
  );

  // Debounced state setter for performance
  const debouncedSetState = useMemo(
    () => debounce(setState, 10),
    []
  );

  // Handle track drag over
  const handleTrackDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Handle track drop
  const handleTrackDrop = useCallback((trackIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    
    // Extract data synchronously (fast)
    const files = Array.from(e.dataTransfer.files);
    const jsonData = e.dataTransfer.getData("application/json");
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    // Calculate position from mouse drop location
    const timePosition = calculateTimeFromPosition(clickX, state.zoom);
    const track = trackConfig[trackIndex];
    
    if (!track) return;

    console.log('[Timeline.tsx] handleTrackDrop: files.length =', files.length, ', jsonData =', jsonData, ', timePosition set to:', timePosition);
    
    // Schedule async processing with minimal delay
    setTimeout(async () => {
      // Process files FIRST (files from OS/external drag)
      if (files.length > 0) {
        console.log('[Timeline.tsx] handleTrackDrop: Processing', files.length, 'file(s)');
        files.forEach(async (file, index) => {
          const fileType = file.type;
          const canAddToTrack = 
            (track.type === TrackType.VIDEO && (fileType.startsWith('video/') || fileType.startsWith('image/'))) ||
            (track.type === TrackType.AUDIO && fileType.startsWith('audio/'));
          
          if (canAddToTrack) {
            const adjustedTimePosition = timePosition + (index * 0.1);
            
            try {
              // Create the main clip (now returns a Promise)
              const newClip = await createClipFromFile(file, adjustedTimePosition, trackIndex, track.type);
              
              let clipsToAdd: Clip[] = [newClip];
              
              // If it's a video file, also create an audio clip for the audio section
              if (fileType.startsWith('video/')) {
                // Find the first available audio track
                const audioTrackConfigIndex = trackConfig.findIndex(t => t.type === TrackType.AUDIO);
                
                if (audioTrackConfigIndex !== -1) {
                  const audioClip = {
                    id: `${newClip.id}-audio`,
                    type: 'audio' as const,
                    title: `${file.name} (Audio)`,
                    start: adjustedTimePosition, // Use the same start time
                    duration: newClip.duration, // Use the actual duration from the video (potentially updated by metadata)
                    track: audioTrackConfigIndex,
                    trackType: TrackType.AUDIO,
                    audioUrl: newClip.videoUrl, // Use the same URL for audio extraction
                    effects: []
                  };
                  clipsToAdd.push(audioClip);
                }
              }
              
              console.log('[Timeline.tsx] handleTrackDrop: Clips to add before setState:', clipsToAdd.map(c => ({ id: c.id, start: c.start, duration: c.duration, type: c.type })));

              setState(prev => {
                const updatedClips = [...prev.clips, ...clipsToAdd];
                const newMaxDuration = calculateMaxDuration(updatedClips);
                console.log('[Timeline.tsx] handleTrackDrop: New max duration calculated:', newMaxDuration, 'from clips:', updatedClips.map(c => ({id: c.id, start: c.start, duration: c.duration })));
                return {
                  ...prev,
                  clips: updatedClips,
                  duration: newMaxDuration
                };
              });
              
              toast({
                title: "File added",
                description: fileType.startsWith('video/') 
                  ? `${file.name} added to ${track.label} with audio track at 0s (Duration: ${newClip.duration.toFixed(2)}s)`
                  : `${file.name} added to ${track.label} at 0s (Duration: ${newClip.duration.toFixed(2)}s)`,
              });
            } catch (error) {
              console.error("Error creating clip from file:", error);
              toast({
                title: "Error adding file",
                description: `Could not process ${file.name}.`,
                variant: "destructive"
              });
            }
          } else {
            toast({
              title: "Invalid file type",
              description: `Cannot add ${fileType.split('/')[0]} to ${track.type} track`,
              variant: "destructive"
            });
          }
        });
      }
      // Process media items (from media library or internal drags) ONLY if no files were dropped
      else if (jsonData) {
        try {
          const data = JSON.parse(jsonData);
          console.log('[Timeline.tsx] handleTrackDrop: Parsed JSON data:', data);

          // More specific check for internal clip drag data
          // Internal clip drags should have clipId, offsetX, trackHeight but NO url, type, name properties
          if (data && 
              typeof data.clipId === 'string' && 
              typeof data.offsetX === 'number' && 
              typeof data.trackHeight === 'number' &&
              !data.url && 
              !data.type && 
              !data.name) {
            console.log('[Timeline.tsx] handleTrackDrop: Detected internal clip drag data, ignoring for new item creation:', data);
            // This drop is for an existing clip being moved. The actual move logic
            // should be handled by TimelineClip's onDragEnd -> onClipMove (handleClipMoveFixed).
            // So, we return early to prevent trying to create a new clip from this data.
            return;
          }

          // Check if this is a text overlay drop
          if (data && data.type === 'text/overlay' && data.textOverlay) {
            console.log('[Timeline.tsx] handleTrackDrop: Detected text overlay drop:', data);
            
            // Only allow text overlays to be dropped on video tracks
            if (track.type === TrackType.VIDEO) {
              try {
                const textOverlay = data.textOverlay;
                const newClip: Clip = {
                  id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'text' as const,
                  title: textOverlay.content || "Text Overlay",
                  start: timePosition,
                  duration: Math.max(textOverlay.endTime - textOverlay.startTime, 1), // Minimum 1 second
                  track: trackIndex,
                  trackType: TrackType.TEXT,
                  effects: [],
                  // Text-specific properties
                  textContent: textOverlay.content,
                  textStyle: textOverlay.style,
                  textPosition: textOverlay.position,
                  visible: textOverlay.visible,
                  textOverlayId: textOverlay.id // Link to source text overlay
                };

                setState(prev => {
                  const updatedClips = [...prev.clips, newClip];
                  const newMaxDuration = calculateMaxDuration(updatedClips);
                  return {
                    ...prev,
                    clips: updatedClips,
                    duration: newMaxDuration
                  };
                });

                // Mark the text overlay as dropped in timeline
                updateTextOverlay(textOverlay.id, { droppedInTimeline: true });
                
                toast({
                  title: "Text added",
                  description: `"${textOverlay.content}" added to ${track.label} at 0s (Duration: ${newClip.duration.toFixed(2)}s)`,
                });
              } catch (error) {
                console.error("Error creating text clip:", error);
                toast({
                  title: "Error adding text",
                  description: "Could not process the text overlay.",
                  variant: "destructive"
                });
              }
            } else {
              toast({
                title: "Invalid drop target",
                description: "Text overlays can only be added to video tracks",
                variant: "destructive"
              });
            }
            return; // Exit early for text overlays
          }

          // Check if this is a simple text card drop
          if (data && data.type === 'text' && data.textContent) {
            console.log('[Timeline.tsx] handleTrackDrop: Detected simple text card drop:', data);
            
            // Only allow text cards to be dropped on video tracks
            if (track.type === TrackType.VIDEO) {
              try {
                const newClip: Clip = {
                  id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'text' as const,
                  title: data.name || data.textContent || "Text",
                  start: timePosition,
                  duration: data.duration || 3, // Use provided duration or default to 3 seconds
                  track: trackIndex,
                  trackType: TrackType.TEXT,
                  effects: [],
                  // Text-specific properties
                  textContent: data.textContent,
                  textStyle: data.textStyle || {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 24,
                    color: '#FFFFFF',
                    backgroundColor: 'transparent',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontStyle: 'normal',
                    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                  },
                  textPosition: { x: 50, y: 50 }, // Center position
                  visible: true
                };

                setState(prev => {
                  const updatedClips = [...prev.clips, newClip];
                  const newMaxDuration = calculateMaxDuration(updatedClips);
                  return {
                    ...prev,
                    clips: updatedClips,
                    duration: newMaxDuration
                  };
                });

                toast({
                  title: "Text added",
                  description: `"${data.textContent}" added to ${track.label} at ${(timePosition).toFixed(1)}s (Duration: ${newClip.duration.toFixed(2)}s)`,
                });
              } catch (error) {
                console.error("Error creating text clip:", error);
                toast({
                  title: "Error adding text",
                  description: "Could not process the text card.",
                  variant: "destructive"
                });
              }
            } else {
              toast({
                title: "Invalid drop target",
                description: "Text cards can only be added to video tracks",
                variant: "destructive"
              });
            }
            return; // Exit early for simple text cards
          }

          // Check if this is an effect drop
          if (data && data.type === 'effect') {
            console.log('[Timeline.tsx] handleTrackDrop: Detected effect drop:', data);
            
            // Calculate the actual drop position from mouse coordinates
            const actualTimePosition = calculateTimeFromPosition(clickX, state.zoom);
            
            // Find clips on this track around the drop position
            const trackClips = state.clips
              .filter(clip => clip.track === trackIndex)
              .sort((a, b) => a.start - b.start);
            
            console.log('[Timeline.tsx] handleTrackDrop: Effect drop at time:', actualTimePosition, 'on track:', trackIndex);
            console.log('[Timeline.tsx] handleTrackDrop: Track clips:', trackClips.map(c => ({id: c.id, title: c.title, start: c.start, end: c.start + c.duration})));
            
            // Debug: Show detailed clip positions
            trackClips.forEach((clip, i) => {
              console.log(`[Timeline.tsx] Clip ${i}: "${clip.title}" from ${clip.start}s to ${clip.start + clip.duration}s`);
            });
            
            // First, check for adjacent clips to prioritize transition creation
            let prevClip: Clip | null = null;
            let nextClip: Clip | null = null;
            const transitionTolerance = 2; // seconds tolerance for transition detection
            
            for (let i = 0; i < trackClips.length - 1; i++) {
              const current = trackClips[i];
              const next = trackClips[i + 1];
              const currentEnd = current.start + current.duration;
              const gapStart = currentEnd;
              const gapEnd = next.start;
              
              // Check if drop is in the gap between clips OR near the edges (within tolerance)
              const nearCurrentEnd = actualTimePosition >= (currentEnd - transitionTolerance) && actualTimePosition <= currentEnd;
              const nearNextStart = actualTimePosition >= next.start && actualTimePosition <= (next.start + transitionTolerance);
              const inGap = actualTimePosition >= gapStart && actualTimePosition <= gapEnd;
              
              console.log(`[Timeline.tsx] Checking transition between "${current.title}" and "${next.title}":`, {
                currentEnd: currentEnd.toFixed(2),
                nextStart: next.start.toFixed(2),
                dropTime: actualTimePosition.toFixed(2),
                tolerance: transitionTolerance,
                nearCurrentEnd: nearCurrentEnd,
                nearNextStart: nearNextStart,
                inGap: inGap,
                gapSize: (gapEnd - gapStart).toFixed(2) + 's'
              });
              
              if (nearCurrentEnd || nearNextStart || inGap) {
                prevClip = current;
                nextClip = next;
                console.log('[Timeline.tsx] ✅ TRANSITION DETECTED between clips:', {
                  prevClip: current.title,
                  nextClip: next.title,
                  detectionReason: nearCurrentEnd ? 'nearCurrentEnd' : nearNextStart ? 'nearNextStart' : 'inGap'
                });
                break;
              }
            }
            
            if (prevClip && nextClip) {
              // Create transition effect between clips
              console.log('[Timeline.tsx] handleTrackDrop: Creating transition between:', prevClip.id, 'and', nextClip.id);
              
              // Create overlapping transition effect (max 5 seconds, split equally)
              const maxTransitionDuration = 5.0; // Maximum 5 seconds
              const gapStart = prevClip.start + prevClip.duration;
              const gapEnd = nextClip.start;
              const gapDuration = gapEnd - gapStart;
              
              // Calculate transition duration and overlap
              let transitionDuration = Math.min(maxTransitionDuration, Math.max(gapDuration + 1.0, 1.0));
              const overlapPerSide = transitionDuration / 2; // 2.5s each side for 5s total
              
              // Transition starts before the gap (extends first clip) and ends after gap starts (overlaps second clip)
              const transitionStart = gapStart - overlapPerSide; // Start 2.5s before first clip ends
              
              console.log(`[Timeline.tsx] 🎬 Creating overlapping transition:`, {
                prevClip: prevClip.id,
                nextClip: nextClip.id,
                gapStart: gapStart.toFixed(2),
                gapEnd: gapEnd.toFixed(2),
                gapDuration: gapDuration.toFixed(2),
                transitionStart: transitionStart.toFixed(2),
                transitionDuration: transitionDuration.toFixed(2),
                overlapPerSide: overlapPerSide.toFixed(2),
                effect: data.id
              });

              // Create overlapping transition effect
                                                          const transitionEffect = {
                                              id: `transition-${prevClip.id}-${nextClip.id}-${Date.now()}`,
                                              type: data.id as any, // Use the actual effect type instead of hardcoded 'crossfade'
                                              duration: transitionDuration,
                                              fromClipId: prevClip.id,
                                              toClipId: nextClip.id,
                                              startTime: transitionStart,
                                              settings: {
                                                effectType: data.id,
                                                effectName: data.name,
                                                intensity: 1.0,
                                                easing: 'ease-in-out' as const,
                                                overlapPerSide: overlapPerSide
                                              }
                                            };

              setState(prev => ({
                ...prev,
                transitions: [...(prev.transitions || []), transitionEffect]
              }));
              
              toast({
                title: "Transition effect created",
                description: `${data.name} effect applied to create transition between "${prevClip.title}" and "${nextClip.title}"`,
              });
            } else {
              console.log('[Timeline.tsx] ❌ No transition detected, checking individual clip detection...');
              
              // If no transition detected, check if dropped directly on a clip (away from edges)
              const targetClip = trackClips.find(clip => {
                const clipStart = clip.start + transitionTolerance; // Add tolerance from start
                const clipEnd = clip.start + clip.duration - transitionTolerance; // Subtract tolerance from end
                const isInMiddle = actualTimePosition >= clipStart && actualTimePosition <= clipEnd;
                
                console.log(`[Timeline.tsx] Checking individual clip "${clip.title}":`, {
                  clipStart: clipStart.toFixed(2),
                  clipEnd: clipEnd.toFixed(2),
                  dropTime: actualTimePosition.toFixed(2),
                  isInMiddle: isInMiddle
                });
                
                return isInMiddle;
              });
              
              if (targetClip) {
                console.log(`[Timeline.tsx] ✅ INDIVIDUAL CLIP DETECTION: Applying effect to "${targetClip.title}"`);
                
                // Apply effect to the middle of the clip (away from edges)
                setState(prev => ({
                  ...prev,
                  clips: prev.clips.map(clip => 
                    clip.id === targetClip.id 
                      ? { ...clip, effects: [...(clip.effects || []), data.id] }
                      : clip
                  )
                }));
                
                toast({
                  title: "Effect applied",
                  description: `${data.name} effect applied to ${targetClip.title}`,
                });
              } else {
                console.log('[Timeline.tsx] ❌ No individual clip detected either');
                // No clips found
                toast({
                  title: "Cannot apply effect",
                  description: "Drop effects directly onto clips or between adjacent clips to create transitions.",
                  variant: "destructive"
                });
              }
            }
            
            return; // Exit early for effect drops
          }

          const mediaItem = data as MediaItem; // Treat as MediaItem if not an internal drag

          // Add a check for mediaItem and mediaItem.type
          if (!mediaItem || typeof mediaItem.type !== 'string' || (!mediaItem.url && mediaItem.type !== 'text/overlay')) { // Allow text overlays without URL
            console.error('Invalid media item or missing type/url:', mediaItem);
            toast({
              title: "Invalid media data",
              description: "The dropped media data is not in the expected format.",
              variant: "destructive"
            });
            return; // Exit early if data is invalid
          }

          const canAddToTrack = 
            (track.type === TrackType.VIDEO && (mediaItem.type.startsWith('video/') || mediaItem.type.startsWith('image/'))) ||
            (track.type === TrackType.AUDIO && mediaItem.type.startsWith('audio/'));
          
          if (canAddToTrack) {
            try {
              // Determine the correct trackType based on media type
              let clipTrackType: TrackType;
              if (mediaItem.type.startsWith('video/')) {
                clipTrackType = TrackType.VIDEO;
              } else if (mediaItem.type.startsWith('image/')) {
                clipTrackType = TrackType.IMAGE;
              } else if (mediaItem.type.startsWith('audio/')) {
                clipTrackType = TrackType.AUDIO;
              } else {
                clipTrackType = track.type; // fallback to track type
              }
              
              const newClip = await createClipFromMedia(mediaItem, timePosition, trackIndex, clipTrackType);
              
              let clipsToAdd: Clip[] = [newClip];
              
              // If it's a video media item, also create an audio clip for the audio section
              if (mediaItem.type.startsWith('video/')) {
                // Find the first available audio track
                const audioTrackConfigIndex = trackConfig.findIndex(t => t.type === TrackType.AUDIO);
                
                if (audioTrackConfigIndex !== -1) {
                  const audioClip = {
                    id: `${newClip.id}-audio`,
                    type: 'audio' as const,
                    title: `${mediaItem.name} (Audio)`,
                    start: timePosition, // Use timePosition for media items
                    duration: newClip.duration, // Use duration from the created media clip
                    track: audioTrackConfigIndex,
                    trackType: TrackType.AUDIO,
                    audioUrl: mediaItem.url, // Use the same URL for audio extraction
                    effects: []
                  };
                  clipsToAdd.push(audioClip);
                }
              }
              
              console.log('[Timeline.tsx] handleTrackDrop (mediaItem): Clips to add before setState:', clipsToAdd.map(c => ({ id: c.id, start: c.start, duration: c.duration, type: c.type })));
              
              setState(prev => {
                // Check for overlaps and adjust positions for new clips
                const adjustedClips = clipsToAdd.map(newClip => {
                  // Find overlapping clips on the same track
                  const overlappingClips = prev.clips.filter(existingClip => {
                    if (existingClip.track !== newClip.track) return false;
                    
                    const newClipEnd = newClip.start + newClip.duration;
                    const existingClipEnd = existingClip.start + existingClip.duration;
                    return !(newClipEnd <= existingClip.start || existingClipEnd <= newClip.start);
                  });

                  if (overlappingClips.length > 0) {
                    // Find a safe position for the new clip
                    const trackClips = prev.clips
                      .filter(clip => clip.track === newClip.track)
                      .sort((a, b) => a.start - b.start);
                    
                    let safeStart = newClip.start;
                    
                    if (trackClips.length > 0) {
                      // Try to find a gap between clips
                      let foundGap = false;
                      
                      for (let i = 0; i < trackClips.length - 1; i++) {
                        const currentClip = trackClips[i];
                        const nextClip = trackClips[i + 1];
                        const gapStart = currentClip.start + currentClip.duration;
                        const gapEnd = nextClip.start;
                        const gapSize = gapEnd - gapStart;
                        
                        if (gapSize >= newClip.duration) {
                          safeStart = gapStart;
                          foundGap = true;
                          break;
                        }
                      }
                      
                      // If no gap found, place at the end of the timeline
                      if (!foundGap) {
                        const lastClip = trackClips[trackClips.length - 1];
                        safeStart = lastClip.start + lastClip.duration;
                      }
                    }
                    
                    return { ...newClip, start: safeStart };
                  }
                  
                  return newClip;
                });

                const updatedClips = [...prev.clips, ...adjustedClips];
                const newMaxDuration = calculateMaxDuration(updatedClips);
                console.log('[Timeline.tsx] handleTrackDrop: New max duration calculated:', newMaxDuration, 'from clips:', updatedClips.map(c => ({id: c.id, start: c.start, duration: c.duration })));
                return {
                  ...prev,
                  clips: updatedClips,
                  duration: newMaxDuration
                };
              });
              
              toast({
                title: "Media added",
                description: mediaItem.type.startsWith('video/')
                  ? `${mediaItem.name} added to ${track.label} with audio track at 0s (Duration: ${newClip.duration.toFixed(2)}s)`
                  : `${mediaItem.name} added to ${track.label} at 0s (Duration: ${newClip.duration.toFixed(2)}s)`,
              });
            } catch (error) {
              console.error("Error creating clip from media:", error);
              toast({
                title: "Error adding media",
                description: `Could not process ${mediaItem.name}.`,
                variant: "destructive"
              });
            }
          } else {
            toast({
              title: "Invalid media type",
              description: `Cannot add ${mediaItem.type.split('/')[0]} to ${track.type} track`,
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Error parsing media data in handleTrackDrop:', error, 'Raw jsonData:', jsonData);
        }
      }
    }, 0);
    
    console.log('Drop on track', trackIndex);
  }, [state.zoom, trackConfig, toast]);

  // Handle track activation
  const handleTrackActivate = useCallback((trackIndex: number) => {
    setActiveTrack(trackIndex);
  }, []);

  // Handle timeline drag events for dynamic track insertion (optimized with throttling)
  const handleTimelineDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Check if dragging files
    const hasFiles = e.dataTransfer.types.includes('Files');
    if (hasFiles) {
      setIsDraggingFile(true);
    }
  }, []);

  // Optimized drag over handler with throttling
  const handleTimelineDragOverCore = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    if (!isDraggingFile) return;

    // Capture event data before requestAnimationFrame to avoid stale closure issues
    const currentTarget = e.currentTarget;
    const clientY = e.clientY;
    const dataTransfer = e.dataTransfer;

    // Use requestAnimationFrame for expensive calculations
    requestAnimationFrame(() => {
      if (!currentTarget) return; // Add null check
      
      const rect = currentTarget.getBoundingClientRect();
      const y = clientY - rect.top - 40; // Subtract ruler height
      const trackHeight = 60;
      const marginBetweenSections = 8; // The margin we added between visual and audio tracks
      
      // Calculate which track position we're over
      let trackPosition = Math.floor(y / trackHeight);
      let isInBetween = false;
      
      // Check if we're in the margin area between visual and audio tracks
      const visualTracksEnd = trackConfig.filter(t => t.type === TrackType.VIDEO).length * trackHeight;
      if (y >= visualTracksEnd && y <= visualTracksEnd + marginBetweenSections) {
        isInBetween = true;
        trackPosition = trackConfig.filter(t => t.type === TrackType.VIDEO).length;
      }
      
      // Check if we're between tracks (in the border area)
      const trackOffset = y % trackHeight;
      if (trackOffset <= 5 || trackOffset >= trackHeight - 5) {
        isInBetween = true;
      }
      
      // Determine track type from dragged content
      let trackType = TrackType.VIDEO;
      const files = Array.from(dataTransfer.files);
      if (files.length > 0) {
        trackType = getTrackTypeFromContent(files[0].type);
      } else {
        // Check for media data
        try {
          const jsonData = dataTransfer.getData("application/json");
          if (jsonData) {
            const media = JSON.parse(jsonData);
            if (media.type) {
              trackType = getTrackTypeFromContent(media.type);
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
      
      if (isInBetween && trackPosition >= 0 && trackPosition <= trackConfig.length) {
        const insertPosition = getInsertionPosition(trackType, trackPosition);
        setDragIndicator({
          show: true,
          position: insertPosition,
          trackType: trackType
        });
      } else {
        setDragIndicator({ show: false, position: -1, trackType: TrackType.VIDEO });
      }
    });
  }, [isDraggingFile, trackConfig, getTrackTypeFromContent, getInsertionPosition]);

  // Throttled version of the drag over handler (limit to 60fps)
  const handleTimelineDragOver = useMemo(
    () => throttle(handleTimelineDragOverCore, 16),
    [handleTimelineDragOverCore]
  );

  const handleTimelineDragLeave = useCallback((e: React.DragEvent) => {
    // Only hide indicator if leaving the timeline container entirely
    if (!e.currentTarget) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragIndicator({ show: false, position: -1, trackType: TrackType.VIDEO });
      setIsDraggingFile(false);
    }
  }, []);

  const handleTimelineDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    if (dragIndicator.show && dragIndicator.position >= 0) {
      // Capture event data before setTimeout to avoid stale closure issues
      const dropEvent = {
        dataTransfer: e.dataTransfer,
        clientX: e.clientX,
        clientY: e.clientY,
        currentTarget: e.currentTarget
      };
      
      // Insert new track at the indicated position
      insertTrackAtPosition(dragIndicator.position, dragIndicator.trackType);
      
      // Clear the indicator
      setDragIndicator({ show: false, position: -1, trackType: TrackType.VIDEO });
      
      toast({
        title: "New track created",
        description: `${dragIndicator.trackType === TrackType.AUDIO ? 'Audio' : 'Visual'} track added at position ${dragIndicator.position + 1}`,
      });
      
      // Handle the actual file drop on the new track
      const capturedPosition = dragIndicator.position;
      setTimeout(() => {
        // Create a synthetic event with the captured data
        const syntheticEvent = {
          ...e,
          ...dropEvent,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as React.DragEvent;
        handleTrackDrop(capturedPosition, syntheticEvent);
      }, 100);
    }
  }, [dragIndicator, insertTrackAtPosition, toast, handleTrackDrop]);

  // Playback controls
  const handlePlay = useCallback(() => {
    setState(prev => ({ ...prev, playing: true }));
  }, []);

  const handlePause = useCallback(() => {
    setState(prev => ({ ...prev, playing: false }));
  }, []);

  const handleSeek = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const handleSkipBack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTime: Math.max(0, prev.currentTime - 5)
    }));
  }, []);

  const handleSkipForward = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTime: Math.min(prev.duration, prev.currentTime + 5)
    }));
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    // Use fitZoomLevel as minimum if it exists, otherwise use default minimum of 5
    const effectiveMinZoom = fitZoomLevel !== null ? fitZoomLevel : 5;
    const clampedZoom = Math.max(effectiveMinZoom, Math.min(200, newZoom));
    setState(prev => ({ ...prev, zoom: clampedZoom }));
  }, [fitZoomLevel]);

  // Keep currentTimeRef in sync with state
  useEffect(() => {
    currentTimeRef.current = state.currentTime;
  }, [state.currentTime]);

  // Smooth animation loop for playback
  useEffect(() => {
    let animationId: number;
    let lastTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      
      // Update current time ref smoothly at 60fps
      if (deltaTime >= 16) { // ~60fps for smooth animation
        const timeIncrement = deltaTime / 1000;
        currentTimeRef.current = Math.min(currentTimeRef.current + timeIncrement, state.duration);
        
        // Only update React state every 100ms (10fps) to reduce jitter
        if (timestamp - lastStateUpdateTime.current >= 100) {
          setState(prev => {
            if (!prev.playing) return prev;
            
            if (currentTimeRef.current >= prev.duration) {
              currentTimeRef.current = prev.duration;
              return { ...prev, currentTime: prev.duration, playing: false };
            }

            return { ...prev, currentTime: currentTimeRef.current };
          });
          lastStateUpdateTime.current = timestamp;
        }
        
        lastTime = timestamp;
      }
      
      if (state.playing) {
        animationId = requestAnimationFrame(animate);
      }
    };

    if (state.playing) {
      lastStateUpdateTime.current = performance.now();
      animationId = requestAnimationFrame(animate);
    } else {
      // Sync ref with state when not playing
      currentTimeRef.current = state.currentTime;
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [state.playing, state.duration]);

  // Listen for playback toggle events from the preview component
  useEffect(() => {
    const handleTogglePlayback = () => {
      setState(prev => ({ ...prev, playing: !prev.playing }));
    };
    
    window.addEventListener('timeline-toggle-playback', handleTogglePlayback);
    
    return () => {
      window.removeEventListener('timeline-toggle-playback', handleTogglePlayback);
    };
  }, []);

  // Auto-scroll during playback
  useEffect(() => {
    if (state.playing && timelineRef.current) {
      const scrollContainer = timelineRef.current;
      const containerWidth = scrollContainer.clientWidth;

      if (
        playheadPosition > scrollContainer.scrollLeft + containerWidth - 100 ||
        playheadPosition < scrollContainer.scrollLeft
      ) {
        scrollContainer.scrollLeft = playheadPosition - containerWidth / 2;
      }
    }
  }, [playheadPosition, state.playing]);

  // Calculate timeline height with dynamic tracks and margin
  const timelineHeight = useMemo(() => {
    const baseHeight = trackConfig.length * 60;
    const audioTrackCount = trackConfig.filter(t => t.type === TrackType.AUDIO).length;
    const visualTrackCount = trackConfig.filter(t => t.type === TrackType.VIDEO).length;
    
    // Add margin only if we have both visual and audio tracks
    const marginHeight = (visualTrackCount > 0 && audioTrackCount > 0) ? 8 : 0;
    
    return baseHeight + marginHeight;
  }, [trackConfig]);

  // Separate visual and audio tracks for independent scrolling
  const visualTracks = useMemo(() => {
    return trackConfig
      .map((track, index) => ({ track, originalIndex: index }))
      .filter(({ track }) => track.type === TrackType.VIDEO);
  }, [trackConfig]);

  const audioTracks = useMemo(() => {
    return trackConfig
      .map((track, index) => ({ track, originalIndex: index }))
      .filter(({ track }) => track.type === TrackType.AUDIO);
  }, [trackConfig]);

  // Calculate section heights
  const visualSectionHeight = visualTracks.length * 60;
  const audioSectionHeight = audioTracks.length * 60;
  const maxSectionHeight = 240; // Maximum height before scrolling kicks in

  // Helper function to add a new audio track
  const addNewAudioTrack = useCallback(() => {
    const audioTrackCount = trackConfig.filter(t => t.type === TrackType.AUDIO).length;
    const newTrack = {
      type: TrackType.AUDIO,
      label: `Audio ${audioTrackCount + 1}`
    };

    console.log('🎵 Adding new audio track at TOP of audio section:', {
      audioTrackCount,
      newTrack,
      currentConfig: trackConfig.map((t, i) => `${i}: ${t.label}`)
    });

    setTrackConfig(prev => {
      // Find first audio track position to insert new audio track at the top of audio section
      let firstAudioIndex = prev.findIndex(t => t.type === TrackType.AUDIO);
      if (firstAudioIndex === -1) {
        // No audio tracks exist, add at the end
        firstAudioIndex = prev.length;
      }
      
      const newConfig = [...prev];
      newConfig.splice(firstAudioIndex, 0, newTrack);
      console.log('🎵 New config after insert:', newConfig.map((t, i) => `${i}: ${t.label}`));
      return newConfig;
    });

    toast({
      title: "Audio track added",
      description: `${newTrack.label} has been added to the timeline`,
    });
  }, [trackConfig, toast]);

  // Helper function to add a new visual track
  const addNewVisualTrack = () => {
    const videoCount = trackConfig.filter(t => t.type === TrackType.VIDEO).length;
    
    // Find the position to insert the new visual track (at the BEGINNING of visual tracks for descending order)
    let insertPosition = 0;
    
    const newTrack = { type: TrackType.VIDEO, label: `Visual ${videoCount + 1}` };
    
    console.log('🎬 Adding new visual track at TOP:', {
      videoCount,
      insertPosition,
      newTrack,
      currentConfig: trackConfig.map((t, i) => `${i}: ${t.label}`)
    });
    
    setTrackConfig(prev => {
      const newConfig = [...prev];
      newConfig.splice(insertPosition, 0, newTrack);
      console.log('🎬 New config after insert:', newConfig.map((t, i) => `${i}: ${t.label}`));
      return newConfig;
    });
  };

  // Handle fit to screen functionality
  const handleFitToScreen = useCallback(() => {
    if (containerWidth > 0 && state.duration > 0) {
      // Calculate the zoom level that would fit the entire timeline within the container
      // We subtract 60px for track labels and add some padding (50px) for better visibility
      const availableWidth = containerWidth - 60;
      
      // Use the same calculation as timelineWidth: (duration + 5) * zoom
      // So: zoom = availableWidth / (duration + 5)
      const requiredZoom = availableWidth / (state.duration);
      
      // Clamp the zoom between a very low minimum (5) and max zoom (200) to ensure entire timeline fits
      const clampedZoom = Math.max(5, Math.min(200, requiredZoom));
      
      // Set this as the new minimum zoom level
      setFitZoomLevel(clampedZoom);
      
      setState(prev => ({ ...prev, zoom: clampedZoom }));
      
      // Scroll to the beginning of the timeline after fitting
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = 0;
      }
      
      toast({
        title: "Timeline fitted to screen",
        description: `Zoom locked at ${Math.round(clampedZoom)}% minimum (${state.duration.toFixed(1)}s)`,
      });
    }
  }, [containerWidth, state.duration, toast]);

  // Helper function to remove a track (only if it's empty)
  const removeTrack = useCallback((trackIndex: number) => {
    // Check if track has any clips
    const hasClips = state.clips.some(clip => clip.track === trackIndex);
    
    if (hasClips) {
      toast({
        title: "Cannot remove track",
        description: "Please remove all clips from the track before deleting it",
        variant: "destructive"
      });
      return;
    }

    // Don't allow removing if it would leave no tracks of its type
    const trackToRemove = trackConfig[trackIndex];
    const tracksOfSameType = trackConfig.filter(t => t.type === trackToRemove.type);
    
    if (tracksOfSameType.length <= 1) {
      toast({
        title: "Cannot remove track",
        description: `Must have at least one ${trackToRemove.type === TrackType.AUDIO ? 'audio' : 'visual'} track`,
        variant: "destructive"
      });
      return;
    }

    // Remove the track
    setTrackConfig(prev => prev.filter((_, index) => index !== trackIndex));

    // Update existing clips' track indices that are after the removed track
    setState(prevState => ({
      ...prevState,
      clips: prevState.clips.map(clip => ({
        ...clip,
        track: clip.track > trackIndex ? clip.track - 1 : clip.track
      }))
    }));

    toast({
      title: "Track removed",
      description: `${trackToRemove.label} has been removed from the timeline`,
    });
  }, [state.clips, trackConfig, toast]);

  const handleTogglePlayback = useCallback(() => {
    setState(prev => ({ ...prev, playing: !prev.playing }));
  }, []);

  // Handle gap removal
  const handleRemoveGap = useCallback((trackIndex: number, gapStart: number, gapEnd: number) => {
    setState(prev => {
      const newClips = removeGap(prev.clips, trackIndex, gapStart, gapEnd);
      return {
        ...prev,
        clips: newClips,
        duration: calculateMaxDuration(newClips)
      };
    });

    toast({
      title: "Gap removed",
      description: `Gap of ${formatTime(gapEnd - gapStart)} removed from track`,
    });
  }, [toast]);

  // Helper function to show dropped effect feedback
  const showEffectFeedback = useCallback((gapKey: string, effectName: string) => {
    setDroppedEffects(prev => {
      const newMap = new Map(prev);
      newMap.set(gapKey, { effectName, timestamp: Date.now() });
      return newMap;
    });

    // Clear the feedback after 2 seconds
    setTimeout(() => {
      setDroppedEffects(prev => {
        const newMap = new Map(prev);
        newMap.delete(gapKey);
        return newMap;
      });
    }, 2000);
  }, []);

  // Calculate gaps for display
  const timelineGaps = useMemo(() => {
    return findAllGaps(state.clips);
  }, [state.clips]);

  // Calculate adjacent clips for transition buttons
  const adjacentClips = useMemo(() => {
    return findAdjacentClips(state.clips);
  }, [state.clips]);

  // Sync Timeline currentTime with EditorStore currentTime
  useEffect(() => {
    setEditorCurrentTime(state.currentTime);
  }, [state.currentTime, setEditorCurrentTime]);

  // Handle effect addition to clips
  const handleEffectAdd = useCallback((clipId: string, effectId: string) => {
    setState(prev => {
      const newClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          const effects = clip.effects || [];
          if (!effects.includes(effectId)) {
            return {
              ...clip,
              effects: [...effects, effectId]
            };
          }
        }
        return clip;
      });
      
      return {
        ...prev,
        clips: newClips
      };
    });

    const clip = state.clips.find(c => c.id === clipId);
    if (clip) {
      toast({
        title: "Effect added",
        description: `Effect applied to ${clip.title}`,
      });
    }
  }, [state.clips, toast]);

  // Handle effect removal from clips
  const handleEffectRemove = useCallback((clipId: string, effectId: string) => {
    setState(prev => {
      const newClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          const effects = clip.effects || [];
          return {
            ...clip,
            effects: effects.filter(id => id !== effectId)
          };
        }
        return clip;
      });
      
      return {
        ...prev,
        clips: newClips
      };
    });

    const clip = state.clips.find(c => c.id === clipId);
    if (clip) {
      toast({
        title: "Effect removed",
        description: `Effect removed from ${clip.title}`,
      });
    }
  }, [state.clips, toast]);

  // Improved clip movement handler that properly maps display indices to original track indices
  const handleClipMoveFixed = useCallback((
    clipId: string,
    newStart: number,
    newTrack: number,
    newDuration?: number
  ) => {
    setState(prev => {
      const clipToMove = prev.clips.find(clip => clip.id === clipId);
      if (!clipToMove) return prev;
      
      // Convert display track index back to original track index
      let actualTrackIndex = newTrack;
      
      // Check if this is an audio clip being moved within the audio section
      if (clipToMove.type === 'audio') {
        // Find the original track index from the audio tracks mapping
        const audioTrackAtDisplayIndex = audioTracks[newTrack];
        if (audioTrackAtDisplayIndex) {
          actualTrackIndex = audioTrackAtDisplayIndex.originalIndex;
        }
      } else {
        // For visual clips, find the original track index from visual tracks mapping
        const visualTrackAtDisplayIndex = visualTracks[newTrack];
        if (visualTrackAtDisplayIndex) {
          actualTrackIndex = visualTrackAtDisplayIndex.originalIndex;
        }
      }
      
      // Helper function to check if clip can be moved to track
      const canMoveToTrack = (clipType: string, targetTrackIndex: number) => {
        if (targetTrackIndex < 0 || targetTrackIndex >= trackConfig.length) return false;
        
        const targetTrack = trackConfig[targetTrackIndex];
        
        // Visual tracks can accept video, image, text
        if (targetTrack.type === TrackType.VIDEO) {
          return clipType === 'video' || clipType === 'image' || clipType === 'text';
        }
        // Audio tracks can only accept audio
        else if (targetTrack.type === TrackType.AUDIO) {
          return clipType === 'audio';
        }
        return false;
      };
      
      // Check if the clip can be moved to this track using the actual track index
      if (!canMoveToTrack(clipToMove.type, actualTrackIndex)) {
        const targetTrack = trackConfig[actualTrackIndex];
        const trackName = targetTrack?.type === TrackType.AUDIO ? 'Audio' : 'Visual';
        const allowedTypes = targetTrack?.type === TrackType.AUDIO ? 'audio' : 'images, videos, or text';
        toast({
          title: "Cannot move clip",
          description: `${trackName} tracks only accept ${allowedTypes}`,
          variant: "destructive"
        });
        return prev;
      }

      // Check for overlaps with other clips on the same track
      if (clipToMove) {
        const duration = newDuration !== undefined ? newDuration : clipToMove.duration;
        const clipEnd = newStart + duration;
        
        // Find overlapping clips on the same track
        const overlappingClips = prev.clips.filter(existingClip => {
          if (existingClip.id === clipId) return false; // Skip the clip being moved
          if (existingClip.track !== actualTrackIndex) return false; // Only check clips on the same track
          
          const existingClipEnd = existingClip.start + existingClip.duration;
          // Check if clips overlap: !(clip1End <= clip2Start || clip2End <= clip1Start)
          return !(clipEnd <= existingClip.start || existingClipEnd <= newStart);
        });

        if (overlappingClips.length > 0) {
          // Find the nearest non-overlapping position
          const trackClips = prev.clips
            .filter(clip => clip.id !== clipId && clip.track === actualTrackIndex)
            .sort((a, b) => a.start - b.start);
          
          let adjustedStart = newStart;
          
          if (trackClips.length > 0) {
            // Try to find a gap between clips
            let foundGap = false;
            
            for (let i = 0; i < trackClips.length - 1; i++) {
              const currentClip = trackClips[i];
              const nextClip = trackClips[i + 1];
              const gapStart = currentClip.start + currentClip.duration;
              const gapEnd = nextClip.start;
              const gapSize = gapEnd - gapStart;
              
              if (gapSize >= duration) {
                const positionInGap = Math.max(gapStart, newStart);
                if (positionInGap + duration <= gapEnd) {
                  adjustedStart = positionInGap;
                  foundGap = true;
                  break;
                }
              }
            }
            
            // If no gap found, place at the end of the timeline
            if (!foundGap) {
              const lastClip = trackClips[trackClips.length - 1];
              adjustedStart = lastClip.start + lastClip.duration;
            }
          }
          
          const overlappingTitles = overlappingClips.map(clip => clip.title).join(', ');
          toast({
            title: "Clip repositioned to avoid overlap",
            description: `Moved to ${formatTime(adjustedStart)} to avoid overlapping with: ${overlappingTitles}`,
          });
          
          // Use the adjusted start time instead of the original newStart
          newStart = adjustedStart;
        }
      }

      const newClips = prev.clips.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            start: newStart < 0 ? 0 : newStart,
            track: actualTrackIndex, // Use the actual track index, not the display index
            duration: newDuration !== undefined ? newDuration : clip.duration
          };
        }
        return clip;
      });
      
      // If this is a resize operation and the clip has a linked audio clip (for video clips),
      // update the audio clip duration as well
      if (newDuration !== undefined) {
        const clipToResize = prev.clips.find(clip => clip.id === clipId);
        if (clipToResize?.type === 'video') {
          // Look for the linked audio clip (usually has the same ID with -audio suffix)
          const linkedAudioId = `${clipId}-audio`;
          const audioClipIndex = newClips.findIndex(c => c.id === linkedAudioId);
          
          if (audioClipIndex >= 0) {
            newClips[audioClipIndex] = {
              ...newClips[audioClipIndex],
              duration: newDuration,
              start: newStart < 0 ? 0 : newStart // Also sync the start time
            };
          }
        }
        // Handle the reverse case: if an audio clip is resized, update its linked video clip
        else if (clipToResize?.type === 'audio' && clipToResize.id.endsWith('-audio')) {
          const videoClipId = clipToResize.id.replace('-audio', '');
          const videoClipIndex = newClips.findIndex(c => c.id === videoClipId);
          
          if (videoClipIndex >= 0) {
            newClips[videoClipIndex] = {
              ...newClips[videoClipIndex],
              duration: newDuration,
              start: newStart < 0 ? 0 : newStart // Also sync the start time
            };
          }
        }
      }
      // Handle movement synchronization for linked clips
      else {
        const clipToMove = prev.clips.find(clip => clip.id === clipId);
        if (clipToMove?.type === 'video') {
          // Look for the linked audio clip and move it too
          const linkedAudioId = `${clipId}-audio`;
          const audioClipIndex = newClips.findIndex(c => c.id === linkedAudioId);
          
          if (audioClipIndex >= 0) {
            // Find the corresponding audio track for the moved position
            const audioTrackIndex = trackConfig.findIndex(t => t.type === TrackType.AUDIO);
            if (audioTrackIndex !== -1) {
              newClips[audioClipIndex] = {
                ...newClips[audioClipIndex],
                start: newStart < 0 ? 0 : newStart
              };
            }
          }
        }
        // Handle the reverse case: if an audio clip is moved, update its linked video clip
        else if (clipToMove?.type === 'audio' && clipToMove.id.endsWith('-audio')) {
          const videoClipId = clipToMove.id.replace('-audio', '');
          const videoClipIndex = newClips.findIndex(c => c.id === videoClipId);
          
          if (videoClipIndex >= 0) {
            newClips[videoClipIndex] = {
              ...newClips[videoClipIndex],
              start: newStart < 0 ? 0 : newStart
            };
          }
        }
      }
      
      // Check if any transitions should be removed due to clips no longer being adjacent
      const updatedClipsWithTransitionCheck = newClips.map(clip => {
        if (clip.transition) {
          // Find all clips on the same track
          const trackClips = newClips.filter(c => c.track === clip.track).sort((a, b) => a.start - b.start);
          const clipIndex = trackClips.findIndex(c => c.id === clip.id);
          
          if (clipIndex >= 0 && clipIndex < trackClips.length - 1) {
            const nextClip = trackClips[clipIndex + 1];
            const currentClipEnd = clip.start + clip.duration;
            const gap = nextClip.start - currentClipEnd;
            
            // If there's now a gap between clips, remove the transition
            if (Math.abs(gap) >= 0.01) {
              const transitionType = clip.transition.type;
              return {
                ...clip,
                transition: undefined,
                // Also remove from effects array
                effects: (clip.effects || []).filter(effect => effect !== transitionType)
              };
            }
          } else {
            // If there's no next clip, remove the transition
            const transitionType = clip.transition.type;
            return {
              ...clip,
              transition: undefined,
              // Also remove from effects array
              effects: (clip.effects || []).filter(effect => effect !== transitionType)
            };
          }
        }
        return clip;
      });

      return {
        ...prev,
        clips: updatedClipsWithTransitionCheck,
        duration: calculateMaxDuration(updatedClipsWithTransitionCheck)
      };
    });
  }, [toast, trackConfig, audioTracks, visualTracks]);

  // Sync text clips with text overlays when text overlays change
  useEffect(() => {
    setState(prev => {
      let updatedClips = prev.clips.map(clip => {
        // Only update text clips that are linked to text overlays
        if (clip.type === 'text' && clip.textOverlayId) {
          const sourceOverlay = textOverlays.find((overlay: any) => overlay.id === clip.textOverlayId);
          if (sourceOverlay) {
            // Update clip with latest text overlay data
            const newDuration = Math.max(sourceOverlay.endTime - sourceOverlay.startTime, 1);
            return {
              ...clip,
              title: sourceOverlay.content || "Text Overlay",
              textContent: sourceOverlay.content,
              textStyle: sourceOverlay.style,
              textPosition: sourceOverlay.position,
              visible: sourceOverlay.visible,
              duration: newDuration
            };
          } else {
            // Source text overlay was deleted, mark clip for removal
            return null;
          }
        }
        return clip;
      }).filter(clip => clip !== null) as Clip[]; // Remove clips marked for deletion

      // Check if any clips were actually updated to avoid unnecessary re-renders
      const hasChanges = updatedClips.length !== prev.clips.length || 
        updatedClips.some((clip, index) => {
          const originalClip = prev.clips[index];
          return !originalClip || 
                 clip.title !== originalClip.title ||
                 clip.textContent !== originalClip.textContent ||
                 clip.visible !== originalClip.visible ||
                 clip.duration !== originalClip.duration;
        });

      if (hasChanges) {
        return {
          ...prev,
          clips: updatedClips,
          duration: calculateMaxDuration(updatedClips)
        };
      }

      return prev;
    });
  }, [textOverlays]); // Listen for changes in text overlays

  // Keyboard shortcuts for timeline controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      
      if (isInputField) return;

      // Handle keyboard shortcuts
      switch (e.key) {
        case '=':
        case '+':
          // Zoom In (+ or =)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const newZoomLevel = Math.min(state.zoom + 10, 200);
            handleZoomChange(newZoomLevel);
            toast({
              title: "Zoomed In",
              description: `Zoom level: ${newZoomLevel}%`,
            });
          }
          break;
          
        case '-':
          // Zoom Out (-)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const effectiveMinZoom = fitZoomLevel !== null ? fitZoomLevel : 5;
            const newZoomLevel = Math.max(state.zoom - 10, effectiveMinZoom);
            handleZoomChange(newZoomLevel);
            toast({
              title: "Zoomed Out", 
              description: `Zoom level: ${newZoomLevel}%`,
            });
          }
          break;
          
        case '0':
          // Fit Timeline to Screen (Ctrl/Cmd + 0)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleFitToScreen();
          }
          break;
          
        case 'h':
        case 'H':
          // Toggle Collapse Timeline (H)
          if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            setIsCollapsed(!isCollapsed);
            toast({
              title: isCollapsed ? "Timeline Expanded" : "Timeline Collapsed",
              description: isCollapsed ? "Timeline is now visible" : "Timeline is now hidden",
            });
          }
          break;
          
        case ' ':
          // Spacebar for Play/Pause
          if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            handleTogglePlayback();
          }
          break;
          
        case 'ArrowLeft':
          // Skip back 5 seconds (Left Arrow)
          if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            handleSkipBack();
          }
          break;
          
        case 'ArrowRight':
          // Skip forward 5 seconds (Right Arrow)
          if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
            e.preventDefault();
            handleSkipForward();
          }
          break;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.zoom, isCollapsed, handleZoomChange, handleFitToScreen, handleTogglePlayback, handleSkipBack, handleSkipForward, toast]);

  // Helper function to reset fit zoom level
  const handleResetZoomLock = useCallback(() => {
    setFitZoomLevel(null);
    toast({
      title: "Zoom lock removed",
      description: "You can now zoom out below the fit timeline level",
    });
  }, [toast]);

  return (
    <div className="min-w-full flex flex-col w-full h-full rounded-lg overflow-y-scroll animate-fade-in [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-gray-100 dark:[&::-webkit-scrollbar-track]:bg-neutral-700">
      <div className={`z-10 bg-gray-900 text-white p-4 rounded-t-lg ${isCollapsed ? 'flex-1' : ''}`}>  
        <TimelinePreview 
          clips={state.clips} 
          transitions={state.transitions}
          currentTime={state.currentTime}
          width={isCollapsed ? containerWidth || 800 : previewSize.width}
          height={isCollapsed ? 600 : previewSize.height}
          playing={state.playing}
          onPlayToggle={handleTogglePlayback}
          onClipUpdate={handleClipUpdate}
        />
       </div> 
      <div className="flex justify-between items-center px-4 py-2">
        <div className="font-semibold">Video Timeline Editor</div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={addNewAudioTrack}
            className="flex items-center gap-1 border border-gray-300 px-3 text-sm rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Audio Track
          </Button>
          <Button
            onClick={addNewVisualTrack}
            className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 px-3 text-sm rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Visual Track
          </Button>
          {/* <Button
            onClick={() => {
              // Add text overlay at current time
              const editorStore = useEditorStore.getState();
              editorStore.addTextOverlay();
              toast({
                title: "Text overlay added",
                description: "A new text overlay has been added to the timeline",
              });
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Text
          </Button> */}
          <SimpleVideoExporter
            clips={state.clips}
            transitions={state.transitions}
            duration={state.duration}
          />
          
          <div className="flex border-1 border-accent rounded-md py-0">
            <ZoomControls
              zoom={state.zoom}
              onZoomChange={handleZoomChange}
              minZoom={fitZoomLevel !== null ? fitZoomLevel : 5}
              maxZoom={200}
            />
            <FitTimelineControls
              onFitToScreen={handleFitToScreen}
            />
            {/* {fitZoomLevel !== null && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-gray-800 text-xs px-2"
                onClick={handleResetZoomLock}
                title="Remove zoom lock (allows zooming out below fit level)"
              >
                🔓
              </Button>
            )} */}
            <CollapseControl
              isCollapsed={isCollapsed}
              setIsCollapsed={setIsCollapsed}
            />
          </div>
        </div>
      </div>

      
      <div className={`flex-1 flex flex-col ${isCollapsed ? 'hidden' : ''}`}>
        <div ref={containerRef} className="flex-1 relative">
          <div
            ref={timelineRef}
            className="w-full h-full overflow-auto relative [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-200 dark:[&::-webkit-scrollbar-track]:bg-gray-700 [&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500 dark:[&::-webkit-scrollbar-thumb]:hover:bg-gray-400"
            onClick={handleTimelineClick}
            onDragEnter={handleTimelineDragEnter}
            onDragOver={handleTimelineDragOver}
            onDragLeave={handleTimelineDragLeave}
            onDrop={handleTimelineDrop}
          >
            <div
              className="relative"
              style={{ 
                width: `${timelineWidth + 60}px`, 
                minHeight: `${40 + Math.min(visualSectionHeight, maxSectionHeight) + Math.min(audioSectionHeight, maxSectionHeight)}px` 
              }}
            >
              <div className="ml-[60px]">
                <TimelineRuler
                  duration={state.duration}
                  zoom={state.zoom}
                  timelineWidth={timelineWidth}
                />
              </div>

              {/* Tracks Container - positioned below ruler */}
              <div className="relative">
                {/* Visual Tracks Section */}
                {visualTracks.length > 0 && (
                  <div className="relative">
                    <div 
                      className="overflow-y-auto [&::-webkit-scrollbar]:w-1.5  [&::-webkit-scrollbar-track]:bg-gray-200 dark:[&::-webkit-scrollbar-track]:bg-gray-700 [&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500 dark:[&::-webkit-scrollbar-thumb]:hover:bg-gray-400 overflow-x-visible border-b-2 border-gray-500"
                      style={{ 
                        maxHeight: `${Math.min(visualSectionHeight, maxSectionHeight)}px`,
                        height: visualSectionHeight <= maxSectionHeight ? 'auto' : `${visualSectionHeight}px`
                      }}
                    >
                      <div className="relative">
                        {visualTracks.map(({ track, originalIndex }, visualIndex) => {
                          const hasClips = state.clips.some(clip => clip.track === originalIndex);
                          const tracksOfSameType = trackConfig.filter(t => t.type === track.type);
                          const canRemove = !hasClips && tracksOfSameType.length > 1;
                          
                          return (
                  <TimelineTrack
                              key={originalIndex}
                              index={originalIndex}
                              trackType={track.type}
                              label={track.label}
                    onDragOver={handleTrackDragOver}
                              onDrop={(e) => handleTrackDrop(originalIndex, e)}
                              onRemove={removeTrack}
                              isActive={activeTrack === originalIndex}
                              canRemove={canRemove}
                              className=""
                            />
                          );
                        })}
                        
                        {/* Visual Track Clips */}
                        <div className="absolute top-0 left-[60px]">
                          {state.clips
                            .filter(clip => {
                              const track = trackConfig[clip.track];
                              return track?.type === TrackType.VIDEO;
                            })
                            .map(clip => {
                              const visualTrackIndex = visualTracks.findIndex(({ originalIndex }) => originalIndex === clip.track);
                              return (
                                <TimelineClip
                                  key={clip.id}
                                  clip={{...clip, track: visualTrackIndex}}
                                  zoom={state.zoom}
                                  onClipMove={handleClipMoveFixed}
                                  onClipSelect={handleClipSelect}
                                  onClipDelete={handleClipDelete}
                                  onClipSplit={handleClipSplit}
                                  onClipDuplicate={handleClipDuplicate}
                                  onClipCopy={handleClipCopy}
                                  onClipPaste={handleClipPaste}
                                  onClipMute={handleClipMute}
                                  isSelected={clip.id === selectedClipId}
                                  canPaste={!!copiedClip}
                                  onEffectAdd={handleEffectAdd}
                                  onEffectRemove={handleEffectRemove}
                                />
                              );
                            })}
                            
                          {/* Visual Transition Strips - Show actual transition effects as visual bars */}
                          {state.transitions?.filter(transition => {
                            // Only show visual transitions (not audio)
                            const fromClip = state.clips.find(c => c.id === transition.fromClipId);
                            const toClip = state.clips.find(c => c.id === transition.toClipId);
                            return fromClip && toClip && (fromClip.type === 'video' || fromClip.type === 'image');
                          }).map(transition => {
                            const fromClip = state.clips.find(c => c.id === transition.fromClipId);
                            const toClip = state.clips.find(c => c.id === transition.toClipId);
                            
                            if (!fromClip || !toClip) return null;
                            
                            const visualTrackIndex = visualTracks.findIndex(({ originalIndex }) => originalIndex === fromClip.track);
                            if (visualTrackIndex === -1) return null;
                            
                            const transitionStart = transition.startTime * state.zoom;
                            const transitionWidth = transition.duration * state.zoom;
                            
                            // Position the transition button at the boundary between clips
                            const fromClipEnd = (fromClip.start + fromClip.duration) * state.zoom;
                            const buttonPosition = fromClipEnd - 12; // Center the 24px button on the clip boundary
                            
                            return (
                              <div
                                key={transition.id}
                                className="absolute flex items-center justify-center cursor-pointer hover:scale-110 transition-transform group w-8 h-8"
                                style={{
                                  left: `${buttonPosition - 5}px`,
                                  top: `${visualTrackIndex * 60 + 12}px`, // Center vertically in the 60px track (18px from top)
                                  zIndex: 15
                                }}
                                title={`Transition: ${transition.settings?.effectType || transition.type} (${transition.duration.toFixed(1)}s)`}
                                onClick={() => {
                                  // Select transition for editing
                                  console.log('Transition clicked:', transition);
                                }}
                              >
                                {/* Main transition button */}
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center relative">
                                  <ShipWheel className="w-4 h-4 text-white"/>
                                  
                                  {/* Progress indicator during playback */}
                                  {state.currentTime >= transition.startTime && 
                                   state.currentTime <= transition.startTime + transition.duration && (
                                    <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-pulse" />
                                  )}
                                </div>
                                
                                {/* Tooltip on hover */}
                                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                                  {transition.settings?.effectName || transition.type} ({transition.duration.toFixed(1)}s)
                                </div>
                                
                                {/* Delete button on hover */}
                                <button
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Remove transition
                                    setState(prev => ({
                                      ...prev,
                                      transitions: prev.transitions?.filter(t => t.id !== transition.id) || []
                                    }));
                                    toast({
                                      title: "Transition removed",
                                      description: `Transition effect between clips has been removed`,
                                    });
                                  }}
                                  title="Remove transition"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                            
                          {/* Adjacent Clip Indicators - Show thin lines when clips touch (0 gap) */}
                          {visualTracks.map(({ originalIndex }) => {
                            const trackClips = state.clips
                              .filter(clip => clip.track === originalIndex)
                              .sort((a, b) => a.start - b.start);
                            
                            return trackClips.map((clip, clipIndex) => {
                              if (clipIndex === trackClips.length - 1) return null; // No indicator after last clip
                              
                              const currentClip = trackClips[clipIndex];
                              const nextClip = trackClips[clipIndex + 1];
                              const visualTrackIndex = visualTracks.findIndex(({ originalIndex: tIdx }) => tIdx === originalIndex);
                              
                              const gapBetweenClips = nextClip.start - (currentClip.start + currentClip.duration);
                              
                                                             // Only show indicator when clips are directly adjacent (0 gap)
                               if (Math.abs(gapBetweenClips) < 0.01) { // Allow tiny tolerance for floating point precision
                                 const boundaryPosition = (currentClip.start + currentClip.duration) * state.zoom;
                                 const buttonKey = `visual-${currentClip.id}-${nextClip.id}`;
                                 
                                 // Check if there's already a transition between these clips
                                 const hasTransition = state.transitions?.some(transition => 
                                   (transition.fromClipId === currentClip.id && transition.toClipId === nextClip.id) ||
                                   (transition.fromClipId === nextClip.id && transition.toClipId === currentClip.id)
                                 );
                                 
                                 // Only show the thin indicator if there's no transition effect AND no transition button is active
                                 if (!hasTransition && !adjacentTransitionButtons.has(buttonKey)) {
                                  return (
                                    <div
                                      key={`adjacent-indicator-${currentClip.id}-${nextClip.id}`}
                                      className="absolute bg-gray-300 hover:bg-blue-400 cursor-pointer transition-colors duration-200 group"
                                      style={{
                                        left: `${boundaryPosition - 1}px`, // 2px wide line centered on boundary
                                        width: '5px',
                                        height: '20px', // Thin line at top of track
                                        top: `${visualTrackIndex * 60 + 15}px`, // Top of the track
                                        zIndex: 12
                                      }}
                                      title={`Adjacent clips - Drop effects here to create transitions`}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            e.dataTransfer.dropEffect = "copy";
                                            e.currentTarget.style.backgroundColor = '#3b82f6'; // Blue on drag over
                                          }
                                        } catch (error) {}
                                      }}
                                      onDragLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '';
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.style.backgroundColor = '';
                                        
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            console.log(`[Timeline.tsx] 🎯 ADJACENT CLIPS TRANSITION: Applying ${data.name} between "${currentClip.title}" and "${nextClip.title}"`);
                                            
                                            // Show effect feedback
                                            const gapKey = `adjacent-visual-${currentClip.id}-${nextClip.id}`;
                                            showEffectFeedback(gapKey, data.name);
                                            
                                            // Create transition effect with default 2.5s duration
                                            const transitionDuration = 2.5;
                                            const overlapPerSide = transitionDuration / 2;
                                            const transitionStart = (currentClip.start + currentClip.duration) - overlapPerSide;
                                            
                                            const transitionEffect = {
                                              id: `adjacent-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                              type: data.id as any, // Use the actual effect type
                                              duration: transitionDuration,
                                              fromClipId: currentClip.id,
                                              toClipId: nextClip.id,
                                              startTime: transitionStart,
                                              settings: {
                                                effectType: data.id,
                                                effectName: data.name,
                                                intensity: 1.0,
                                                easing: 'ease-in-out' as const,
                                                overlapPerSide: overlapPerSide
                                              }
                                            };

                                            setState(prev => ({
                                              ...prev,
                                              transitions: [...(prev.transitions || []), transitionEffect]
                                            }));
                                            
                                            toast({
                                              title: "Transition effect created",
                                              description: `${data.name} effect applied between adjacent clips "${currentClip.title}" and "${nextClip.title}"`,
                                            });
                                          }
                                        } catch (error) {
                                          console.error('Error handling adjacent clips transition effect drop:', error);
                                        }
                                      }}
                                                                         >
                                       {/* Small hover indicator */}
                                       <div 
                                         className="absolute -top-2 -left-3 w-8 h-8 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer hover:bg-blue-600"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           const buttonKey = `visual-${currentClip.id}-${nextClip.id}`;
                                           setAdjacentTransitionButtons(prev => {
                                             const newSet = new Set(prev);
                                             if (newSet.has(buttonKey)) {
                                               newSet.delete(buttonKey);
                                             } else {
                                               newSet.add(buttonKey);
                                             }
                                             return newSet;
                                           });
                                         }}
                                         title="Click to show/hide transition options"
                                       >
                                         <Plus className="w-4 h-4 text-white"/>
                                       </div>
                                     </div>
                                  );
                                }
                              }
                              
                                                             return null;
                             }).filter(Boolean);
                           })}
                           
                          {/* Adjacent Clip Transition Buttons - Show when plus button is clicked */}
                          {visualTracks.map(({ originalIndex }) => {
                            const trackClips = state.clips
                              .filter(clip => clip.track === originalIndex)
                              .sort((a, b) => a.start - b.start);
                            
                            return trackClips.map((clip, clipIndex) => {
                              if (clipIndex === trackClips.length - 1) return null; // No button after last clip
                              
                              const currentClip = trackClips[clipIndex];
                              const nextClip = trackClips[clipIndex + 1];
                              const visualTrackIndex = visualTracks.findIndex(({ originalIndex: tIdx }) => tIdx === originalIndex);
                              
                              const gapBetweenClips = nextClip.start - (currentClip.start + currentClip.duration);
                              const buttonKey = `visual-${currentClip.id}-${nextClip.id}`;
                              
                              // Only show transition button when clips are adjacent AND the plus button was clicked
                              if (Math.abs(gapBetweenClips) < 0.01 && adjacentTransitionButtons.has(buttonKey)) {
                                const boundaryPosition = (currentClip.start + currentClip.duration) * state.zoom;
                                
                                // Check if there's already a transition between these clips
                                const hasTransition = state.transitions?.some(transition => 
                                  (transition.fromClipId === currentClip.id && transition.toClipId === nextClip.id) ||
                                  (transition.fromClipId === nextClip.id && transition.toClipId === currentClip.id)
                                );
                                
                                if (!hasTransition) {
                                  return (
                                    <div
                                      key={`adjacent-transition-btn-${currentClip.id}-${nextClip.id}`}
                                      className="absolute bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-full cursor-pointer shadow-lg flex items-center justify-center transition-colors duration-200 border-2 border-white w-8 h-8"
                                      style={{
                                        left: `${boundaryPosition - 15}px`, // 30px wide button centered on boundary
                                        top: `${visualTrackIndex * 60 + 12}px`, // Position below the thin line
                                        zIndex: 16
                                      }}
                                      title={`Add transition between "${currentClip.title}" and "${nextClip.title}"`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Create default transition effect
                                        const transitionDuration = 2.5;
                                        const overlapPerSide = transitionDuration / 2;
                                        const transitionStart = (currentClip.start + currentClip.duration) - overlapPerSide;
                                        
                                        const transitionEffect = {
                                          id: `manual-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                          type: 'crossfade' as any, // Keep crossfade for manual clicks (no effect dropped)
                                          duration: transitionDuration,
                                          fromClipId: currentClip.id,
                                          toClipId: nextClip.id,
                                          startTime: transitionStart,
                                          settings: {
                                            effectType: 'crossfade',
                                            effectName: 'Crossfade',
                                            intensity: 1.0,
                                            easing: 'ease-in-out' as const,
                                            overlapPerSide: overlapPerSide
                                          }
                                        };

                                        setState(prev => ({
                                          ...prev,
                                          transitions: [...(prev.transitions || []), transitionEffect]
                                        }));
                                        
                                        // Hide the transition button after creating transition
                                        setAdjacentTransitionButtons(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(buttonKey);
                                          return newSet;
                                        });
                                        
                                        toast({
                                          title: "Transition created",
                                          description: `Crossfade transition added between "${currentClip.title}" and "${nextClip.title}"`,
                                        });
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            e.dataTransfer.dropEffect = "copy";
                                            e.currentTarget.style.backgroundColor = '#1d4ed8'; // Darker blue on drag over
                                          }
                                        } catch (error) {}
                                      }}
                                      onDragLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '';
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.style.backgroundColor = '';
                                        
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            // Create transition effect with custom effect
                                            const transitionDuration = 2.5;
                                            const overlapPerSide = transitionDuration / 2;
                                            const transitionStart = (currentClip.start + currentClip.duration) - overlapPerSide;
                                            
                                            const transitionEffect = {
                                              id: `custom-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                              type: data.id as any, // Use the actual effect type
                                              duration: transitionDuration,
                                              fromClipId: currentClip.id,
                                              toClipId: nextClip.id,
                                              startTime: transitionStart,
                                              settings: {
                                                effectType: data.id,
                                                effectName: data.name,
                                                intensity: 1.0,
                                                easing: 'ease-in-out' as const,
                                                overlapPerSide: overlapPerSide
                                              }
                                            };

                                            setState(prev => ({
                                              ...prev,
                                              transitions: [...(prev.transitions || []), transitionEffect]
                                            }));
                                            
                                            // Hide the transition button after creating transition
                                            setAdjacentTransitionButtons(prev => {
                                              const newSet = new Set(prev);
                                              newSet.delete(buttonKey);
                                              return newSet;
                                            });
                                            
                                            toast({
                                              title: "Custom transition created",
                                              description: `${data.name} transition added between "${currentClip.title}" and "${nextClip.title}"`,
                                            });
                                          }
                                        } catch (error) {
                                          console.error('Error handling transition button effect drop:', error);
                                        }
                                      }}
                                    >
                                       <Component className="w-4 h-4" />
                                      </div>
                                  );
                                }
                              }
                              
                              return null;
                            }).filter(Boolean);
                          })}
                           
                          {/* Visual Gap Zones with Remove Gap and Transition functionality */}
                          {visualTracks.map(({ originalIndex }) => {
                            const trackClips = state.clips
                              .filter(clip => clip.track === originalIndex)
                              .sort((a, b) => a.start - b.start);
                            
                            return trackClips.map((clip, clipIndex) => {
                              if (clipIndex === trackClips.length - 1) return null; // No gap after last clip
                              
                              const currentClip = trackClips[clipIndex];
                              const nextClip = trackClips[clipIndex + 1];
                              const visualTrackIndex = visualTracks.findIndex(({ originalIndex: tIdx }) => tIdx === originalIndex);
                              
                              const gapStart = currentClip.start + currentClip.duration;
                              const gapEnd = nextClip.start;
                              const gapBetweenClips = gapEnd - gapStart;
                              
                              // Only show gap zone if there's actually a gap between clips
                              if (Math.abs(gapBetweenClips) < 0.01) return null; // Skip if clips are adjacent
                              
                              const transitionStart = gapStart * state.zoom;
                              const transitionEnd = gapEnd * state.zoom;
                              const transitionWidth = Math.max(transitionEnd - transitionStart, 16); // Minimum 16px width
                              
                              return (
                                <div
                                  key={`visual-gap-${currentClip.id}-${nextClip.id}`}
                                  className="absolute bg-transparent hover:bg-grey-400/20 border border-transparent hover:border-grey-400 hover:border-dashed rounded cursor-pointer transition-all duration-200 group relative"
                                  style={{
                                    left: `${transitionStart}px`,
                                    width: `${transitionWidth}px`,
                                    height: '50px',
                                    top: `${visualTrackIndex * 60}px`,
                                    zIndex: 5
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255, 255, 255, 0.1) 4px, rgba(255, 255, 255, 0.1) 8px)';
                                    e.currentTarget.style.backgroundSize = '8px 8px';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundImage = '';
                                    e.currentTarget.style.backgroundSize = '';
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Remove gap functionality
                                    handleRemoveGap(originalIndex, gapStart, gapEnd);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                      if (data.type === "effect") {
                                        e.dataTransfer.dropEffect = "copy";
                                        e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.3)';
                                        e.currentTarget.style.borderColor = '#06b6d4';
                                      }
                                    } catch (error) {}
                                  }}
                                  onDragLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'transparent';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    
                                                                          try {
                                      const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                      if (data.type === "effect") {
                                        console.log(`[Timeline.tsx] 🎯 VISUAL TRANSITION ZONE DROP: Applying ${data.name} between "${currentClip.title}" and "${nextClip.title}"`);
                                        
                                        // Show effect feedback
                                        const gapKey = `visual-gap-${currentClip.id}-${nextClip.id}`;
                                        showEffectFeedback(gapKey, data.name);
                                        
                                        // Create overlapping transition effect (max 5 seconds, split equally)
                                        const maxTransitionDuration = 5.0; // Maximum 5 seconds
                                        const gapDuration = gapEnd - gapStart;
                                        
                                        // Calculate transition duration and overlap
                                        let transitionDuration = Math.min(maxTransitionDuration, Math.max(gapDuration + 1.0, 1.0));
                                        const overlapPerSide = transitionDuration / 2; // 2.5s each side for 5s total
                                        
                                        // Transition starts before the gap (extends first clip) and ends after gap starts (overlaps second clip)
                                        const transitionStartTime = gapStart - overlapPerSide; // Start 2.5s before first clip ends
                                        
                                        console.log(`[Timeline.tsx] 🎬 Creating visual overlapping transition:`, {
                                          currentClip: currentClip.id,
                                          nextClip: nextClip.id,
                                          gapStart: gapStart.toFixed(2),
                                          gapEnd: gapEnd.toFixed(2),
                                          gapDuration: gapDuration.toFixed(2),
                                          transitionStart: transitionStartTime.toFixed(2),
                                          transitionDuration: transitionDuration.toFixed(2),
                                          overlapPerSide: overlapPerSide.toFixed(2),
                                          effect: data.id
                                        });

                                        // Create overlapping transition effect
                                        const transitionEffect = {
                                          id: `visual-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                          type: data.id as any, // Use the actual effect type
                                          duration: transitionDuration,
                                          fromClipId: currentClip.id,
                                          toClipId: nextClip.id,
                                          startTime: transitionStartTime,
                                          settings: {
                                            effectType: data.id,
                                            effectName: data.name,
                                            intensity: 1.0,
                                            easing: 'ease-in-out' as const,
                                            overlapPerSide: overlapPerSide
                                          }
                                        };

                                        setState(prev => ({
                                          ...prev,
                                          transitions: [...(prev.transitions || []), transitionEffect]
                                        }));
                                        
                                        toast({
                                          title: "Transition effect created",
                                          description: `${data.name} effect applied to create transition between "${currentClip.title}" and "${nextClip.title}"`,
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error handling visual transition effect drop:', error);
                                    }
                                  }}
                                  title={`Click to remove gap (${formatTime(gapBetweenClips)}) or drop effects to create transitions`}
                                >
                                  {/* Gap removal icon - visible on hover */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <div className="duration-200">
                                      <Trash2 className="w-4 h-4"/>
                                    </div>
                                  </div>
                                  
                                  {/* Effect feedback indicator */}
                                  {(() => {
                                    const gapKey = `visual-gap-${currentClip.id}-${nextClip.id}`;
                                    const effectFeedback = droppedEffects.get(gapKey);
                                    if (effectFeedback) {
                                      return (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full shadow-lg animate-pulse z-20 border-2 border-white">
                                          ✨ {effectFeedback.effectName}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                  
                                  {/* Gap duration indicator */}
                                  {/* <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-6 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                                    Gap: {formatTime(gapBetweenClips)}
                                  </div> */}
                                </div>
                              );
                            }).filter(Boolean);
                          })}
              </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Tracks Section */}
                {audioTracks.length > 0 && (
                  <div className="relative">
                    <div 
                      className="overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-gray-200 dark:[&::-webkit-scrollbar-track]:bg-gray-700 [&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-500 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500 dark:[&::-webkit-scrollbar-thumb]:hover:bg-gray-400 overflow-x-visible"
                      style={{ 
                        maxHeight: `${Math.min(audioSectionHeight, maxSectionHeight)}px`,
                        height: audioSectionHeight <= maxSectionHeight ? 'auto' : `${audioSectionHeight}px`
                      }}
                    >
                      <div className="relative">
                        {audioTracks.map(({ track, originalIndex }, audioIndex) => {
                          const hasClips = state.clips.some(clip => clip.track === originalIndex);
                          const tracksOfSameType = trackConfig.filter(t => t.type === track.type);
                          const canRemove = !hasClips && tracksOfSameType.length > 1;
                          
                          return (
                            <TimelineTrack
                              key={originalIndex}
                              index={originalIndex}
                              trackType={track.type}
                              label={track.label}
                              onDragOver={handleTrackDragOver}
                              onDrop={(e) => handleTrackDrop(originalIndex, e)}
                              onRemove={removeTrack}
                              isActive={activeTrack === originalIndex}
                              canRemove={canRemove}
                              className=""
                            />
                          );
                        })}
                        
                        {/* Audio Track Clips */}
                        <div className="absolute top-0 left-[60px]">
                          {state.clips
                            .filter(clip => {
                              const track = trackConfig[clip.track];
                              return track?.type === TrackType.AUDIO;
                            })
                            .map(clip => {
                              // Find the correct audio track index in the audio section
                              const audioTrackIndex = audioTracks.findIndex(({ originalIndex }) => originalIndex === clip.track);
                              
                              // If audioTrackIndex is -1, it means the clip's track was not found
                              // This shouldn't happen, but let's handle it gracefully
                              const displayTrackIndex = audioTrackIndex >= 0 ? audioTrackIndex : 0;
                              
                              return (
                                <TimelineClip
                                  key={clip.id}
                                  clip={{...clip, track: displayTrackIndex}}
                                  zoom={state.zoom}
                                  onClipMove={handleClipMoveFixed}
                                  onClipSelect={handleClipSelect}
                                  onClipDelete={handleClipDelete}
                                  onClipSplit={handleClipSplit}
                                  onClipDuplicate={handleClipDuplicate}
                                  onClipCopy={handleClipCopy}
                                  onClipPaste={handleClipPaste}
                                  onClipMute={handleClipMute}
                                  isSelected={clip.id === selectedClipId}
                                  canPaste={!!copiedClip}
                                  onEffectAdd={handleEffectAdd}
                                  onEffectRemove={handleEffectRemove}
                                />
                              );
                            })}
                            
                          {/* Audio Transition Strips - Show actual transition effects as visual bars */}
                          {state.transitions?.filter(transition => {
                            // Only show audio transitions
                            const fromClip = state.clips.find(c => c.id === transition.fromClipId);
                            const toClip = state.clips.find(c => c.id === transition.toClipId);
                            return fromClip && toClip && fromClip.type === 'audio';
                          }).map(transition => {
                            const fromClip = state.clips.find(c => c.id === transition.fromClipId);
                            const toClip = state.clips.find(c => c.id === transition.toClipId);
                            
                            if (!fromClip || !toClip) return null;
                            
                            const audioTrackIndex = audioTracks.findIndex(({ originalIndex }) => originalIndex === fromClip.track);
                            if (audioTrackIndex === -1) return null;
                            
                            const transitionStart = transition.startTime * state.zoom;
                            const transitionWidth = transition.duration * state.zoom;
                            
                            // Position the transition button at the boundary between clips
                            const fromClipEnd = (fromClip.start + fromClip.duration) * state.zoom;
                            const buttonPosition = fromClipEnd - 12; // Center the 24px button on the clip boundary
                            
                            return (
                              <div
                                key={transition.id}
                                className="absolute flex items-center justify-center cursor-pointer hover:scale-110 transition-transform group"
                                style={{
                                  left: `${buttonPosition}px`,
                                  width: '24px',
                                  height: '24px',
                                  top: `${audioTrackIndex * 60 + 18}px`, // Center vertically in the 60px track (18px from top)
                                  zIndex: 15
                                }}
                                title={`Audio Transition: ${transition.settings?.effectType || transition.type} (${transition.duration.toFixed(1)}s)`}
                                onClick={() => {
                                  // Select transition for editing
                                  console.log('Audio transition clicked:', transition);
                                }}
                              >
                                {/* Main transition button */}
                                <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center relative">
                                  <span className="text-white text-xs font-bold">🎵</span>
                                  
                                  {/* Progress indicator during playback */}
                                  {state.currentTime >= transition.startTime && 
                                   state.currentTime <= transition.startTime + transition.duration && (
                                    <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-pulse" />
                                  )}
                                </div>
                                
                                {/* Tooltip on hover */}
                                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                                  Audio: {transition.settings?.effectName || transition.type} ({transition.duration.toFixed(1)}s)
                                </div>
                                
                                {/* Delete button on hover */}
                                <button
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Remove transition
                                    setState(prev => ({
                                      ...prev,
                                      transitions: prev.transitions?.filter(t => t.id !== transition.id) || []
                                    }));
                                    toast({
                                      title: "Audio transition removed",
                                      description: `Audio transition effect between clips has been removed`,
                                    });
                                  }}
                                  title="Remove audio transition"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                            
                          {/* Adjacent Audio Clip Indicators - Show thin lines when clips touch (0 gap) */}
                          {audioTracks.map(({ originalIndex }) => {
                            const trackClips = state.clips
                              .filter(clip => clip.track === originalIndex)
                              .sort((a, b) => a.start - b.start);
                            
                            return trackClips.map((clip, clipIndex) => {
                              if (clipIndex === trackClips.length - 1) return null; // No indicator after last clip
                              
                              const currentClip = trackClips[clipIndex];
                              const nextClip = trackClips[clipIndex + 1];
                              const audioTrackIndex = audioTracks.findIndex(({ originalIndex: tIdx }) => tIdx === originalIndex);
                              
                              const gapBetweenClips = nextClip.start - (currentClip.start + currentClip.duration);
                              
                                                             // Only show indicator when clips are directly adjacent (0 gap)
                               if (Math.abs(gapBetweenClips) < 0.01) { // Allow tiny tolerance for floating point precision
                                 const boundaryPosition = (currentClip.start + currentClip.duration) * state.zoom;
                                 const buttonKey = `audio-${currentClip.id}-${nextClip.id}`;
                                 
                                 // Check if there's already a transition between these clips
                                 const hasTransition = state.transitions?.some(transition => 
                                   (transition.fromClipId === currentClip.id && transition.toClipId === nextClip.id) ||
                                   (transition.fromClipId === nextClip.id && transition.toClipId === currentClip.id)
                                 );
                                 
                                 // Only show the thin indicator if there's no transition effect AND no transition button is active
                                 if (!hasTransition && !adjacentTransitionButtons.has(buttonKey)) {
                                  return (
                                    <div
                                      key={`adjacent-audio-indicator-${currentClip.id}-${nextClip.id}`}
                                      className="absolute bg-gray-300 hover:bg-green-400 cursor-pointer transition-colors duration-200 group"
                                      style={{
                                        left: `${boundaryPosition - 1}px`, // 2px wide line centered on boundary
                                        width: '2px',
                                        height: '20px', // Thin line at top of track
                                        top: `${audioTrackIndex * 60 + 5}px`, // Top of the track
                                        zIndex: 12
                                      }}
                                      title={`Adjacent audio clips - Drop effects here to create transitions`}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            e.dataTransfer.dropEffect = "copy";
                                            e.currentTarget.style.backgroundColor = '#22c55e'; // Green on drag over
                                          }
                                        } catch (error) {}
                                      }}
                                      onDragLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '';
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.style.backgroundColor = '';
                                        
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            console.log(`[Timeline.tsx] 🎯 ADJACENT AUDIO CLIPS TRANSITION: Applying ${data.name} between "${currentClip.title}" and "${nextClip.title}"`);
                                            
                                            // Show effect feedback
                                            const gapKey = `adjacent-audio-${currentClip.id}-${nextClip.id}`;
                                            showEffectFeedback(gapKey, data.name);
                                            
                                            // Create transition effect with default 2.5s duration
                                            const transitionDuration = 2.5;
                                            const overlapPerSide = transitionDuration / 2;
                                            const transitionStart = (currentClip.start + currentClip.duration) - overlapPerSide;
                                            
                                            const transitionEffect = {
                                              id: `adjacent-audio-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                              type: 'crossfade' as const,
                                              duration: transitionDuration,
                                              fromClipId: currentClip.id,
                                              toClipId: nextClip.id,
                                              startTime: transitionStart,
                                              settings: {
                                                effectType: data.id,
                                                effectName: data.name,
                                                intensity: 1.0,
                                                easing: 'ease-in-out' as const,
                                                overlapPerSide: overlapPerSide
                                              }
                                            };

                                            setState(prev => ({
                                              ...prev,
                                              transitions: [...(prev.transitions || []), transitionEffect]
                                            }));
                                            
                                            toast({
                                              title: "Audio transition effect created",
                                              description: `${data.name} effect applied between adjacent audio clips "${currentClip.title}" and "${nextClip.title}"`,
                                            });
                                          }
                                        } catch (error) {
                                          console.error('Error handling adjacent audio clips transition effect drop:', error);
                                        }
                                      }}
                                    >
                                                                             {/* Small hover indicator */}
                                       <div 
                                         className="absolute -top-1 -left-1 w-4 h-4 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer hover:bg-green-600"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           const buttonKey = `audio-${currentClip.id}-${nextClip.id}`;
                                           setAdjacentTransitionButtons(prev => {
                                             const newSet = new Set(prev);
                                             if (newSet.has(buttonKey)) {
                                               newSet.delete(buttonKey);
                                             } else {
                                               newSet.add(buttonKey);
                                             }
                                             return newSet;
                                           });
                                         }}
                                         title="Click to show/hide transition options"
                                       >
                                         <Plus className="w-4 h-4 text-white" />
                                       </div>
                                     </div>
                                  );
                                }
                              }
                              
                                                             return null;
                             }).filter(Boolean);
                           })}
                           
                          {/* Adjacent Audio Clip Transition Buttons - Show when plus button is clicked */}
                          {audioTracks.map(({ originalIndex }) => {
                            const trackClips = state.clips
                              .filter(clip => clip.track === originalIndex)
                              .sort((a, b) => a.start - b.start);
                            
                            return trackClips.map((clip, clipIndex) => {
                              if (clipIndex === trackClips.length - 1) return null; // No button after last clip
                              
                              const currentClip = trackClips[clipIndex];
                              const nextClip = trackClips[clipIndex + 1];
                              const audioTrackIndex = audioTracks.findIndex(({ originalIndex: tIdx }) => tIdx === originalIndex);
                              
                              const gapBetweenClips = nextClip.start - (currentClip.start + currentClip.duration);
                              const buttonKey = `audio-${currentClip.id}-${nextClip.id}`;
                              
                              // Only show transition button when clips are adjacent AND the plus button was clicked
                              if (Math.abs(gapBetweenClips) < 0.01 && adjacentTransitionButtons.has(buttonKey)) {
                                const boundaryPosition = (currentClip.start + currentClip.duration) * state.zoom;
                                
                                // Check if there's already a transition between these clips
                                const hasTransition = state.transitions?.some(transition => 
                                  (transition.fromClipId === currentClip.id && transition.toClipId === nextClip.id) ||
                                  (transition.fromClipId === nextClip.id && transition.toClipId === currentClip.id)
                                );
                                
                                if (!hasTransition) {
                                  return (
                                    <div
                                      key={`adjacent-audio-transition-btn-${currentClip.id}-${nextClip.id}`}
                                      className="absolute bg-green-500 hover:bg-green-600 text-white text-xs rounded cursor-pointer shadow-lg flex items-center justify-center transition-colors duration-200 border-2 border-white"
                                      style={{
                                        left: `${boundaryPosition - 15}px`, // 30px wide button centered on boundary
                                        width: '30px',
                                        height: '20px',
                                        top: `${audioTrackIndex * 60 + 15}px`, // Position below the thin line
                                        zIndex: 16
                                      }}
                                      title={`Add audio transition between "${currentClip.title}" and "${nextClip.title}"`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Create default transition effect
                                        const transitionDuration = 2.5;
                                        const overlapPerSide = transitionDuration / 2;
                                        const transitionStart = (currentClip.start + currentClip.duration) - overlapPerSide;
                                        
                                        const transitionEffect = {
                                          id: `manual-audio-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                          type: 'crossfade' as const,
                                          duration: transitionDuration,
                                          fromClipId: currentClip.id,
                                          toClipId: nextClip.id,
                                          startTime: transitionStart,
                                          settings: {
                                            effectType: 'crossfade',
                                            effectName: 'Audio Crossfade',
                                            intensity: 1.0,
                                            easing: 'ease-in-out' as const,
                                            overlapPerSide: overlapPerSide
                                          }
                                        };

                                        setState(prev => ({
                                          ...prev,
                                          transitions: [...(prev.transitions || []), transitionEffect]
                                        }));
                                        
                                        // Hide the transition button after creating transition
                                        setAdjacentTransitionButtons(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(buttonKey);
                                          return newSet;
                                        });
                                        
                                        toast({
                                          title: "Audio transition created",
                                          description: `Audio crossfade transition added between "${currentClip.title}" and "${nextClip.title}"`,
                                        });
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            e.dataTransfer.dropEffect = "copy";
                                            e.currentTarget.style.backgroundColor = '#16a34a'; // Darker green on drag over
                                          }
                                        } catch (error) {}
                                      }}
                                      onDragLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '';
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.style.backgroundColor = '';
                                        
                                        try {
                                          const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                          if (data.type === "effect") {
                                            // Create transition effect with custom effect
                                            const transitionDuration = 2.5;
                                            const overlapPerSide = transitionDuration / 2;
                                            const transitionStart = (currentClip.start + currentClip.duration) - overlapPerSide;
                                            
                                            const transitionEffect = {
                                              id: `custom-audio-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                              type: 'crossfade' as const,
                                              duration: transitionDuration,
                                              fromClipId: currentClip.id,
                                              toClipId: nextClip.id,
                                              startTime: transitionStart,
                                              settings: {
                                                effectType: data.id,
                                                effectName: data.name,
                                                intensity: 1.0,
                                                easing: 'ease-in-out' as const,
                                                overlapPerSide: overlapPerSide
                                              }
                                            };

                                            setState(prev => ({
                                              ...prev,
                                              transitions: [...(prev.transitions || []), transitionEffect]
                                            }));
                                            
                                            // Hide the transition button after creating transition
                                            setAdjacentTransitionButtons(prev => {
                                              const newSet = new Set(prev);
                                              newSet.delete(buttonKey);
                                              return newSet;
                                            });
                                            
                                            toast({
                                              title: "Custom audio transition created",
                                              description: `${data.name} audio transition added between "${currentClip.title}" and "${nextClip.title}"`,
                                            });
                                          }
                                        } catch (error) {
                                          console.error('Error handling audio transition button effect drop:', error);
                                        }
                                      }}
                                    >
                                      +T
                                    </div>
                                  );
                                }
                              }
                              
                              return null;
                            }).filter(Boolean);
                          })}
                           
                          {/* Audio Gap Zones with Remove Gap and Transition functionality */}
                          {audioTracks.map(({ originalIndex }) => {
                            const trackClips = state.clips
                              .filter(clip => clip.track === originalIndex)
                              .sort((a, b) => a.start - b.start);
                            
                            return trackClips.map((clip, clipIndex) => {
                              if (clipIndex === trackClips.length - 1) return null; // No gap after last clip
                              
                              const currentClip = trackClips[clipIndex];
                              const nextClip = trackClips[clipIndex + 1];
                              const audioTrackIndex = audioTracks.findIndex(({ originalIndex: tIdx }) => tIdx === originalIndex);
                              
                              const gapStart = currentClip.start + currentClip.duration;
                              const gapEnd = nextClip.start;
                              const gapBetweenClips = gapEnd - gapStart;
                              
                              // Only show gap zone if there's actually a gap between clips
                              if (Math.abs(gapBetweenClips) < 0.01) return null; // Skip if clips are adjacent
                              
                              const transitionStart = gapStart * state.zoom;
                              const transitionEnd = gapEnd * state.zoom;
                              const transitionWidth = Math.max(transitionEnd - transitionStart, 16); // Minimum 16px width
                              
                              return (
                                <div
                                  key={`audio-gap-${currentClip.id}-${nextClip.id}`}
                                  className="absolute bg-transparent hover:bg-grey-400/20 border border-transparent hover:border-grey-400 hover:border-dashed rounded cursor-pointer transition-all duration-200 group"
                                  style={{
                                    left: `${transitionStart}px`,
                                    width: `${transitionWidth}px`,
                                    height: '50px',
                                    top: `${audioTrackIndex * 60}px`,
                                    zIndex: 5
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundImage = 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255, 165, 0, 0.1) 4px, rgba(255, 165, 0, 0.1) 8px)';
                                    e.currentTarget.style.backgroundSize = '8px 8px';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundImage = '';
                                    e.currentTarget.style.backgroundSize = '';
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Remove gap functionality
                                    handleRemoveGap(originalIndex, gapStart, gapEnd);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    try {
                                      const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                      if (data.type === "effect") {
                                        e.dataTransfer.dropEffect = "copy";
                                        e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                                        e.currentTarget.style.borderColor = '#22c55e';
                                      }
                                    } catch (error) {}
                                  }}
                                  onDragLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'transparent';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    
                                                                          try {
                                      const data = JSON.parse(e.dataTransfer.getData("application/json"));
                                      if (data.type === "effect") {
                                        console.log(`[Timeline.tsx] 🎯 AUDIO TRANSITION ZONE DROP: Applying ${data.name} between "${currentClip.title}" and "${nextClip.title}"`);
                                        
                                        // Show effect feedback
                                        const gapKey = `audio-gap-${currentClip.id}-${nextClip.id}`;
                                        showEffectFeedback(gapKey, data.name);
                                        
                                        // Create overlapping transition effect (max 5 seconds, split equally)
                                        const maxTransitionDuration = 5.0; // Maximum 5 seconds
                                        const gapDuration = gapEnd - gapStart;
                                        
                                        // Calculate transition duration and overlap
                                        let transitionDuration = Math.min(maxTransitionDuration, Math.max(gapDuration + 1.0, 1.0));
                                        const overlapPerSide = transitionDuration / 2; // 2.5s each side for 5s total
                                        
                                        // Transition starts before the gap (extends first clip) and ends after gap starts (overlaps second clip)
                                        const transitionStartTime = gapStart - overlapPerSide; // Start 2.5s before first clip ends
                                        
                                        console.log(`[Timeline.tsx] 🎬 Creating audio overlapping transition:`, {
                                          currentClip: currentClip.id,
                                          nextClip: nextClip.id,
                                          gapStart: gapStart.toFixed(2),
                                          gapEnd: gapEnd.toFixed(2),
                                          gapDuration: gapDuration.toFixed(2),
                                          transitionStart: transitionStartTime.toFixed(2),
                                          transitionDuration: transitionDuration.toFixed(2),
                                          overlapPerSide: overlapPerSide.toFixed(2),
                                          effect: data.id
                                        });

                                        // Create overlapping transition effect
                                        const transitionEffect = {
                                          id: `audio-transition-${currentClip.id}-${nextClip.id}-${Date.now()}`,
                                          type: 'crossfade' as const,
                                          duration: transitionDuration,
                                          fromClipId: currentClip.id,
                                          toClipId: nextClip.id,
                                          startTime: transitionStartTime,
                                          settings: {
                                            effectType: data.id,
                                            effectName: data.name,
                                            intensity: 1.0,
                                            easing: 'ease-in-out' as const,
                                            overlapPerSide: overlapPerSide
                                          }
                                        };

                                        setState(prev => ({
                                          ...prev,
                                          transitions: [...(prev.transitions || []), transitionEffect]
                                        }));
                                        
                                        toast({
                                          title: "Audio transition effect created",
                                          description: `${data.name} effect applied to create transition between "${currentClip.title}" and "${nextClip.title}"`,
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error handling audio transition effect drop:', error);
                                    }
                                  }}
                                  title={`Click to remove gap (${formatTime(gapBetweenClips)}) or drop effects to create transitions`}
                                >
                                  {/* Gap removal icon - visible on hover */}
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <div className="duration-200">
                                      <Trash2 className="w-4 h-4"/>
                                    </div>
                                  </div>
                                  
                                  {/* Effect feedback indicator */}
                                  {(() => {
                                    const gapKey = `audio-gap-${currentClip.id}-${nextClip.id}`;
                                    const effectFeedback = droppedEffects.get(gapKey);
                                    if (effectFeedback) {
                                      return (
                                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white text-xs px-3 py-1 rounded-full shadow-lg animate-pulse z-20 border-2 border-white">
                                          🎵 {effectFeedback.effectName}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                  
                                  {/* Gap duration indicator
                                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-6 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                                    Gap: {formatTime(gapBetweenClips)}
                                  </div> */}
                                </div>
                              );
                            }).filter(Boolean);
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Text Track */}
              {/* <div className="absolute" style={{ top: `${40 + (visualTracks.length + audioTracks.length) * 60}px`, left: '60px', right: '0' }}>
                <TimelineTextTrack />
              </div> */}

              {/* Track insertion indicators */}
              {dragIndicator.show && (
                <div
                  className="absolute overflow-y-auto left-0 w-full h-1 bg-blue-500 shadow-lg z-50 rounded-full"
                  style={{
                    top: `${(() => {
                      let topPosition = 40; // Start after ruler
                      
                      if (dragIndicator.trackType === TrackType.VIDEO) {
                        // For visual tracks, position within the visual section
                        topPosition += dragIndicator.position * 60;
                      } else {
                        // For audio tracks, position after visual section
                        topPosition += visualSectionHeight + dragIndicator.position * 60;
                      }
                      
                      return topPosition;
                    })()}px`,
                    animation: 'pulse 1s infinite'
                  }}
                >
                  <div className="absolute left-2 -top-6 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg">
                    Insert {dragIndicator.trackType === TrackType.AUDIO ? 'Audio' : 'Visual'} Track
                  </div>
                </div>
              )}

              {/* PlayHead */}
              <div className="absolute top-0 left-[60px]">
                <PlayHead 
                  position={playheadPosition} 
                  timelineHeight={40 + Math.min(visualSectionHeight, maxSectionHeight) + Math.min(audioSectionHeight, maxSectionHeight) + 60}
                  onPositionChange={setPlayHeadPosition} 
                  maxPosition={timelineWidth}
                  minPosition={0}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-3">
          <PlaybackControls
            currentTime={state.currentTime}
            duration={state.duration}
            playing={state.playing}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            onSplit={() => {
              if (selectedClipId) {
                handleClipSplit(selectedClipId, state.currentTime);
              }
            }}
            canSplit={Boolean(selectedClipId && 
              state.clips.some(clip => 
                clip.id === selectedClipId && 
                state.currentTime > clip.start && 
                state.currentTime < clip.start + clip.duration
              )
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default Timeline; 