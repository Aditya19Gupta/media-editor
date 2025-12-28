export enum TrackType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  TEXT = 'text'
}

// Import TextStyle and TextPosition from existing types
import { TextStyle, TextPosition } from './index';

// Image transformation interface for resizable/adjustable images
export interface ImageTransform {
  scale?: number; // Scale factor (1.0 = original size) - kept for backwards compatibility
  scaleX?: number; // Width scale factor (1.0 = original width)
  scaleY?: number; // Height scale factor (1.0 = original height)
  rotation?: number; // Rotation in degrees
  offsetX?: number; // X offset as percentage of canvas width
  offsetY?: number; // Y offset as percentage of canvas height
  opacity?: number; // Opacity (0-1)
  flipHorizontal?: boolean; // Horizontal flip
  flipVertical?: boolean; // Vertical flip
}

export interface Clip {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'image' | 'text';
  duration: number;
  start: number;
  track: number;
  trackType: TrackType;
  videoUrl?: string;
  audioUrl?: string;
  thumbnail?: string;
  color?: string;
  effects?: string[]; // ✅ must be present
  muted?: boolean; // For audio clips
  // Video/Audio trimming properties
  trimStart?: number; // Start offset in the original media file (in seconds)
  trimEnd?: number; // End offset in the original media file (in seconds)
  originalDuration?: number; // Duration of the original media file
  // Transition properties
  transition?: {
    id: string;
    type: string;
    duration: number;
    settings?: any;
  };
  // Text-specific properties
  textContent?: string;
  textStyle?: TextStyle;
  textPosition?: TextPosition;
  visible?: boolean;
  textOverlayId?: string; // Link to the source text overlay for synchronization
  // Image-specific properties for transformations
  imageTransform?: ImageTransform;
}

// Transition effect interface for gap-filling transitions
export interface TransitionEffect {
  id: string;
  type: 'crossfade' | 'wipe' | 'dissolve' | 'slide' | 'zoom' | 'blur';
  duration: number; // Duration of the transition in seconds
  fromClipId: string; // ID of the first clip
  toClipId: string; // ID of the second clip
  startTime: number; // When the transition starts
  settings?: {
    direction?: 'left' | 'right' | 'up' | 'down';
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    intensity?: number; // 0-1 for effect intensity
    [key: string]: any;
  };
}

export interface TimelineState {
  clips: Clip[];
  transitions: TransitionEffect[]; // Array of transitions between clips
  zoom: number;
  currentTime: number;
  duration: number;
  playing: boolean;
}

export interface TimelineTrackProps {
  index: number;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isActive?: boolean;
  onClipSelect: (clipId: string) => void;
  zoom: number;
  clips: Clip[];
  trackType: TrackType;
  label: string;
}