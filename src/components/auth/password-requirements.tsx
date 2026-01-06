'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordRequirement {
  id: string;
  label: string;
  validator: (password: string) => boolean;
}

export const passwordRequirements: PasswordRequirement[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    validator: (password) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    validator: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    validator: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    validator: (password) => /[0-9]/.test(password),
  },
  {
    id: 'special',
    label: 'One special character (!@#$%^&*)',
    validator: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
];

export function validatePassword(password: string): {
  isValid: boolean;
  failedRequirements: string[];
} {
  const failedRequirements = passwordRequirements.filter((req) => !req.validator(password)).map((req) => req.label);

  return {
    isValid: failedRequirements.length === 0,
    failedRequirements,
  };
}

interface PasswordRequirementsProps {
  password: string;
  show?: boolean;
}

export function PasswordRequirements({ password, show = true }: PasswordRequirementsProps) {
  if (!show) return null;

  return (
    <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password requirements</p>
      <ul className="space-y-1.5">
        {passwordRequirements.map((requirement) => {
          const isMet = requirement.validator(password);
          return (
            <li
              key={requirement.id}
              className={cn(
                'flex items-center gap-2 text-sm transition-colors',
                isMet ? 'text-green-600' : 'text-muted-foreground',
              )}
            >
              {isMet ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : <X className="h-3.5 w-3.5 flex-shrink-0" />}
              <span>{requirement.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Compact version for inline display
export function PasswordStrengthIndicator({ password }: { password: string }) {
  const metCount = passwordRequirements.filter((req) => req.validator(password)).length;
  const totalCount = passwordRequirements.length;
  const percentage = (metCount / totalCount) * 100;

  let strengthLabel = 'Weak';
  let strengthColor = 'bg-red-500';

  if (percentage >= 100) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-green-500';
  } else if (percentage >= 60) {
    strengthLabel = 'Good';
    strengthColor = 'bg-yellow-500';
  } else if (percentage >= 40) {
    strengthLabel = 'Fair';
    strengthColor = 'bg-orange-500';
  }

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span className={cn('font-medium', percentage >= 100 ? 'text-green-600' : 'text-muted-foreground')}>
          {strengthLabel}
        </span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full transition-all duration-300', strengthColor)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
