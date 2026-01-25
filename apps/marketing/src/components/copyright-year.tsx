import { connection } from 'next/server';

export async function CopyrightYear() {
  await connection();
  return <>{new Date().getFullYear()}</>;
}
