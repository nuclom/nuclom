import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nuclom Video Player',
  description: 'Embedded video player powered by Nuclom',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
