import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { logger } from "@/lib/logger";
import { defaultLocale, isValidLocale, type Locale } from "./config";

/**
 * Get messages for the requested locale
 */
async function getMessages(locale: Locale) {
  try {
    return (await import(`../../../messages/${locale}.json`)).default;
  } catch {
    // Fallback to English if locale file doesn't exist
    logger.warn(`Locale file for "${locale}" not found, falling back to "${defaultLocale}"`, {
      requestedLocale: locale,
      fallbackLocale: defaultLocale,
    });
    return (await import(`../../../messages/${defaultLocale}.json`)).default;
  }
}

/**
 * Determine the user's preferred locale
 */
async function getUserLocale(): Promise<Locale> {
  // 1. Check for locale cookie (user preference)
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;
  if (localeCookie && isValidLocale(localeCookie)) {
    return localeCookie;
  }

  // 2. Check Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get("Accept-Language");
  if (acceptLanguage) {
    const preferredLocales = acceptLanguage.split(",").map((lang) => {
      const [code] = lang.trim().split(";");
      return code.split("-")[0].toLowerCase();
    });

    for (const locale of preferredLocales) {
      if (isValidLocale(locale)) {
        return locale;
      }
    }
  }

  // 3. Default locale
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  const messages = await getMessages(locale);

  return {
    locale,
    messages,
    timeZone: "UTC",
    now: new Date(),
    // Formats for dates, numbers, etc.
    formats: {
      dateTime: {
        short: {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
        medium: {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
        },
        long: {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        },
      },
      number: {
        compact: {
          notation: "compact",
        },
        percentage: {
          style: "percent",
        },
      },
    },
  };
});
