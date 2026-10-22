import type { Metadata } from 'next';
import { TenantProvider } from './providers/TenantContext';
import { ThemeProvider } from './providers/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'CS EduTrack - Smarter Institute Management',
  description: 'CS EduTrack is a school and college management platform that connects administrators, teachers, students, and parents through a unified digital platform by Covenant Synergy Private Limited.',
  applicationName: 'CS EduTrack',
  authors: [{ name: 'Covenant Synergy Private Limited' }],
  keywords: ['CS EduTrack', 'School Management Platform', 'College ERP', 'Covenant Synergy'],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'CS EduTrack - Smarter Institute Management',
    description: 'CS EduTrack is a school and college management platform by Covenant Synergy Private Limited.',
    siteName: 'CS EduTrack',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('edutrack-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <TenantProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

