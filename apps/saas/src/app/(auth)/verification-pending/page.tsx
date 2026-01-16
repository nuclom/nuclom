import { Suspense } from 'react';
import { VerificationPendingForm } from '@/components/auth/verification-pending-form';

export default function VerificationPendingPage() {
  return (
    <div className="w-full max-w-md">
      <Suspense fallback={<div>Loading...</div>}>
        <VerificationPendingForm />
      </Suspense>
    </div>
  );
}
