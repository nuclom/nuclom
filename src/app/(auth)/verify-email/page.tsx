import { Suspense } from 'react';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
