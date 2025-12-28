export type EffectCategory = "transition" | "filter" | "distort";

export interface Effect {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: string;
  category: EffectCategory;
  defaultSettings: {
    duration: number;
    strength?: number;
    delay?: number;
    [key: string]: any;
  };
}

export const effects: Effect[] = [
  {
    id: "fade-in",
    name: "Fade In",
    description: "Gradually increase opacity",
    icon: "🌅",
    type: "fade-in",
    category: "transition",
    defaultSettings: {
      duration: 1.5,
      easing: "ease-in-out"
    }
  },
  {
    id: "fade-out",
    name: "Fade Out",
    description: "Gradually decrease opacity",
    icon: "🌆",
    type: "fade-out",
    category: "transition",
    defaultSettings: {
      duration: 1.5,
      easing: "ease-in-out"
    }
  },
  {
    id: "zoom-in",
    name: "Zoom In",
    description: "Enlarge from center",
    icon: "🔍",
    type: "zoom",
    category: "transition",
    defaultSettings: {
      duration: 1.2,
      strength: 50
    }
  },
  {
    id: "zoom-out",
    name: "Zoom Out",
    description: "Shrink to center",
    icon: "🔎",
    type: "zoom",
    category: "transition",
    defaultSettings: {
      duration: 1.2,
      strength: 50
    }
  },
  {
    id: "blur",
    name: "Blur",
    description: "Apply gaussian blur",
    icon: "🌫️",
    type: "blur",
    category: "filter",
    defaultSettings: {
      duration: 1.0,
      strength: 5
    }
  },
  {
    id: "sepia",
    name: "Sepia",
    description: "Apply sepia color tone",
    icon: "🧴",
    type: "sepia",
    category: "filter",
    defaultSettings: {
      duration: 1.0,
      strength: 75
    }
  },
  {
    id: "brightness",
    name: "Brightness",
    description: "Adjust brightness levels",
    icon: "☀️",
    type: "brightness",
    category: "filter",
    defaultSettings: {
      duration: 1.0,
      strength: 120
    }
  },
  {
    id: "contrast",
    name: "Contrast",
    description: "Adjust contrast levels",
    icon: "⚖️",
    type: "contrast",
    category: "filter",
    defaultSettings: {
      duration: 1.0,
      strength: 120
    }
  },
  {
    id: "wave",
    name: "Wave Distortion",
    description: "Apply wave effect",
    icon: "🌊",
    type: "wave",
    category: "distort",
    defaultSettings: {
      duration: 2.0,
      strength: 40,
      frequency: 5
    }
  },
  {
    id: "pixel",
    name: "Pixelate",
    description: "Create pixel art effect",
    icon: "🎮",
    type: "pixel",
    category: "distort",
    defaultSettings: {
      duration: 1.5,
      strength: 15
    }
  }
];