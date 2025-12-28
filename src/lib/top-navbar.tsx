"use client";

import { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Menu, 
  PenTool, 
  Save, 
  Share2, 
  Undo2, 
  Redo2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/layout/mode-toggle";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface TopNavbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function TopNavbar({ sidebarOpen, onToggleSidebar }: TopNavbarProps) {
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [isEditing, setIsEditing] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    setIsEditing(false);
    if (!projectTitle.trim()) {
      setProjectTitle("Untitled Project");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="mr-2 md:hidden"
            aria-label="Toggle Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="mr-2 hidden md:flex"
            aria-label={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </Button>
          
          <div className="flex h-16 items-center gap-2 px-4">
            <PenTool className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Editor</h1>
          </div>
          
          <div className="ml-4 hidden md:block">
            <div
              className={cn(
                "rounded-md border bg-card px-3 py-1.5 transition-all",
                isEditing && "ring-2 ring-ring"
              )}
              onClick={() => setIsEditing(true)}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={projectTitle}
                  onChange={handleTitleChange}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
                  className="w-full bg-transparent outline-none"
                  autoFocus
                />
              ) : (
                <span>{projectTitle}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <Button size="icon" variant="ghost" aria-label="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Copy Link</DropdownMenuItem>
                <DropdownMenuItem>Email</DropdownMenuItem>
                <DropdownMenuItem>Embed</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="default" size="sm" className="h-9">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
          
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}