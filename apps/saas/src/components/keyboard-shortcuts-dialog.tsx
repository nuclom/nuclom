'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Cmd', 'K'], description: 'Open quick search' },
      { keys: ['Esc'], description: 'Close dialogs and menus' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'H'], description: 'Go to home' },
      { keys: ['G', 'S'], description: 'Go to search' },
      { keys: ['G', 'V'], description: 'Go to videos' },
      { keys: ['G', 'C'], description: 'Go to collections' },
    ],
  },
  {
    title: 'Video Player',
    shortcuts: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['F'], description: 'Toggle fullscreen' },
      { keys: ['M'], description: 'Mute / Unmute' },
      { keys: ['\u2190'], description: 'Rewind 10 seconds' },
      { keys: ['\u2192'], description: 'Forward 10 seconds' },
      { keys: ['\u2191'], description: 'Increase volume' },
      { keys: ['\u2193'], description: 'Decrease volume' },
      { keys: ['0-9'], description: 'Seek to percentage' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['N'], description: 'New video upload' },
      { keys: ['R'], description: 'Start recording' },
    ],
  },
];

function KeyboardKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-muted border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Show shortcuts dialog on '?' key
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate faster. Press <KeyboardKey>?</KeyboardKey> anytime to show this dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 mt-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-1.5">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <KeyboardKey>{key === 'Cmd' ? '\u2318' : key}</KeyboardKey>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Tip: On Mac, use <KeyboardKey>{'\u2318'}</KeyboardKey> (Command). On Windows/Linux, use{' '}
            <KeyboardKey>Ctrl</KeyboardKey>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
