import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="w-full max-w-md">
      <Suspense fallback={<div>Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
