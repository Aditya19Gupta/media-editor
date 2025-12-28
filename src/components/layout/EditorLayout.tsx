"use client";
import { useState } from "react";
import EffectsPanel from "@/components/editor/effects/EffectsPanel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { DndProvider } from "@/lib/context/DndProvider";
import TimelinePreview from "../timeline/TimelinePreview";
import { Clip } from "@/types/clip";

export default function EditorLayout() {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Example state: you should populate this dynamically
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  return (
    <DndProvider>
      <div className="flex flex-col w-full h-screen bg-background text-foreground overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Smart Video Editor</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">Undo</Button>
            <Button variant="outline" size="sm">Redo</Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* Full timeline preview panel */}
            <Panel defaultSize={70} minSize={40}>
            <div className="z-10 bg-gray-900 text-white p-2 rounded">
              <TimelinePreview
                clips={clips}
                currentTime={currentTime}
                width={200}
                height={300}
                playing={playing}
                onPlayToggle={() => setPlaying(!playing)}
              />
            </div>
              <div className="w-full h-full p-4">
                <TimelinePreview
                  clips={clips}
                  currentTime={currentTime}
                  playing={playing}
                  // Make preview stretch to fill the panel
                  width={0} // Optional, TimelinePreview can be made to ignore width and use `100%`
                  height={0} // Optional, or set via CSS
                  onPlayToggle={() => setPlaying(!playing)}
                />
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

            {/* Effects panel */}
            <Panel defaultSize={30} minSize={20}>
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-in-out border-l",
                  isPanelCollapsed ? "w-12" : "w-full"
                )}
              >
                <div className="flex items-center justify-between p-2 border-b">
                  <h2
                    className={cn(
                      "font-medium transition-opacity",
                      isPanelCollapsed ? "opacity-0" : "opacity-100"
                    )}
                  >
                    Effects
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                    className="h-8 w-8 p-0"
                  >
                    {isPanelCollapsed ? "→" : "←"}
                  </Button>
                </div>
                <EffectsPanel
                  isCollapsed={isPanelCollapsed}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </DndProvider>
  );
}
