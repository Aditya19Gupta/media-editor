"use client";

import { useState, useEffect } from "react";
import { ExportSettings } from "@/lib/export/export-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { 
  Download, 
  Save, 
  Folder, 
  Check,
  AlertTriangle,
  Info
} from "lucide-react";

interface ExportFormProps {
  settings: ExportSettings;
  setSettings: (settings: ExportSettings) => void;
  onExport: () => void;
  isExporting: boolean;
  exportComplete: boolean;
}

// Type declarations for File System Access API
interface FileSystemDirectoryHandle {
  name: string;
  kind: string;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: string;
      startIn?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

// Calculate estimated memory usage for different resolutions
function getMemoryInfo(resolution: string) {
  let width = 1920, height = 1080;
  
  switch (resolution) {
    case '720p':
      width = 1280;
      height = 720;
      break;
    case '1080p':
      width = 1920;
      height = 1080;
      break;
    case '4k':
      width = 3840;
      height = 2160;
      break;
  }
  
  const pixelsPerFrame = width * height;
  const bytesPerFrame = pixelsPerFrame * 4; // RGBA
  const estimatedMemoryMB = Math.ceil((bytesPerFrame * 20) / (1024 * 1024)); // Estimate for processing
  
  return {
    width,
    height,
    estimatedMemoryMB,
    warning: estimatedMemoryMB > 400 ? 'high' : estimatedMemoryMB > 200 ? 'medium' : 'low'
  };
}

export function ExportForm({ 
  settings, 
  setSettings, 
  onExport, 
  isExporting,
  exportComplete
}: ExportFormProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState(settings.fileName);
  const [location, setLocation] = useState(settings.location);
  const [supportsFileSystemAPI, setSupportsFileSystemAPI] = useState(false);
  
  const memoryInfo = getMemoryInfo(settings.resolution);

  // Check File System Access API support on component mount
  useEffect(() => {
    setSupportsFileSystemAPI(!!window.showDirectoryPicker);
  }, []);
  
  const handleCompressionChange = (value: number[]) => {
    setSettings({
      ...settings,
      compression: value[0],
    });
  };

  const handleFileNameChange = (newFileName: string) => {
    setFileName(newFileName);
    setSettings({
      ...settings,
      fileName: newFileName,
    });
  };

  const handleLocationChange = (newLocation: string) => {
    setLocation(newLocation);
    setSettings({
      ...settings,
      location: newLocation,
    });
  };

  const handleChooseFolder = async () => {
    // Check if the File System Access API is supported
    if (window.showDirectoryPicker) {
      try {
        // Modern browsers with File System Access API support
        const directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'downloads'
        });
        
        // Get the directory path/name
        const dirName = directoryHandle.name;
        const dirPath = directoryHandle.kind === 'directory' ? dirName : location;
        
        handleLocationChange(dirPath);
        
        toast({
          title: "Folder selected",
          description: `Export location set to: ${dirPath}`,
        });
        
        // Store the directory handle for future use (optional)
        // You could store this in localStorage or state if needed
        
      } catch (error: any) {
        // User cancelled the dialog or an error occurred
        if (error.name !== 'AbortError') {
          console.error('Error selecting directory:', error);
          toast({
            title: "Error selecting folder",
            description: "Couldn't access the selected folder. Using common locations instead.",
            variant: "destructive",
          });
          // Fallback to cycling through common locations
          cycleThroughCommonLocations();
        }
      }
    } else {
      // Fallback for browsers that don't support File System Access API
      toast({
        title: "System folder picker not available",
        description: "Using common location instead. Consider using Chrome/Edge for folder picker support.",
        variant: "default",
      });
      cycleThroughCommonLocations();
    }
  };

  const cycleThroughCommonLocations = () => {
    const commonLocations = [
      "Downloads",
      "Documents/Videos", 
      "Desktop",
      "Videos"
    ];
    
    const currentIndex = commonLocations.findIndex(loc => location.includes(loc));
    const nextIndex = (currentIndex + 1) % commonLocations.length;
    const nextLocation = commonLocations[nextIndex];
    
    handleLocationChange(nextLocation);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="fileName" className="text-base">File Name</Label>
          <div className="flex mt-1.5 gap-2">
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => handleFileNameChange(e.target.value)}
              placeholder="My awesome video"
              className="flex-1"
              disabled={isExporting}
            />
            <Select 
              value={settings.format} 
              onValueChange={(value) => setSettings({...settings, format: value})}
              disabled={isExporting}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4</SelectItem>
                <SelectItem value="webm">WebM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* <div>
          <Label htmlFor="location" className="text-base">Save Location</Label>
          <div className="flex mt-1.5 gap-2">
            <Input
              id="location"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              placeholder="Enter save location (e.g., Downloads, Desktop)"
              className="flex-1"
              disabled={isExporting}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={handleChooseFolder}
              disabled={isExporting}
              title={supportsFileSystemAPI ? "Browse for folder" : "Cycle through common locations"}
            >
              <Folder className="h-4 w-4" />
              <span className="sr-only">
                {supportsFileSystemAPI ? "Browse for folder" : "Choose common folder"}
              </span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {supportsFileSystemAPI ? (
              <>
                Click the folder icon to browse for a directory, or type your preferred path
                <span className="text-green-600 dark:text-green-400 ml-1">
                  • System folder picker available
                </span>
              </>
            ) : (
              <>
                Click the folder icon to cycle through common locations, or type your preferred path
                <span className="text-orange-600 dark:text-orange-400 ml-1">
                  • System folder picker not supported in this browser
                </span>
              </>
            )}
          </p>
        </div> */}

        <div className="space-y-3 pt-2">
          <Label className="text-base">Resolution</Label>
          <RadioGroup 
            value={settings.resolution} 
            onValueChange={(value) => setSettings({...settings, resolution: value})}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            disabled={isExporting}
          >
            <div>
              <RadioGroupItem value="720p" id="720p" className="peer sr-only" />
              <Label
                htmlFor="720p"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <span className="text-sm font-semibold">720p</span>
                <span className="text-xs text-muted-foreground">HD • Low memory</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="1080p" id="1080p" className="peer sr-only" />
              <Label
                htmlFor="1080p"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <span className="text-sm font-semibold">1080p</span>
                <span className="text-xs text-muted-foreground">Full HD • Recommended</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="4k" id="4k" className="peer sr-only" />
              <Label
                htmlFor="4k"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
              >
                <span className="text-sm font-semibold">4K</span>
                <span className="text-xs text-muted-foreground">Ultra HD • High memory</span>
              </Label>
            </div>
          </RadioGroup>
          
          {/* Memory usage warning */}
          {memoryInfo.warning === 'high' && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <CardContent className="flex items-center gap-3 p-3">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>High memory usage:</strong> {memoryInfo.estimatedMemoryMB}MB estimated. 
                  Export may fail on devices with limited memory. Consider using 1080p instead.
                </p>
              </CardContent>
            </Card>
          )}
          
          {memoryInfo.warning === 'medium' && (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardContent className="flex items-center gap-3 p-3">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Memory usage:</strong> {memoryInfo.estimatedMemoryMB}MB estimated for {memoryInfo.width}×{memoryInfo.height} resolution.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex justify-between">
            <Label htmlFor="compression" className="text-base">Compression Level</Label>
            <span className="text-sm text-muted-foreground">
              {settings.compression < 30 ? "High Quality" : 
               settings.compression < 70 ? "Balanced" : "Small Size"}
            </span>
          </div>
          <Slider
            id="compression"
            min={0}
            max={100}
            step={1}
            value={[settings.compression]}
            onValueChange={handleCompressionChange}
            disabled={isExporting}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>High Quality</span>
            <span>Small Size</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Label className="text-base">Format Options</Label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bitrate" className="text-sm">Bitrate</Label>
              <Select 
                value={settings.bitrate} 
                onValueChange={(value) => setSettings({...settings, bitrate: value})}
                disabled={isExporting}
              >
                <SelectTrigger id="bitrate">
                  <SelectValue placeholder="Select bitrate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Recommended)</SelectItem>
                  <SelectItem value="low">Low (5 Mbps)</SelectItem>
                  <SelectItem value="medium">Medium (15 Mbps)</SelectItem>
                  <SelectItem value="high">High (30 Mbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="framerate" className="text-sm">Frame Rate</Label>
              <Select 
                value={settings.framerate} 
                onValueChange={(value) => setSettings({...settings, framerate: value})}
                disabled={isExporting}
              >
                <SelectTrigger id="framerate">
                  <SelectValue placeholder="Select framerate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps (Film)</SelectItem>
                  <SelectItem value="30">30 fps (Standard)</SelectItem>
                  <SelectItem value="60">60 fps (Smooth)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button 
          type="button" 
          variant="outline"
          disabled={isExporting}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Preset
        </Button>
        
        <Button 
          type="submit" 
          disabled={isExporting || fileName.trim() === "" || exportComplete}
          className="min-w-[140px] transition-all"
        >
          {exportComplete ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Exported
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export Video
            </>
          )}
        </Button>
      </div>
    </form>
  );
}