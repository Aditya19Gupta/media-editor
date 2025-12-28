"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import useEditorStore from '@/store/editorStore';
import { TextOverlay, TextStyle, TextPosition } from '@/types';
import TextOverlayItem from './TextOverlayItem';
import ColorPicker from './ColorPicker';

export default function TextOverlayPanel() {
  const { 
    textOverlays, 
    selectedOverlayId, 
    addTextOverlay,
    updateTextOverlay,
    deleteTextOverlay,
    selectOverlay,
    toggleOverlayVisibility
  } = useEditorStore();
  
  const selectedOverlay = textOverlays.find(overlay => overlay.id === selectedOverlayId);
  const [activeTab, setActiveTab] = useState<string>("list");

  const updateStyle = (key: keyof TextStyle, value: any) => {
    if (selectedOverlayId) {
      updateTextOverlay(selectedOverlayId, {
        style: { ...selectedOverlay!.style, [key]: value }
      });
    }
  };

  const updatePosition = (key: keyof TextPosition, value: number) => {
    if (selectedOverlayId) {
      updateTextOverlay(selectedOverlayId, {
        position: { ...selectedOverlay!.position, [key]: value }
      });
    }
  };

  const updateTiming = (key: 'startTime' | 'endTime', value: number) => {
    if (selectedOverlayId) {
      updateTextOverlay(selectedOverlayId, {
        [key]: value
      });
    }
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Text Overlays</h2>
        <Button 
          onClick={addTextOverlay} 
          size="sm"
          className="px-2"
        >
          Add Text
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="edit" disabled={!selectedOverlayId}>Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="flex-1 overflow-y-auto space-y-2">
          {textOverlays.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">
              No text overlays yet. Add one to get started.
            </div>
          ) : (
            textOverlays.map((overlay) => (
              <TextOverlayItem
                key={overlay.id}
                overlay={overlay}
                isSelected={overlay.id === selectedOverlayId}
                onSelect={() => {
                  selectOverlay(overlay.id);
                  setActiveTab("edit");
                }}
                onToggleVisibility={() => toggleOverlayVisibility(overlay.id)}
                onDelete={() => deleteTextOverlay(overlay.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="edit" className="flex-1 overflow-y-auto space-y-4">
          {selectedOverlay ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="text-content">Text Content</Label>
                <Input
                  id="text-content"
                  value={selectedOverlay.content}
                  onChange={(e) => 
                    updateTextOverlay(selectedOverlayId!, { content: e.target.value })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Text Style</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="font-family">Font Family</Label>
                  <Select 
                    value={selectedOverlay.style.fontFamily}
                    onValueChange={(value) => updateStyle('fontFamily', value)}
                  >
                    <SelectTrigger id="font-family">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter, sans-serif">Inter</SelectItem>
                      <SelectItem value="'Times New Roman', serif">Times New Roman</SelectItem>
                      <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                      <SelectItem value="'Courier New', monospace">Courier New</SelectItem>
                      <SelectItem value="Georgia, serif">Georgia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="font-size">Font Size</Label>
                    <span className="text-sm">{selectedOverlay.style.fontSize}px</span>
                  </div>
                  <Slider
                    id="font-size"
                    min={10}
                    max={72}
                    step={1}
                    value={[selectedOverlay.style.fontSize]}
                    onValueChange={(values) => updateStyle('fontSize', values[0])}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text-color">Text Color</Label>
                  <ColorPicker
                    color={selectedOverlay.style.color}
                    onChange={(color) => updateStyle('color', color)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text-align">Text Align</Label>
                  <Select
                    value={selectedOverlay.style.textAlign}
                    onValueChange={(value: TextStyle['textAlign']) => updateStyle('textAlign', value)}
                  >
                    <SelectTrigger id="text-align">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="font-weight">Font Weight</Label>
                  <Select
                    value={selectedOverlay.style.fontWeight}
                    onValueChange={(value: TextStyle['fontWeight']) => updateStyle('fontWeight', value)}
                  >
                    <SelectTrigger id="font-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="lighter">Light</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={selectedOverlay.style.fontStyle === 'italic'}
                    onCheckedChange={(checked) => 
                      updateStyle('fontStyle', checked ? 'italic' : 'normal')
                    }
                  />
                  <Label>Italic</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={!!selectedOverlay.style.textShadow}
                    onCheckedChange={(checked) => 
                      updateStyle('textShadow', checked ? '2px 2px 4px rgba(0, 0, 0, 0.5)' : undefined)
                    }
                  />
                  <Label>Text Shadow</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Position</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="position-x">Horizontal (X)</Label>
                    <span className="text-sm">{selectedOverlay.position.x}%</span>
                  </div>
                  <Slider
                    id="position-x"
                    min={0}
                    max={100}
                    step={1}
                    value={[selectedOverlay.position.x]}
                    onValueChange={(values) => updatePosition('x', values[0])}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="position-y">Vertical (Y)</Label>
                    <span className="text-sm">{selectedOverlay.position.y}%</span>
                  </div>
                  <Slider
                    id="position-y"
                    min={0}
                    max={100}
                    step={1}
                    value={[selectedOverlay.position.y]}
                    onValueChange={(values) => updatePosition('y', values[0])}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Timing</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="start-time">Start Time</Label>
                    <span className="text-sm">{selectedOverlay.startTime.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="start-time"
                    min={0}
                    max={selectedOverlay.endTime - 0.5}
                    step={0.1}
                    value={[selectedOverlay.startTime]}
                    onValueChange={(values) => updateTiming('startTime', values[0])}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="end-time">End Time</Label>
                    <span className="text-sm">{selectedOverlay.endTime.toFixed(1)}s</span>
                  </div>
                  <Slider
                    id="end-time"
                    min={selectedOverlay.startTime + 0.5}
                    max={Math.max(60, selectedOverlay.endTime + 10)}
                    step={0.1}
                    value={[selectedOverlay.endTime]}
                    onValueChange={(values) => updateTiming('endTime', values[0])}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    deleteTextOverlay(selectedOverlay.id);
                    setActiveTab("list");
                  }}
                  className="w-full"
                >
                  Delete Text Overlay
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground p-4">
              Select a text overlay to edit its properties.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}