"use client";

import { Suspense } from "react";

function CopyrightYearInner() {
  return <>{new Date().getFullYear()}</>;
}

export function CopyrightYear() {
  return (
    <Suspense fallback="2025">
      <CopyrightYearInner />
    </Suspense>
  );
}
