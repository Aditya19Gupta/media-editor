"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Upload, 
  Zap, 
  FileText, 
  Download,
  Clock,
  Film,
  Sparkles,
  PlusCircle
} from 'lucide-react';

export default function DashboardPage() {
  const handleGetStarted = (page: string) => {
    const event = new CustomEvent("changeSidebarPage", {
      detail: page
    });
    window.dispatchEvent(event);
  };

  const quickActions = [
    {
      title: "Import Media",
      description: "Add videos, images, and audio files",
      icon: <Upload className="h-6 w-6" />,
      action: () => handleGetStarted("Media"),
      color: "bg-blue-500"
    },
    {
      title: "Add Effects",
      description: "Apply visual effects and transitions",
      icon: <Sparkles className="h-6 w-6" />,
      action: () => handleGetStarted("Effects"),
      color: "bg-purple-500"
    },
    {
      title: "Add Captions",
      description: "Create text overlays and captions",
      icon: <FileText className="h-6 w-6" />,
      action: () => handleGetStarted("Captions"),
      color: "bg-green-500"
    },
    {
      title: "Export Video",
      description: "Render and download your final video",
      icon: <Download className="h-6 w-6" />,
      action: () => handleGetStarted("Export"),
      color: "bg-orange-500"
    }
  ];

  const recentProjects = [
    { name: "My First Video", duration: "2:30", lastModified: "2 hours ago" },
    { name: "Product Demo", duration: "1:45", lastModified: "Yesterday" },
    { name: "Tutorial Video", duration: "5:20", lastModified: "3 days ago" }
  ];

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Film className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Welcome to Move37 Video Editor</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Create amazing videos with our intuitive timeline editor. Import media, add effects, and export professional-quality content.
        </p>
        <Button 
          size="lg" 
          onClick={() => handleGetStarted("Timeline")}
          className="mt-4"
        >
          <Play className="mr-2 h-5 w-5" />
          Start Editing
        </Button>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <Card 
                key={index} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={action.action}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className={`w-12 h-12 rounded-full ${action.color} flex items-center justify-center text-white mx-auto`}>
                    {action.icon}
                  </div>
                  <h3 className="font-semibold">{action.title}</h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Projects</span>
            </CardTitle>
            <Button variant="outline" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentProjects.map((project, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                onClick={() => handleGetStarted("Timeline")}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Film className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">{project.duration} • {project.lastModified}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips & Features */}
      <Card>
        <CardHeader>
          <CardTitle>Tips & Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Keyboard Shortcuts</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Spacebar: Play/Pause</li>
                <li>• Ctrl+B: Toggle Sidebar</li>
                <li>• Left/Right: Skip 5 seconds</li>
                <li>• Ctrl+Z: Undo</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Pro Tips</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Drag files directly to timeline</li>
                <li>• Right-click clips for options</li>
                <li>• Use effects between clips for transitions</li>
                <li>• Click timeline to hide sidebar</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 