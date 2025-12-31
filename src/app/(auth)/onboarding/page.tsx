"use client";

import { Film } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { StepComplete } from "@/components/onboarding/step-complete";
import { StepCreateOrg } from "@/components/onboarding/step-create-org";
import { StepIntegrations } from "@/components/onboarding/step-integrations";
import { StepPersonalize } from "@/components/onboarding/step-personalize";
import { StepWelcome } from "@/components/onboarding/step-welcome";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";

const ONBOARDING_STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "personalize", title: "About You" },
  { id: "workspace", title: "Workspace" },
  { id: "integrations", title: "Integrations" },
  { id: "complete", title: "Complete" },
];

interface OnboardingData {
  role?: string;
  teamSize?: string;
  useCase?: string;
  organizationName?: string;
  organizationSlug?: string;
}

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    async function checkOrganizations() {
      try {
        const { data: orgs } = await authClient.organization.list();
        if (orgs && orgs.length > 0) {
          // User already has organizations, redirect to first one
          router.replace(`/${orgs[0].slug}`);
          return;
        }
      } catch (err) {
        console.error("Error checking organizations:", err);
      }
      setLoading(false);
    }
    checkOrganizations();
  }, [router]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePersonalize = (data: { role: string; teamSize: string; useCase: string }) => {
    setOnboardingData((prev) => ({ ...prev, ...data }));
    handleNext();
  };

  const handleCreateOrg = async (data: { name: string; slug: string }) => {
    setCreating(true);
    setError(null);

    try {
      const { data: orgData, error: createError } = await authClient.organization.create({
        name: data.name,
        slug: data.slug,
      });

      if (createError) {
        setError(createError.message || "Failed to create workspace");
        return;
      }

      if (orgData) {
        await authClient.organization.setActive({ organizationId: orgData.id });
        setOnboardingData((prev) => ({
          ...prev,
          organizationName: data.name,
          organizationSlug: data.slug,
        }));
        handleNext();
      }
    } catch (err) {
      console.error("Error creating organization:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Film className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-center py-6 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Film className="h-7 w-7 text-primary" />
          <span className="text-xl font-semibold">Nuclom</span>
        </div>
      </header>

      {/* Progress */}
      {currentStep > 0 && currentStep < ONBOARDING_STEPS.length - 1 && (
        <div className="w-full max-w-3xl mx-auto px-6 py-8">
          <OnboardingProgress steps={ONBOARDING_STEPS} currentStep={currentStep} />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {currentStep === 0 && <StepWelcome userName={user?.name || undefined} onNext={handleNext} />}

          {currentStep === 1 && <StepPersonalize onNext={handlePersonalize} onBack={handleBack} />}

          {currentStep === 2 && (
            <StepCreateOrg onNext={handleCreateOrg} onBack={handleBack} isLoading={creating} error={error} />
          )}

          {currentStep === 3 && (
            <StepIntegrations
              onNext={handleNext}
              onBack={handleBack}
              organizationSlug={onboardingData.organizationSlug}
            />
          )}

          {currentStep === 4 && onboardingData.organizationSlug && (
            <StepComplete
              organizationSlug={onboardingData.organizationSlug}
              organizationName={onboardingData.organizationName || "Your Workspace"}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>
          Need help?{" "}
          <a href="/support" className="underline hover:text-foreground">
            Contact support
          </a>
        </p>
      </footer>
    </div>
  );
}
