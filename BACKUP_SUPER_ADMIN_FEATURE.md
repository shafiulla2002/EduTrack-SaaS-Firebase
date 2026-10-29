# EduTrack SaaS — Super Admin Feature & Multi-Tenant Architecture

> **Backup & Feature Specification Document**  
> **Route URL:** `/dashboard/backup-super-admin` & `/dashboard/super-admin`  
> **Interactive Preview File:** [`frontend/src/app/dashboard/backup-super-admin/page.tsx`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/frontend/src/app/dashboard/backup-super-admin/page.tsx)  
> **Production File:** [`frontend/src/app/dashboard/super-admin/page.tsx`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/frontend/src/app/dashboard/super-admin/page.tsx)

---

## 1. Overview of the Super Admin Portal

The **Super Admin Portal** is the centralized master dashboard of the EduTrack SaaS platform. While individual school principals, teachers, and accountants only have access to their own school's dashboard, the **Super Admin** oversees the entire multi-tenant infrastructure across all schools.

### Key Capabilities:
1. **Multi-Tenant School Tracking:** Monitor every school using the platform, their custom subdomain (`<subdomain>.edutrack.com`), contact emails, student headcounts, and activation dates.
2. **Subscription Management:** View active subscription plans (`TRIAL`, `BASIC`, `PREMIUM`, `ENTERPRISE`), validity dates, and subscription statuses (`ACTIVE`, `PAST_DUE`, `EXPIRED`, `CANCELLED`).
3. **Manual Overrides:** Instantly extend a school's trial, renew their plan, change their tier, or suspend/reactivate access with one click.
4. **Modular Feature ACL (Access Control):** Toggle specific functional modules (e.g., GPS Transport, Hostel, Payroll, RFID Attendance) on or off per plan tier.
5. **Billing & Manual Invoicing:** Issue custom invoices directly to school administrators and log recurring payment gateway transactions.
6. **Platform Gateways & Tax Rules:** Manage Razorpay and Stripe API keys, GST percentage, currency (`INR`), and platform branding.

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

> **Automated Lockout Mechanism:**  
> When a school's subscription expires (`EXPIRED`), the application dashboard displays a full-screen grace/renewal warning, preventing teachers and drivers from using system features until renewed by Super Admin or online payment.

---

## 5. File Inventory in this Repository

| Component | File Path | Description |
| :--- | :--- | :--- |
| **Backup / Interactive Preview** | [`frontend/src/app/dashboard/backup-super-admin/page.tsx`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/frontend/src/app/dashboard/backup-super-admin/page.tsx) | **Self-contained interactive replica** with mock data and full UI testing capabilities. |
| **Live Super Admin Page** | [`frontend/src/app/dashboard/super-admin/page.tsx`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/frontend/src/app/dashboard/super-admin/page.tsx) | Production page connected to NestJS backend endpoints. |
| **Payment Settings Page** | [`frontend/src/app/dashboard/super-admin/payment-settings/page.tsx`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/frontend/src/app/dashboard/super-admin/payment-settings/page.tsx) | Configures company GST, bank accounts, UPI IDs, and invoice numbering. |
| **Sidebar Navigation** | [`frontend/src/app/dashboard/layout.tsx`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/frontend/src/app/dashboard/layout.tsx#L539-L562) | Displays the Super Admin links when the user role is `SUPER_ADMIN`. |
| **Platform Controller** | [`backend/src/modules/platform-admin/platform-admin.controller.ts`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/backend/src/modules/platform-admin/platform-admin.controller.ts) | Backend REST controller for `/api/platform-admin/*` routes. |
| **Platform Service** | [`backend/src/modules/platform-admin/platform-admin.service.ts`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/backend/src/modules/platform-admin/platform-admin.service.ts) | Business logic for metrics, schools list, and plans. |
| **Subscription Module** | [`backend/src/modules/subscription/subscription.service.ts`](file:///c:/VikasSchool/EduTrack-SaaS-Independent/backend/src/modules/subscription/subscription.service.ts) | Subscription lifecycle and gateway webhooks. |

---

## 6. How to View and Test the Backup Super Admin Feature

1. Ensure the frontend dev server is running (e.g. `npm run dev` in `c:\VikasSchool\EduTrack-SaaS-Independent\frontend`).
2. Navigate directly to:
   ```
   http://localhost:3000/dashboard/backup-super-admin
   ```
3. You will be able to:
   - View the metric cards and interactive school tenant table.
   - Click **"Adjust Plan"** on any school to test modifying plans, expiry dates, or statuses.
   - Switch to **"Plans & Feature ACLs"** to test toggling feature flags and pricing.
   - Switch to **"Invoices & Payment Log"** to generate test invoices.
   - Switch to **"Payment Gateways & Settings"** to review gateway settings.
   - Click **"Reset Demo Data"** at any point to restore original mock values.
