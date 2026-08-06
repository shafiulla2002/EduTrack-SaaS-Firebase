import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduTrack Platform | Super Admin Portal',
  description: 'Multi-tenant SaaS Platform Administration for EduTrack',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
