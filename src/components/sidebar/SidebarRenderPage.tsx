"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import { MediaLibrary } from "../sidebar/media/MediaLibrary";
import { ImagesLibrary } from "../sidebar/media/ImagesLibrary";
import { VideosLibrary } from "../sidebar/media/VideosLibrary";
import TimelineEditor from "../editor/TimelineEditor";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import EffectCard from "../editor/effects/EffectCard";
import EditorPage from "@/app/editor/page";
import EffectsPanel from "../editor/effects/EffectsPanel";
import TextOverlayPanel from "../text-overlay/TextOverlayPanel";
import { ExportPanel } from "../export/ExportPanel";
import { ExportSummary } from "../export/ExportSummary";
import { ExportForm } from "@/components/export/ExportForm";
import { ExportProgress } from "@/components/export/ExportProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportSettings, initialExportSettings } from "@/lib/export/export-types";
import { useTimeline } from "@/contexts/TimelineContext";
import { exportTimelineAsVideo, downloadBlob, ProcessingProgress } from "@/lib/video/videoExporter";
import { useToast } from "@/components/ui/use-toast";

// Sidebar-optimized Export Component
function SidebarExportPanel() {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Export Video</h2>
      </div>
      
      {/* Export Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ExportSummary 
            settings={settings} 
            exportComplete={exportComplete}
          />
        </CardContent>
      </Card>

      {/* Export Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {isExporting ? (
            <ExportProgress 
              progress={progress} 
              onCancel={handleCancel}
              settings={settings}
              currentTask={currentTask}
            />
          ) : (
            <ExportForm 
              settings={settings} 
              setSettings={setSettings} 
              onExport={handleExport}
              isExporting={isExporting}
              exportComplete={exportComplete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SidebarRenderPageProps {
  onPageChange?: (page: string) => void;
  isSidebarOpen?: boolean;
}

function SidebarRenderPage({
  onPageChange,
  isSidebarOpen,
}:SidebarRenderPageProps) {
  const [activePage, setActivePage] = useState("Dashboard");
 
  const sidebarRef = React.useRef<any>(null);

  useEffect(() => {
    const handleExternalPageChange = (event: CustomEvent) => {
      const newPage = event.detail;
      setActivePage(newPage);

      // Also notify the parent if the callback exists
      if (onPageChange) {
        onPageChange(newPage);
      }

      // Attempt to update the Sidebar's active state if it exposes a method
      if (sidebarRef.current && sidebarRef.current.setActivePage) {
        sidebarRef.current.setActivePage(newPage);
      }
    };

    window.addEventListener(
      "changeSidebarPage",
      handleExternalPageChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "changeSidebarPage",
        handleExternalPageChange as EventListener
      );
    };
  }, [onPageChange]);

  // Update the page state and notify parent
  const handleLocalPageChange = (page: string) => {
    setActivePage(page);
    if (onPageChange) {
      onPageChange(page);
    }
    
    // Also emit the event for other components to listen
    const event = new CustomEvent("changeSidebarPage", {
      detail: page
    });
    window.dispatchEvent(event);
  };

  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return <MediaLibrary />;
      case "Timeline":
        return <MediaLibrary />;
      case "Effects":
        return <EditorPage/>;
      case "Media":
        return <MediaLibrary />;
      case "MediaLibrary":
        return <MediaLibrary />;
      case "Images":
        return <ImagesLibrary />;
      case "Videos":
        return <VideosLibrary />;
      case "Captions":
        return <TextOverlayPanel/>
      case "Export":
        return <SidebarExportPanel />;

      default:
        return <MediaLibrary />;
    }
  };

  return (
    <>
      <div
        className={`flex  lg:flex md:flex ${
          isSidebarOpen ? "w-full lg:w-1/3 md:w-1/3" : ""
        }`}
      >
        <Sidebar
          ref={sidebarRef}
          onPageChange={handleLocalPageChange}
          activePage={activePage}
        />
        <div
          className={`rounded-3xl flex-1 bg-gray-100 dark:bg-gradient-to-bl dark:from-gray-900 dark:to-black p-6 overflow-y-auto  [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-gray-100
          [&::-webkit-scrollbar-thumb]:bg-gray-300
          dark:[&::-webkit-scrollbar-track]:bg-neutral-700
          dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500 ${
            isSidebarOpen ? "" : "hidden"
          }`}
        >
          {renderPage()}
        </div>
      </div>
    </>
  );
}

export default SidebarRenderPage;
