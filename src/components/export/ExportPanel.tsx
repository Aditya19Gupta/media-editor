"use client";

import { useState } from "react";
import { ExportForm } from "@/components/export/ExportForm";
import { ExportProgress } from "@/components/export/ExportProgress";
import { ExportSummary } from "@/components/export/ExportSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ExportSettings, 
  initialExportSettings 
} from "@/lib/export/export-types";
import { useTimeline } from "@/contexts/TimelineContext";
import { exportTimelineAsVideo, downloadBlob, ProcessingProgress } from "@/lib/video/videoExporter";
import { useToast } from "@/components/ui/use-toast";

export function ExportPanel() {
  const { toast } = useToast();
  const { clips, duration } = useTimeline();
  const [settings, setSettings] = useState<ExportSettings>(initialExportSettings);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const [currentTask, setCurrentTask] = useState("");

  const handleExport = async () => {
    if (clips.length === 0) {
      toast({
        title: "No clips to export",
        description: "Please add some clips to the timeline before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setExportComplete(false);
    setCurrentTask("Preparing export...");
    
    try {
      const onProgress = (processingProgress: ProcessingProgress) => {
        setProgress(processingProgress.progress);
        setCurrentTask(processingProgress.currentTask);
      };

      const videoBlob = await exportTimelineAsVideo(clips, duration, settings, onProgress);
      
      // Download the video
      const filename = `${settings.fileName}.${settings.format}`;
      downloadBlob(videoBlob, filename);
      
      setExportComplete(true);
      setCurrentTask("Export completed!");
      
      toast({
        title: "Export successful",
        description: `Your video has been exported as ${filename}`,
      });
      
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = () => {
    setIsExporting(false);
    setProgress(0);
    setCurrentTask("");
  };

  return (
    <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
          </TabsList>
          
          <TabsContent value="settings" className="mt-0">
            <Card>
              <CardContent className="p-6">
                <ExportForm 
                  settings={settings} 
                  setSettings={setSettings} 
                  onExport={handleExport}
                  isExporting={isExporting}
                  exportComplete={exportComplete}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="presets" className="mt-0">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Saved Presets</h3>
                  <p className="text-muted-foreground">
                    You haven't saved any export presets yet. Configure your export settings and save them as a preset for quick access.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <div>
        <Card className="h-full">
          <CardContent className="p-6 space-y-6">
            {isExporting ? (
              <ExportProgress 
                progress={progress} 
                onCancel={handleCancel}
                settings={settings}
                currentTask={currentTask}
              />
            ) : (
              <ExportSummary 
                settings={settings} 
                exportComplete={exportComplete}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}