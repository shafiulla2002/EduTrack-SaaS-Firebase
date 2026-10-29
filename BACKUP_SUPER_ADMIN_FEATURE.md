# EduTrack SaaS — Super Admin Feature & Multi-Tenant Architecture

> **Feature Specification Document**  
> **Standalone Portal Directory:** [`edutrack-superadmin-portal/`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal)  
> **Master Dashboard Page:** [`edutrack-superadmin-portal/src/app/page.tsx`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/app/page.tsx)  
> **Firebase Firestore Engine:** [`edutrack-superadmin-portal/src/lib/superAdminFirebase.ts`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/lib/superAdminFirebase.ts)  
> **Isolation Status:** **Completely removed from the School ERP application**; operates as an independent control center.

---

## 1. Overview of the Super Admin Portal

The **Super Admin Portal** is an isolated, master control center for the EduTrack SaaS platform. Individual school principals, teachers, drivers, and accountants only have access to their own school's dashboard within the school ERP application, while the **Super Admin** runs entirely independently to oversee multi-tenant infrastructure across all schools.

### Key Capabilities:
1. **Multi-Tenant School Tracking:** Monitor every school using the platform, custom subdomains (`<subdomain>.edutrack.com`), contact emails, student headcounts, and activation dates.
2. **Registration Approvals Queue:** Review applications submitted by schools via `/register-school`. Approve or reject registrations with 1-click.
3. **Subscription Management:** View active subscription plans (`TRIAL`, `BASIC`, `PREMIUM`, `ENTERPRISE`), validity dates, and subscription statuses (`ACTIVE`, `PAST_DUE`, `EXPIRED`, `CANCELLED`).
4. **Manual Overrides & Grace Extensions:** Instantly grant +14 days grace extensions, renew plans, change tiers, or suspend/reactivate access.
5. **Modular Feature ACL (Access Control):** Toggle specific functional modules (e.g., GPS Transport, Hostel, Payroll, RFID Attendance) on or off per plan tier.
6. **Broadcast Communication Hub:** Dispatch priority announcements directly to school administrators.
7. **Billing & Manual Invoicing:** Issue custom invoices directly to school administrators and log recurring payment gateway transactions.
8. **Platform Gateways & Tax Rules:** Manage Razorpay and Stripe API keys, GST percentage, currency (`INR`), and platform branding.

---

## 2. Core Dashboard Metrics

The portal aggregates platform-wide analytics in real time:

| Metric Card | Description | Business Purpose |
| :--- | :--- | :--- |
| **Total Schools** | Count of all registered school tenants | Gauges overall market adoption |
| **Active Trials** | Schools currently in the 14-day evaluation window | Pipeline for conversion to paid subscriptions |
| **Active Paid** | Schools with verified active paid plans | Recurring revenue base |
| **Grace / Expired** | Schools past due or with suspended access | Identifies accounts needing renewal reminders |
| **Platform Revenue** | Cumulative payments collected across all schools | Tracks monthly/annual SaaS earnings |

---

## 3. Data Structure & School Model

Every school tenant in the database conforms to the following schema:

```typescript
interface SchoolTenant {
  id: string;              // Unique identifier (e.g., 'sch-vikas-001')
  name: string;            // School name (e.g., 'Vikas International Academy')
  subDomain: string;       // Subdomain routing (e.g., 'vikas-intl')
  contactEmail: string;    // Principal / Admin contact email
  studentCount?: number;   // Total enrolled students
  subscription: {
    status: 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED';
    expiryDate: string;    // ISO timestamp of expiration
    plan: {
      name: 'TRIAL' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
      price: number;       // Annual / Monthly fee in INR
    };
  };
}
```

---

## 4. Feature Access Control List (ACL) Modules

The Super Admin can configure which modules are available for each subscription plan tier:

| Module Key | Module Name | Included in Basic | Included in Premium | Included in Enterprise |
| :--- | :--- | :---: | :---: | :---: |
| `admissions` | Admissions & Promotions | ✅ | ✅ | ✅ |
| `attendance` | Attendance (RFID / Manual) | ✅ | ✅ | ✅ |
| `academics` | Grades & Academics | ✅ | ✅ | ✅ |
| `timetable` | Timetable Scheduling | ✅ | ✅ | ✅ |
| `exams` | Exams & GPA Management | ✅ | ✅ | ✅ |
| `billing` | Student Fee Management | ✅ | ✅ | ✅ |
| `teacher_portal` | Teacher Portal Access | ✅ | ✅ | ✅ |
| `library` | Library Management | ❌ | ✅ | ✅ |
| `expenses` | Expense Tracking | ❌ | ✅ | ✅ |
| `transport` | GPS Bus Tracking | ❌ | ✅ | ✅ |
| `parent_portal` | Parent Portal Access | ❌ | ✅ | ✅ |
| `hostel` | Hostel Allocation | ❌ | ❌ | ✅ |
| `payroll` | Staff Payroll Ledger | ❌ | ❌ | ✅ |

---

## 5. File Inventory for Standalone Portal

| Component | File Path | Description |
| :--- | :--- | :--- |
| **Super Admin App Root** | [`edutrack-superadmin-portal/src/app/page.tsx`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/app/page.tsx) | Complete standalone master control dashboard. |
| **Firestore Service** | [`edutrack-superadmin-portal/src/lib/superAdminFirebase.ts`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/lib/superAdminFirebase.ts) | Real-time Firebase Firestore client (`edutrack-52e6c`). |
| **Firebase Config** | [`edutrack-superadmin-portal/src/lib/firebase.ts`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/lib/firebase.ts) | Firebase app initialization. |
| **App Layout** | [`edutrack-superadmin-portal/src/app/layout.tsx`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/app/layout.tsx) | Standalone portal layout. |
| **Global Styles** | [`edutrack-superadmin-portal/src/app/globals.css`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/src/app/globals.css) | Custom styles and glassmorphism tokens. |
| **Configuration** | [`edutrack-superadmin-portal/package.json`](file:///c:/EduTrackSaaS%202027/edutrack-superadmin-portal/package.json) | Standalone npm dependencies and scripts (port `3005`). |

---

## 6. How to Run and Test the Standalone Super Admin Portal

1. Navigate to the standalone directory:
   ```bash
   cd "c:\EduTrackSaaS 2027\edutrack-superadmin-portal"
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open in your browser:
   ```
   http://localhost:3005
   ```
4. You can independently:
   - View real-time school tenants and live counts.
   - Review pending school registration applications.
   - Grant instant +14 days grace extensions and adjust subscription tiers.
   - Dispatch platform broadcast announcements.
   - Configure modular plan feature ACLs and pricing.
   - Manage payment gateways and manual invoices.
