export type MediaType = "image" | "video" | "audio" | "file";

export interface MediaItem {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
  audioUrl: string;
  duration: number;
}