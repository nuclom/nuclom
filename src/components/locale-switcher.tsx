"use client";

import { Check, Globe } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Locale, localeFlags, localeNames, locales } from "@/lib/i18n";

interface LocaleSwitcherProps {
  currentLocale: Locale;
}

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (locale: Locale) => {
    if (locale === currentLocale) return;

    startTransition(() => {
      // Set locale cookie
      document.cookie = `locale=${locale};path=/;max-age=31536000;samesite=strict`;
      // Reload page to apply new locale
      window.location.reload();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending}>
          <Globe className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">{localeNames[currentLocale]}</span>
          <span className="sm:hidden">{localeFlags[currentLocale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem key={locale} onClick={() => handleLocaleChange(locale)} className="flex items-center gap-2">
            <span className="text-lg">{localeFlags[locale]}</span>
            <span className="flex-1">{localeNames[locale]}</span>
            {locale === currentLocale && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
