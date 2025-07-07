import { Suspense } from "react";
import VerifyEmailPage from "@/components/auth/verify-email-page";

export default function Page() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailPage />
      </Suspense>
    </div>
  );
}
