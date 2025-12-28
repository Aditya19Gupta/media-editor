"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 transition-all duration-300"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-yellow-400 transition-all duration-300" />
      ) : (
        <Moon className="h-4 w-4 text-gray-800 transition-all duration-300" />
      )}
    </Button>
  );
}
