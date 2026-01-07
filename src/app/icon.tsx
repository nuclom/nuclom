import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Google requires at least 48x48 for favicon display in search results
export const size = {
  width: 48,
  height: 48,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>Nuclom icon</title>
        <polygon points="6 3 20 12 6 21 6 3" fill="white" stroke="white" />
      </svg>
    </div>,
    {
      ...size,
    },
  );
}
