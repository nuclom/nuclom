"use client";

import { Cookie, Settings, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const COOKIE_CONSENT_KEY = "nuclom_cookie_consent";
const COOKIE_CONSENT_VERSION = "2025-01-01";

export interface CookiePreferences {
  version: string;
  timestamp: string;
  essential: boolean; // Always true
  analytics: boolean;
}

function getStoredPreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;
    const preferences = JSON.parse(stored) as CookiePreferences;
    // If version changed, require re-consent
    if (preferences.version !== COOKIE_CONSENT_VERSION) return null;
    return preferences;
  } catch {
    return null;
  }
}

function savePreferences(preferences: CookiePreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(preferences));
}

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = getStoredPreferences();
    setPreferences(stored);
    setIsLoaded(true);
  }, []);

  const updatePreferences = useCallback((newPrefs: CookiePreferences) => {
    savePreferences(newPrefs);
    setPreferences(newPrefs);
  }, []);

  return { preferences, isLoaded, updatePreferences };
}

export function CookieConsentBanner() {
  const { preferences, isLoaded, updatePreferences } = useCookieConsent();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    if (isLoaded && !preferences) {
      // Small delay to avoid jarring appearance
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, preferences]);

  const acceptAll = useCallback(() => {
    const prefs: CookiePreferences = {
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: true,
    };
    updatePreferences(prefs);
    setShowBanner(false);
  }, [updatePreferences]);

  const rejectNonEssential = useCallback(() => {
    const prefs: CookiePreferences = {
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: false,
    };
    updatePreferences(prefs);
    setShowBanner(false);
  }, [updatePreferences]);

  const saveCustomPreferences = useCallback(() => {
    const prefs: CookiePreferences = {
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: analyticsEnabled,
    };
    updatePreferences(prefs);
    setShowBanner(false);
    setShowSettings(false);
  }, [analyticsEnabled, updatePreferences]);

  const openSettings = useCallback(() => {
    setAnalyticsEnabled(preferences?.analytics ?? false);
    setShowSettings(true);
  }, [preferences?.analytics]);

  if (!showBanner && !showSettings) return null;

  return (
    <>
      {/* Cookie Banner */}
      {showBanner && !showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
          <div className="mx-auto max-w-4xl">
            <div className="relative rounded-xl border bg-background shadow-2xl p-6">
              <button
                type="button"
                onClick={rejectNonEssential}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Cookie className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">Cookie Preferences</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We use cookies to enhance your experience. Essential cookies are required for the site to
                      function. Analytics cookies help us understand how you use our service. Learn more in our{" "}
                      <Link href="/cookies" className="text-primary hover:underline">
                        Cookie Policy
                      </Link>
                      .
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button onClick={acceptAll} className="flex-1 sm:flex-none">
                      Accept All
                    </Button>
                    <Button onClick={rejectNonEssential} variant="outline" className="flex-1 sm:flex-none">
                      Essential Only
                    </Button>
                    <Button onClick={openSettings} variant="ghost" className="flex-1 sm:flex-none">
                      <Settings className="h-4 w-4 mr-2" />
                      Customize
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie Settings</DialogTitle>
            <DialogDescription>
              Manage your cookie preferences. Essential cookies cannot be disabled as they are required for the site to
              function properly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Essential Cookies */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Essential Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Required for the website to function. Includes authentication, security, and basic functionality
                  cookies.
                </p>
              </div>
              <Switch checked={true} disabled aria-label="Essential cookies (always enabled)" />
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Analytics Cookies</Label>
                <p className="text-sm text-muted-foreground">
                  Help us understand how you use our service, which pages are popular, and how to improve your
                  experience.
                </p>
              </div>
              <Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsEnabled} aria-label="Analytics cookies" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustomPreferences}>Save Preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Floating button to reopen cookie settings (for users who want to change preferences)
export function CookieSettingsButton() {
  const { preferences, isLoaded } = useCookieConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    if (preferences) {
      setAnalyticsEnabled(preferences.analytics);
    }
  }, [preferences]);

  const saveCustomPreferences = useCallback(() => {
    const prefs: CookiePreferences = {
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: analyticsEnabled,
    };
    savePreferences(prefs);
    setShowSettings(false);
    // Reload to apply changes
    window.location.reload();
  }, [analyticsEnabled]);

  // Only show if user has already made a choice
  if (!isLoaded || !preferences) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-muted p-3 shadow-lg hover:bg-muted/80 transition-colors"
        aria-label="Cookie settings"
      >
        <Cookie className="h-5 w-5 text-muted-foreground" />
      </button>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie Settings</DialogTitle>
            <DialogDescription>
              Update your cookie preferences. Changes will take effect after saving.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Essential Cookies</Label>
                <p className="text-sm text-muted-foreground">Required for the website to function.</p>
              </div>
              <Switch checked={true} disabled aria-label="Essential cookies (always enabled)" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Analytics Cookies</Label>
                <p className="text-sm text-muted-foreground">Help us improve our service.</p>
              </div>
              <Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsEnabled} aria-label="Analytics cookies" />
            </div>

            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(preferences.timestamp).toLocaleDateString()}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustomPreferences}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
