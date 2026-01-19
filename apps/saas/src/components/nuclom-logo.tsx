import { cn } from '@nuclom/lib/utils';
import Image from 'next/image';

interface NuclomLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const sizeMap = {
  sm: { container: 'w-8 h-8', px: 32 },
  md: { container: 'w-10 h-10', px: 40 },
  lg: { container: 'w-12 h-12', px: 48 },
  xl: { container: 'w-16 h-16', px: 64 },
};

const textSizeMap = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

/**
 * Nuclom brand logo - play button inside a circular progress ring
 * Uses the official IconKitchen-generated brand icon
 */
export function NuclomLogo({ className, size = 'md', showText = false }: NuclomLogoProps) {
  const s = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Image
        src="/icon-512.png"
        alt="Nuclom logo"
        width={s.px}
        height={s.px}
        className={cn(s.container, 'flex-shrink-0')}
        priority
      />
      {showText && (
        <span
          className={cn(textSizeMap[size], 'font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text')}
        >
          Nuclom
        </span>
      )}
    </div>
  );
}
