import { Suspense } from 'react';
import { PrivateBetaForm } from '@/components/auth/private-beta-form';
import { RegisterForm } from '@/components/auth/register-form';
import { env } from '@/lib/env/server';

export default function RegisterPage() {
  const signupsDisabled = env.DISABLE_SIGNUPS;

  return (
    <div className="w-full max-w-md">
      <Suspense fallback={<div>Loading...</div>}>{signupsDisabled ? <PrivateBetaForm /> : <RegisterForm />}</Suspense>
    </div>
  );
}
