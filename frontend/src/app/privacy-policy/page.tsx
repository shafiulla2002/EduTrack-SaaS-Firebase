'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-brand-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex justify-between items-center z-10 border-b border-slate-900/60">
        <Link href="/" className="flex items-center gap-3 group">
          <img 
            src="/cs-edutrack-logo.jpg" 
            alt="CS EduTrack Logo" 
            className="h-10 sm:h-12 w-auto object-contain rounded-lg group-hover:scale-105 transition-transform" 
          />
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              CS EduTrack
            </span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
              by Covenant Synergy Private Limited
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold glass-panel text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Application</span>
        </Link>
      </header>

      {/* Main Content Area */}
      <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-10 z-10">
        {/* Title Badge */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            <span>Legal & Privacy Documentation</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-3 max-w-2xl mx-auto font-light">
            CS EduTrack by Covenant Synergy Private Limited
          </p>
          <div className="mt-4 inline-block px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
            Last Updated: September 21, 2026
          </div>
        </div>

        {/* Content Card Container */}
        <div className="glass-card p-6 sm:p-10 rounded-3xl border border-slate-900/60 bg-slate-900/40 backdrop-blur-xl space-y-10 text-slate-300 text-sm leading-relaxed font-light">
          
          {/* Section 1 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">01.</span> Introduction
            </h2>
            <p>
              <strong>Covenant Synergy Private Limited</strong> ("Company", "we", "us", "our") operates <strong>CS EduTrack</strong>, a comprehensive school and educational institution management platform ("Platform" or "Services"). CS EduTrack helps educational institutions digitize and streamline academic, administrative, fee management, and communication-related workflows.
            </p>
            <p>
              By accessing or using CS EduTrack through our web portal, mobile interfaces, or institutional instances, users ("you", "your") acknowledge that their personal and operational information will be processed in accordance with this Privacy Policy.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">02.</span> Information We Collect
            </h2>
            <p>
              We process information necessary to deliver the features of CS EduTrack based on user roles and institutional configurations. The categories of information processed include:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong>Account & Authentication Information:</strong> Full name, registered mobile phone number, email address, assigned user role (School Administrator, Teacher, Parent/Guardian, or Student), and authentication session tokens.
              </li>
              <li>
                <strong>Student Academic Records:</strong> Student name, profile details, roll number, assigned class and section, daily attendance logs, examination marks, report cards, homework assignments, timetable schedules, leave requests, and academic remarks.
              </li>
              <li>
                <strong>Parent & Guardian Information:</strong> Parent/guardian name, registered mobile number, relationship with linked students, and account communication preferences.
              </li>
              <li>
                <strong>Administrative & Institutional Data:</strong> Institution name, branding/logo, class structures, subject mapping, fee structure configurations, invoices, fee collection statements, and operational settings.
              </li>
              <li>
                <strong>Technical & Diagnostic Information:</strong> IP address, device/browser information, application request logs, authentication timestamps, and error diagnostics collected to maintain system stability and security.
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">03.</span> How We Use Information
            </h2>
            <p>
              Information collected within CS EduTrack is used exclusively to fulfill legitimate educational and service purposes, including:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white block mb-1">Service Provision</span>
                Delivering role-based portal access, managing academic records, tracking attendance, and processing timetables.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white block mb-1">Authentication & Security</span>
                Verifying user identities via mobile OTP authentication and enforcing strict multi-tenant access controls.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white block mb-1">Fee & Billing Records</span>
                Generating institutional fee invoices, tracking fee receipts, and managing SaaS platform subscription status.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white block mb-1">System Diagnostics</span>
                Diagnosing technical bugs, monitoring server performance, and maintaining platform uptime.
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">04.</span> Educational Institution Responsibility
            </h2>
            <p>
              CS EduTrack serves as a technology service provider to educational institutions. Educational institutions act as data controllers for the student, parent, and academic information entered into their respective platform instances.
            </p>
            <p>
              Institutions are responsible for ensuring they possess the necessary authority, permissions, and consents required under applicable laws to collect and upload personal data to CS EduTrack for educational administration. Covenant Synergy Private Limited does not claim ownership of institution or student data.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">05.</span> Multi-Tenant Data Isolation
            </h2>
            <p>
              CS EduTrack is architected as a multi-tenant platform. Data belonging to each educational institution is logically isolated from other institutions. Technical mechanisms ensure that authenticated users can access only the information authorized for their specific institution and assigned user role.
            </p>
          </div>

          {/* Section 6 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">06.</span> Authentication and Security
            </h2>
            <p>
              We implement industry-standard administrative, technical, and physical safeguards to protect information against unauthorized access, alteration, disclosure, or destruction. Safeguards include role-based access control, cryptographic token verification (JWT), HTTPS/TLS encryption in transit, and database access controls.
            </p>
            <p className="text-slate-400 text-xs italic">
              While we enforce rigorous security controls, no electronic transmission over the Internet or digital storage mechanism can be guaranteed to be entirely immune from all potential threats.
            </p>
          </div>

          {/* Section 7 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">07.</span> OTP / Phone Authentication
            </h2>
            <p>
              Account login relies on One-Time Password (OTP) verification sent to the user's registered mobile number. Mobile numbers are verified via secure third-party authentication services (such as Firebase Phone Authentication) to confirm identity before issuing application session tokens.
            </p>
          </div>

          {/* Section 8 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">08.</span> Payments Architecture & Isolation
            </h2>
            <p>
              CS EduTrack maintains a strict separation between SaaS platform billing and institutional fee collection:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>SaaS Platform Subscriptions:</strong> Educational institutions subscribe to CS EduTrack subscription plans. Platform subscription payments may be processed via platform payment gateways (such as Razorpay).
              </li>
              <li>
                <strong>Educational Institution Fee Collection:</strong> Student and parent fee payments are collected directly through the respective educational institution's configured payment accounts or bank transfer methods. Platform subscription payment credentials are never used to collect or hold student fees.
              </li>
            </ul>
          </div>

          {/* Section 9 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">09.</span> Third-Party Services
            </h2>
            <p>
              CS EduTrack integrates with select third-party infrastructure providers solely to deliver platform functionality:
            </p>
            <div className="space-y-2 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white">Firebase Authentication (Google LLC):</span> Mobile phone OTP verification and security tokens.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white">Razorpay (Razorpay Software Private Limited):</span> Platform SaaS subscription billing processing.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white">Google Maps & Leaflet:</span> Interactive location visualizers for institution vehicle transport tracking.
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="font-semibold text-white">Amazon Web Services (AWS S3):</span> Secure cloud object storage for institutional documents and attachments.
              </div>
            </div>
          </div>

          {/* Section 10 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">10.</span> Cookies & Local Storage
            </h2>
            <p>
              CS EduTrack utilizes browser Local Storage and Session Storage strictly to maintain active user login state, portal role preferences, and tenant session caching. We do not use tracking cookies for third-party targeted advertising.
            </p>
          </div>

          {/* Section 11 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">11.</span> Children's & Student Data Protection
            </h2>
            <p>
              Because CS EduTrack processes information related to students (including minors), student data is used strictly for legitimate educational and administrative purposes associated with their institution. Student records are never sold, rented, or monetized for commercial advertising.
            </p>
          </div>

          {/* Section 12 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">12.</span> Data Retention
            </h2>
            <p>
              Information is retained for the duration required to provide educational management services to the institution, fulfill contractual commitments, comply with applicable record-keeping laws, resolve disputes, and maintain operational audit logs.
            </p>
          </div>

          {/* Section 13 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">13.</span> Data Sharing
            </h2>
            <p>
              We do not sell personal data. Information is shared only with authorized institutional personnel, service providers necessary for platform operations (e.g., authentication or hosting providers), or when explicitly required by law enforcement or legal processes.
            </p>
          </div>

          {/* Section 14 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">14.</span> User Rights & Requests
            </h2>
            <p>
              Users may request access, correction, or updates to their account information. Because educational institutions control student records, inquiries regarding student or academic profile data should be directed to the respective institution's administrator.
            </p>
          </div>

          {/* Section 15 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">15.</span> Data Security Controls
            </h2>
            <p>
              We regularly review and update technical security measures, including token expiration, network firewalls, and server monitoring, to uphold system integrity.
            </p>
          </div>

          {/* Section 16 */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">16.</span> Changes to This Privacy Policy
            </h2>
            <p>
              Covenant Synergy Private Limited reserves the right to update this Privacy Policy to reflect technical, operational, or legal developments. Revised policies will be posted on this page with an updated revision date.
            </p>
          </div>

          {/* Section 17 */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-brand-400 font-mono text-sm">17.</span> Contact Information
            </h2>
            <p>
              For questions regarding this Privacy Policy or platform data protection practices, please contact us:
            </p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <p className="font-bold text-white text-sm">Covenant Synergy Private Limited</p>
              <p>Platform: <strong>CS EduTrack</strong></p>
              <p>Domain: <span className="text-brand-400">edutrackapplication.covenantsynergy.in</span></p>
              <p className="text-slate-400 pt-1 font-mono">
                Support / Legal Contact: [LEGAL_CONTACT_EMAIL: support@covenantsynergy.in / legal@covenantsynergy.in]
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 border-t border-slate-900/80 z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-light">
        <p>
          &copy; {new Date().getFullYear()} Covenant Synergy Private Limited. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-300">CS EduTrack</span>
          <span>•</span>
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors underline">
            Login
          </Link>
        </div>
      </footer>
    </main>
  );
}
