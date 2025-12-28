export const MOCK_TRACKS = [
  {
    id: 'v1',
    type: 'video',
    name: 'Video 1',
    color: 'bg-blue-600',
    icon: 'Video',
    expanded: true,
    clips: [
      { id: 'v1c1', name: 'Intro Scene', start: 0, end: 100, color: 'bg-blue-500' },
      { id: 'v1c2', name: 'Main Sequence', start: 120, end: 280, color: 'bg-blue-600' }
    ]
  },
  {
    id: 'v2',
    type: 'video',
    name: 'Video 2',
    color: 'bg-blue-800',
    icon: 'Video',
    expanded: true,
    clips: [
      { id: 'v2c1', name: 'Overlay Shot', start: 60, end: 180, color: 'bg-blue-400' }
    ]
  },
  {
    id: 'a1',
    type: 'audio',
    name: 'Audio 1',
    color: 'bg-green-600',
    icon: 'Music',
    expanded: true,
    clips: [
      { id: 'a1c1', name: 'Background Music', start: 0, end: 300, color: 'bg-green-500' }
    ]
  },
  {
    id: 'a2',
    type: 'audio',
    name: 'Audio 2',
    color: 'bg-green-800',
    icon: 'Music2',
    expanded: true,
    clips: [
      { id: 'a2c1', name: 'Voice Over', start: 50, end: 150, color: 'bg-green-400' },
      { id: 'a2c2', name: 'Sound Effect', start: 200, end: 230, color: 'bg-green-600' }
    ]
  },
  {
    id: 't1',
    type: 'text',
    name: 'Text 1',
    color: 'bg-purple-600',
    icon: 'Type',
    expanded: true,
    clips: [
      { id: 't1c1', name: 'Title', start: 20, end: 80, color: 'bg-purple-500' },
      { id: 't1c2', name: 'Subtitle', start: 230, end: 290, color: 'bg-purple-400' }
    ]
  },
  {
    id: 'e1',
    type: 'effect',
    name: 'Effects 1',
    color: 'bg-orange-600',
    icon: 'Sparkles',
    expanded: true,
    clips: [
      { id: 'e1c1', name: 'Transition', start: 100, end: 120, color: 'bg-orange-500' },
      { id: 'e1c2', name: 'Filter', start: 150, end: 280, color: 'bg-orange-400' }
    ]
  }
];

export const TIMELINE_CONFIG = {
  totalDuration: 300, // in seconds
  pixelsPerSecond: 4,
  trackHeight: 60,
  clipMinHeight: 40,
  timelineWidth: 1200
};

export type Track = {
  id: string;
  type: 'video' | 'audio' | 'text' | 'effect';
  name: string;
  color: string;
  icon: string;
  expanded: boolean;
  clips: Clip[];
};

export type Clip = {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
};