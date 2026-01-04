"use client";

import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KEYBOARD_SHORTCUTS } from "../types";

interface KeyboardHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export function KeyboardHelpModal({ visible, onClose }: KeyboardHelpModalProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="bg-background rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="flex justify-between text-sm">
              <kbd className="px-2 py-0.5 bg-muted rounded text-muted-foreground font-mono text-xs">{shortcut.key}</kbd>
              <span className="text-muted-foreground">{shortcut.action}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">Press ? to toggle this menu</p>
      </div>
    </div>
  );
}
