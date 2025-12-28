"use client";

import { ExportPanel } from "@/components/export/ExportPanel";
import { PageHeader } from "@/components/export/PageHeader";

export default function ExportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <PageHeader />
        <ExportPanel />
      </div>
    </div>
  );
}