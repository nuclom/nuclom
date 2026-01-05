/**
 * Internationalization (i18n) Configuration
 *
 * This module configures next-intl for the application.
 */

export const locales = [
  "en",
  "zh",
  "hi",
  "es",
  "fr",
  "ar",
  "bn",
  "pt",
  "ru",
  "ja",
  "de",
  "ko",
  "vi",
  "it",
  "tr",
  "ca",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  ar: "العربية",
  bn: "বাংলা",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  de: "Deutsch",
  ko: "한국어",
  vi: "Tiếng Việt",
  it: "Italiano",
  tr: "Türkçe",
  ca: "Català",
};

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  zh: "🇨🇳",
  hi: "🇮🇳",
  es: "🇪🇸",
  fr: "🇫🇷",
  ar: "🇸🇦",
  bn: "🇧🇩",
  pt: "🇧🇷",
  ru: "🇷🇺",
  ja: "🇯🇵",
  de: "🇩🇪",
  ko: "🇰🇷",
  vi: "🇻🇳",
  it: "🇮🇹",
  tr: "🇹🇷",
  ca: "🇪🇸",
};

/**
 * RTL (Right-to-Left) locales
 */
export const rtlLocales: Locale[] = ["ar"];

const localeSet = new Set<string>(locales);

/**
 * Check if a locale is valid
 */
export function isValidLocale(locale: string): locale is Locale {
  return localeSet.has(locale);
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
