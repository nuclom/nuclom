"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid or expired verification token");
      return;
    }
    fetch(`/api/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus("error");
          setError(data.error || "Invalid or expired verification token");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Invalid or expired verification token");
      });
  }, [token]);

  if (status === "pending") {
    return <div>Verifying email...</div>;
  }

  if (status === "success") {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Email verified successfully</h1>
        <p>Your account is now active</p>
        <Button onClick={() => router.push("/dashboard")}>Continue to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">{error}</h1>
      <p>Request a new verification email</p>
      <Button onClick={() => router.push("/register")}>Back to registration</Button>
    </div>
  );
}
