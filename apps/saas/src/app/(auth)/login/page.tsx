import { env } from '@nuclom/lib/env/server';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const signupsDisabled = env.DISABLE_SIGNUPS;

  return (
    <div className="w-full max-w-md">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm signupsDisabled={signupsDisabled} />
      </Suspense>
    </div>
  );
}
