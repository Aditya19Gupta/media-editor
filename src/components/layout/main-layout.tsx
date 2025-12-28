"use client";

import { useState, useEffect } from "react";
import SidebarRenderPage from "../sidebar/SidebarRenderPage";
import { TopNavbar } from "./top-navbar";
import { cn } from "@/lib/utils";
import Timeline from "@/components/timeline/Timeline";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState("Dashboard");

  // Listen for sidebar page changes
  useEffect(() => {
    const handlePageChange = (event: CustomEvent) => {
      const newPage = event.detail;
      setActivePage(newPage);
    };

    window.addEventListener("changeSidebarPage", handlePageChange as EventListener);

    return () => {
      window.removeEventListener("changeSidebarPage", handlePageChange as EventListener);
    };
  }, []);

  // Pages that should show the timeline
  const timelinePages = ["Effects", "Media", "Captions", "Export", "Timeline", "Text Overlay", "Images", "Videos"];
  const shouldShowTimeline = timelinePages.includes(activePage);

  return (
    <div className="flex h-screen flex-col bg-background pb-3">
      <TopNavbar 
        sidebarOpen={sidebarOpen} 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
      />
      <div className="flex flex-1 overflow-hidden w-full">
        <SidebarRenderPage 
          isSidebarOpen={sidebarOpen} 
          onPageChange={setActivePage}
        />
        <main 
          className={cn(
            "flex-1 transition-all duration-300 ease-in-out w-2/3",
            sidebarOpen ? "md:ml-0" : "ml-0"
          )}
        >
          <div className="h-full animate-fade-in">
            {shouldShowTimeline ? (
              <div className='flex w-full flex-col ml-3 h-full mx-auto justify-center items-center rounded-3xl bg-gray-100 dark:bg-gradient-to-br dark:from-gray-900 dark:to-black p-6'>
                <Timeline />
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}