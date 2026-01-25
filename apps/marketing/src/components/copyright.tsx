import { connection } from 'next/server';
import { Suspense } from 'react';

const CURRENT_YEAR = 2026;

async function CopyrightAsync() {
  await connection();
  return <>© {new Date().getFullYear()} Nuclom. All rights reserved.</>;
}

export function Copyright() {
  return (
    <Suspense fallback={`© ${CURRENT_YEAR} Nuclom. All rights reserved.`}>
      <CopyrightAsync />
    </Suspense>
  );
}
