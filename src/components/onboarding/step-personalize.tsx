"use client";

import { ArrowRight, Briefcase, Code, Film, Megaphone, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StepPersonalizeProps {
  onNext: (data: { role: string; teamSize: string; useCase: string }) => void;
  onBack: () => void;
}

const roles = [
  { id: "engineering", label: "Engineering", icon: Code },
  { id: "product", label: "Product", icon: Zap },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "design", label: "Design", icon: Film },
  { id: "leadership", label: "Leadership", icon: Briefcase },
  { id: "other", label: "Other", icon: Users },
];

const teamSizes = [
  { id: "1-10", label: "1-10 people" },
  { id: "11-50", label: "11-50 people" },
  { id: "51-200", label: "51-200 people" },
  { id: "201-1000", label: "201-1000 people" },
  { id: "1000+", label: "1000+ people" },
];

const useCases = [
  { id: "meetings", label: "Record meetings", description: "Never miss important discussions" },
  { id: "updates", label: "Async updates", description: "Replace status meetings" },
  { id: "training", label: "Training & onboarding", description: "Build a knowledge library" },
  { id: "demos", label: "Product demos", description: "Share with customers & stakeholders" },
];

export function StepPersonalize({ onNext, onBack }: StepPersonalizeProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedTeamSize, setSelectedTeamSize] = useState<string | null>(null);
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step === 0 && selectedRole) {
      setStep(1);
    } else if (step === 1 && selectedTeamSize) {
      setStep(2);
    } else if (step === 2 && selectedUseCase) {
      onNext({
        role: selectedRole || "",
        teamSize: selectedTeamSize || "",
        useCase: selectedUseCase || "",
      });
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      onBack();
    }
  };

  const canProceed =
    (step === 0 && selectedRole) || (step === 1 && selectedTeamSize) || (step === 2 && selectedUseCase);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Tell us about yourself</h2>
        <p className="text-muted-foreground">
          {step === 0 && "What best describes your role?"}
          {step === 1 && "How big is your team?"}
          {step === 2 && "How do you plan to use Nuclom?"}
        </p>
      </div>

      {/* Step 0: Role selection */}
      {step === 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {roles.map((role) => (
            <Card
              key={role.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedRole === role.id && "border-primary bg-primary/5 ring-2 ring-primary/20",
              )}
              onClick={() => setSelectedRole(role.id)}
            >
              <CardContent className="flex flex-col items-center justify-center p-6">
                <role.icon
                  className={cn("w-8 h-8 mb-3", selectedRole === role.id ? "text-primary" : "text-muted-foreground")}
                />
                <span className="font-medium text-sm">{role.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1: Team size */}
      {step === 1 && (
        <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
          {teamSizes.map((size) => (
            <Card
              key={size.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedTeamSize === size.id && "border-primary bg-primary/5 ring-2 ring-primary/20",
              )}
              onClick={() => setSelectedTeamSize(size.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <span className="font-medium">{size.label}</span>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-all",
                    selectedTeamSize === size.id ? "border-primary bg-primary" : "border-muted-foreground/30",
                  )}
                >
                  {selectedTeamSize === size.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2: Use case */}
      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {useCases.map((useCase) => (
            <Card
              key={useCase.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedUseCase === useCase.id && "border-primary bg-primary/5 ring-2 ring-primary/20",
              )}
              onClick={() => setSelectedUseCase(useCase.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all",
                      selectedUseCase === useCase.id ? "border-primary bg-primary" : "border-muted-foreground/30",
                    )}
                  >
                    {selectedUseCase === useCase.id && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{useCase.label}</p>
                    <p className="text-sm text-muted-foreground">{useCase.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((s) => (
          <div
            key={s}
            className={cn("w-2 h-2 rounded-full transition-all", s === step ? "bg-primary w-6" : "bg-muted")}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={!canProceed}>
          {step === 2 ? "Continue" : "Next"}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
