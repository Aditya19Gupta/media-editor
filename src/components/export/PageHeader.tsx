"use client";

import { ArrowLeft, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PageHeader() {
  return (
    <div className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to editor</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Export Video</h1>
          <p className="text-sm text-muted-foreground">
            Configure and download your final video
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm">
        <Settings2 className="mr-2 h-4 w-4" />
        Advanced
      </Button>
    </div>
  );
}