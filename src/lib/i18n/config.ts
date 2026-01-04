/**
 * Internationalization (i18n) Configuration
 *
 * This module configures next-intl for the application.
 */

export const locales = ["en", "es", "fr", "de", "ja", "zh", "pt"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  zh: "中文",
  pt: "Português",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  ja: "🇯🇵",
  zh: "🇨🇳",
  pt: "🇧🇷",
};

/**
 * Check if a locale is valid
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * Get the best matching locale from Accept-Language header
 */
export function getPreferredLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, quality = "1"] = lang.trim().split(";q=");
      return {
        code: code.split("-")[0].toLowerCase(),
        quality: parseFloat(quality),
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const lang of languages) {
    if (isValidLocale(lang.code)) {
      return lang.code;
    }
  }

  return defaultLocale;
}
