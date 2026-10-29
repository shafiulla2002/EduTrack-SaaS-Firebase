import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduTrack SaaS — Master Super Admin Control Center',
  description: 'Centralized Multi-Tenant Institutional Tracking, Approvals & Subscription Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
