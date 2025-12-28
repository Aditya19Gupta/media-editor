export interface ExportSettings {
  fileName: string;
  format: string;
  resolution: string;
  compression: number;
  bitrate: string;
  framerate: string;
  location: string;
}

export const initialExportSettings: ExportSettings = {
  fileName: "My Video",
  format: "mp4",
  resolution: "1080p",
  compression: 50,
  bitrate: "auto",
  framerate: "30",
  location: "Downloads",
};