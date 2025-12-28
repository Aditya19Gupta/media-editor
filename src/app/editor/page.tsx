 "use client";
import EffectsPanel from "@/components/editor/effects/EffectsPanel";
//  import EditorLayout from "@/components/layout/EditorLayout";
 import { EffectsProvider } from "@/lib/context/EffectsContext";

 export default function EditorPage() {
  return (
    <EffectsProvider>
      <EffectsPanel/>
    </EffectsProvider>
  );
}
