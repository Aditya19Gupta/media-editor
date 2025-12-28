export interface TextOverlay {
  id: string;
  content: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  style: TextStyle;
  position: TextPosition;
  visible: boolean;
  droppedInTimeline?: boolean; // Track if overlay has been dropped into timeline
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number; // in pixels
  color: string;
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right';
  fontWeight: 'normal' | 'bold' | 'lighter';
  fontStyle: 'normal' | 'italic';
  textShadow?: string;
  rotate?: number; // rotation angle in degrees
}

export interface TextPosition {
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
}

// Video clip interface
export interface VideoClip {
  id: string;
  name: string;
  src: string;
  startTime: number;
  endTime: number;
  duration: number;
  thumbnailUrl?: string;
}

// Project state interface
export interface EditorState {
  currentTime: number;
  duration: number;
  zoom: number;
  videoClips: VideoClip[];
  textOverlays: TextOverlay[];
  selectedOverlayId: string | null;
  playing: boolean;
}

// Timeline constants
export const TIMELINE_SCALE_FACTOR = 100; // pixels per second