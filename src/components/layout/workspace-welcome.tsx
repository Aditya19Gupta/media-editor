import { Clock, Film, ImageIcon, Layout, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WorkspaceWelcome() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center animate-slide-in">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          Welcome to Digital Media Editor
        </h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Your professional suite for creating and editing digital media content
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="transition-all hover:shadow-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto mb-2">
                <Library className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Media Library</CardTitle>
              <CardDescription>
                Manage all your media assets in one place
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p>Upload, organize, and access all your media files</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline">
                Go to Library
              </Button>
            </CardFooter>
          </Card>

          <Card className="transition-all hover:shadow-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto mb-2">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Timeline Editor</CardTitle>
              <CardDescription>
                Create and edit your project timeline
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p>Arrange clips, add transitions, and perfect your sequence</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Start Editing</Button>
            </CardFooter>
          </Card>

          <Card className="transition-all hover:shadow-md md:col-span-2 lg:col-span-1">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mx-auto mb-2">
                <Layout className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Templates</CardTitle>
              <CardDescription>
                Start with a template to speed up your workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p>Choose from a variety of professional templates</p>
            </CardContent>
            <CardFooter>
              <Button className="w-full mt-6" variant="outline">
                Browse Templates
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Button size="lg" className="gap-2">
            <ImageIcon className="h-5 w-5" />
            New Image Project
          </Button>
          <Button size="lg" className="gap-2" variant="outline">
            <Film className="h-5 w-5" />
            New Video Project
          </Button>
        </div>
      </div>
    </div>
  );
}
