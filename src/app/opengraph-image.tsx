import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { ImageResponse } from 'next/og';
import { OGImageContent } from '../components/og-image/og-image-content';

export const alt = 'Nuclom - Video Collaboration Platform';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  const interSemiBold = await readFile(join(process.cwd(), 'assets/fonts/Inter-SemiBold.ttf'));
  const interBold = await readFile(join(process.cwd(), 'assets/fonts/Inter-Bold.ttf'));

  return new ImageResponse(<OGImageContent />, {
    ...size,
    fonts: [
      {
        name: 'Inter',
        data: interSemiBold,
        style: 'normal',
        weight: 600,
      },
      {
        name: 'Inter',
        data: interBold,
        style: 'normal',
        weight: 700,
      },
    ],
  });
}
