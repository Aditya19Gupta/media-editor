import { create } from 'zustand';
import { EditorState, TextOverlay, TextStyle, TextPosition } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Sample video for demo purposes
const sampleVideo: EditorState['videoClips'][0] = {
  id: 'sample-video',
  name: 'Sample Video',
  src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  startTime: 0,
  endTime: 60,
  duration: 60,
  thumbnailUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
};

const defaultTextStyle: TextStyle = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 24,
  color: '#FFFFFF',
  backgroundColor: 'transparent',
  textAlign: 'center',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
};

const defaultTextPosition: TextPosition = {
  x: 50, // center
  y: 50, // center
};

const useEditorStore = create<EditorState & {
  addTextOverlay: () => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  deleteTextOverlay: (id: string) => void;
  setCurrentTime: (time: number) => void;
  selectOverlay: (id: string | null) => void;
  toggleOverlayVisibility: (id: string) => void;
  setPlaying: (playing: boolean) => void;
}>((set) => ({
  currentTime: 0,
  duration: sampleVideo.duration,
  zoom: 1,
  videoClips: [sampleVideo],
  textOverlays: [],
  selectedOverlayId: null,
  playing: false,

  addTextOverlay: () => set((state) => {
    const newOverlay: TextOverlay = {
      id: uuidv4(),
      content: 'New Text',
      startTime: Math.max(0, state.currentTime - 1),
      endTime: Math.min(state.duration, state.currentTime + 4),
      style: { ...defaultTextStyle },
      position: { ...defaultTextPosition },
      visible: true,
    };

    return {
      textOverlays: [...state.textOverlays, newOverlay],
      selectedOverlayId: newOverlay.id,
    };
  }),

  updateTextOverlay: (id, updates) => set((state) => ({
    textOverlays: state.textOverlays.map((overlay) =>
      overlay.id === id ? { ...overlay, ...updates } : overlay
    ),
  })),

  deleteTextOverlay: (id) => set((state) => ({
    textOverlays: state.textOverlays.filter((overlay) => overlay.id !== id),
    selectedOverlayId: state.selectedOverlayId === id ? null : state.selectedOverlayId,
  })),

  setCurrentTime: (time) => set({ currentTime: time }),

  selectOverlay: (id) => set({ selectedOverlayId: id }),

  toggleOverlayVisibility: (id) => set((state) => ({
    textOverlays: state.textOverlays.map((overlay) =>
      overlay.id === id ? { ...overlay, visible: !overlay.visible } : overlay
    ),
  })),

  setPlaying: (playing) => set({ playing }),
}));

export default useEditorStore;