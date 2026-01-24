'use client';

import { Button } from '@nuclom/ui/button';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
