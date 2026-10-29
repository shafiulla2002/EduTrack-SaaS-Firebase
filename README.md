# EduTrack SaaS — Master Super Admin Control Center

Standalone, isolated Super Admin portal for EduTrack SaaS, built with Next.js 14 and powered in real-time by **Firebase Cloud Firestore** (`edutrack-52e6c`).

## Capabilities
1. **Multi-Tenant Tracking:** Monitor all registered schools, subdomains, student counts, and active plans.
2. **Registration Approvals Queue:** Review applications submitted by schools via `/register-school`. Approve or reject registrations with 1-click.
3. **Subscription Lifecycle & Grace Extensions:** Track active paid, 14-day trials, and expired accounts. Modify expiration dates, assign plan tiers, and grant +14 days grace extensions.
4. **Broadcast Communication Hub:** Dispatch priority announcements directly to school administrators.
5. **Modular Feature ACLs:** Configure feature module access per subscription tier (`TRIAL`, `BASIC`, `PREMIUM`, `ENTERPRISE`).
6. **Platform Invoicing:** Issue manual invoices and audit recurring SaaS platform revenue.

## Tech Stack
- Framework: Next.js 14 (App Router)
- Database: Firebase Cloud Firestore (`edutrack-52e6c`)
- Styling: Tailwind CSS & Vanilla CSS glassmorphism
- Icons: Lucide React

## Local Development
```bash
npm install
npm run dev
```
Open `http://localhost:3005` in your browser.
