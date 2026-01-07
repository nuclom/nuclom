import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Nuclom - Video Collaboration Platform';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d0f17 0%, #1a1d2e 50%, #0d0f17 100%)',
        position: 'relative',
      }}
    >
      {/* Background gradient circles */}
      <div
        style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-100px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
        }}
      />

      {/* Logo and Icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(124, 58, 237, 0.4)',
          }}
        >
          <svg
            width="45"
            height="45"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Nuclom</title>
            <polygon points="6 3 20 12 6 21 6 3" fill="white" stroke="white" />
          </svg>
        </div>
        <span
          style={{
            fontSize: '64px',
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
          }}
        >
          Nuclom
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: '32px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontWeight: 500,
          marginBottom: '16px',
          textAlign: 'center',
        }}
      >
        Video Collaboration Platform
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: '20px',
          color: 'rgba(255, 255, 255, 0.6)',
          maxWidth: '700px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Real-time collaboration, AI-powered transcription, and seamless sharing
      </div>

      {/* Feature badges */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '48px',
        }}
      >
        {['AI Transcription', 'Team Collaboration', 'Enterprise Security'].map((feature) => (
          <div
            key={feature}
            style={{
              padding: '12px 24px',
              borderRadius: '100px',
              background: 'rgba(124, 58, 237, 0.2)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '16px',
              fontWeight: 500,
            }}
          >
            {feature}
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
    },
  );
}
