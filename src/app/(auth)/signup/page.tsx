"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to register page since signup is just an alias
    router.replace("/register");
  }, [router]);

  return null;
}