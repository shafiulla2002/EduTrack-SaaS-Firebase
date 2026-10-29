import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export interface SchoolTenant {
  id: string;
  name: string;
  subDomain: string;
  contactEmail: string;
  contactPhone?: string;
  adminName?: string;
  studentCount?: number;
  address?: string;
  schoolType?: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'REJECTED' | 'SUSPENDED';
  registrationSource?: 'PORTAL' | 'MANUAL' | 'INVITE';
  createdAt: string;
  approvedAt?: string;
  rejectionReason?: string;
  subscription: {
    status: 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELLED' | 'PENDING_APPROVAL';
    expiryDate: string;
    billingCycle?: string;
    plan: {
      name: 'TRIAL' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
      price: number;
    };
  };
}

export interface PlanTier {
  id: string;
  name: 'TRIAL' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  price: number;
  billingCycle: '14_DAYS' | 'ANNUAL' | 'MONTHLY';
  isActive: boolean;
  features: string[];
}

export interface CommunicationMessage {
  id: string;
  title: string;
  message: string;
  targetSchoolId: string; // 'ALL' or specific school ID
  targetSchoolName?: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  createdAt: string;
  author: string;
}

export interface PlatformInvoice {
  id: string;
  invoiceNumber: string;
  schoolId: string;
  schoolName: string;
  plan: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  dueDate: string;
  createdAt: string;
  gateway: 'RAZORPAY' | 'STRIPE' | 'MANUAL';
  notes?: string;
}

// Initial benchmark dataset used to seed Firestore if empty
export const INITIAL_FIRESTORE_SCHOOLS: SchoolTenant[] = [
  {
    id: 'sch-reg-pending-001',
    name: 'National Public Academy',
    subDomain: 'national-public',
    contactEmail: 'admissions@nationalpublic.org',
    contactPhone: '+91 98765 43210',
    adminName: 'Dr. Ramesh Kumar',
    studentCount: 750,
    address: 'Sector 14, Gurgaon, Haryana',
    schoolType: 'K-12 CBSE Affiliated',
    status: 'PENDING_APPROVAL',
    registrationSource: 'PORTAL',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    subscription: {
      status: 'PENDING_APPROVAL',
      expiryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      billingCycle: '14_DAYS',
      plan: {
        name: 'TRIAL',
        price: 0
      }
    }
  },
  {
    id: 'sch-reg-pending-002',
    name: 'Apex Global High School',
    subDomain: 'apex-global',
    contactEmail: 'principal@apexhigh.edu',
    contactPhone: '+91 98111 22334',
    adminName: 'Smt. Anjali Sharma',
    studentCount: 1120,
    address: 'Whitefield Main Road, Bangalore, Karnataka',
    schoolType: 'ICSE International School',
    status: 'PENDING_APPROVAL',
    registrationSource: 'PORTAL',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    subscription: {
      status: 'PENDING_APPROVAL',
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      billingCycle: 'ANNUAL',
      plan: {
        name: 'PREMIUM',
        price: 49999
      }
    }
  },
  {
    id: 'sch-vikas-001',
    name: 'Vikas International Academy',
    subDomain: 'vikas-intl',
    contactEmail: 'admin@vikasintl.edu',
    contactPhone: '+91 98450 11223',
    adminName: 'Prof. S. N. Vikas',
    studentCount: 1420,
    address: 'Ring Road, Jayanagar, Bangalore',
    schoolType: 'K-12 Private Academy',
    status: 'ACTIVE',
    registrationSource: 'PORTAL',
    createdAt: '2026-05-10T10:00:00Z',
    approvedAt: '2026-05-11T14:30:00Z',
    subscription: {
      status: 'ACTIVE',
      expiryDate: '2027-04-30T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      plan: {
        name: 'PREMIUM',
        price: 49999
      }
    }
  },
  {
    id: 'sch-dhp-002',
    name: 'Delhi Heritage Public School',
    subDomain: 'delhi-heritage',
    contactEmail: 'principal@delhiheritage.ac.in',
    contactPhone: '+91 99100 88776',
    adminName: 'Mrs. Sunita Rao',
    studentCount: 860,
    address: 'Rohini Sector 9, New Delhi',
    schoolType: 'CBSE Senior Secondary',
    status: 'ACTIVE',
    registrationSource: 'PORTAL',
    createdAt: '2026-06-01T09:00:00Z',
    approvedAt: '2026-06-02T11:00:00Z',
    subscription: {
      status: 'ACTIVE',
      expiryDate: '2026-12-15T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      plan: {
        name: 'BASIC',
        price: 24999
      }
    }
  },
  {
    id: 'sch-sxg-003',
    name: 'St. Xavier Global High School',
    subDomain: 'stxavier-global',
    contactEmail: 'management@stxavierglobal.org',
    contactPhone: '+91 97234 55667',
    adminName: 'Father Thomas Pereira',
    studentCount: 2200,
    address: 'Bandra West, Mumbai, Maharashtra',
    schoolType: 'Christian Minority ICSE School',
    status: 'ACTIVE',
    registrationSource: 'PORTAL',
    createdAt: '2026-04-15T08:00:00Z',
    approvedAt: '2026-04-16T10:00:00Z',
    subscription: {
      status: 'ACTIVE',
      expiryDate: '2027-08-31T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      plan: {
        name: 'ENTERPRISE',
        price: 74999
      }
    }
  },
  {
    id: 'sch-sun-004',
    name: 'Sunrise Model Academy',
    subDomain: 'sunrisemodel',
    contactEmail: 'info@sunrisemodel.edu',
    contactPhone: '+91 98877 66554',
    adminName: 'Mr. Arvind Saxena',
    studentCount: 340,
    address: 'Malviya Nagar, Jaipur, Rajasthan',
    schoolType: 'State Board Elementary',
    status: 'ACTIVE',
    registrationSource: 'PORTAL',
    createdAt: '2026-10-15T12:00:00Z',
    approvedAt: '2026-10-16T15:00:00Z',
    subscription: {
      status: 'ACTIVE',
      expiryDate: '2026-11-20T00:00:00.000Z',
      billingCycle: '14_DAYS',
      plan: {
        name: 'TRIAL',
        price: 0
      }
    }
  },
  {
    id: 'sch-oak-005',
    name: 'Oakridge Valley School',
    subDomain: 'oakridge-valley',
    contactEmail: 'accounts@oakridgevalley.edu',
    contactPhone: '+91 99001 22334',
    adminName: 'Col. Rajesh Bakshi',
    studentCount: 1100,
    address: 'Gachibowli, Hyderabad, Telangana',
    schoolType: 'International Baccalaureate (IB)',
    status: 'PAST_DUE',
    registrationSource: 'PORTAL',
    createdAt: '2025-10-20T10:00:00Z',
    approvedAt: '2025-10-21T11:00:00Z',
    subscription: {
      status: 'PAST_DUE',
      expiryDate: '2026-10-20T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      plan: {
        name: 'PREMIUM',
        price: 49999
      }
    }
  },
  {
    id: 'sch-bvs-006',
    name: 'Bharatiya Vidya Niketan',
    subDomain: 'bvn-school',
    contactEmail: 'bvn.school@gmail.com',
    contactPhone: '+91 94433 22110',
    adminName: 'Acharya Vidyadhar',
    studentCount: 520,
    address: 'Shivaji Nagar, Pune, Maharashtra',
    schoolType: 'State Board Secondary',
    status: 'EXPIRED',
    registrationSource: 'PORTAL',
    createdAt: '2025-09-01T09:00:00Z',
    approvedAt: '2025-09-02T10:00:00Z',
    subscription: {
      status: 'EXPIRED',
      expiryDate: '2026-09-30T00:00:00.000Z',
      billingCycle: 'ANNUAL',
      plan: {
        name: 'BASIC',
        price: 24999
      }
    }
  }
];

export const INITIAL_FIRESTORE_PLANS: PlanTier[] = [
  {
    id: 'plan-trial',
    name: 'TRIAL',
    price: 0,
    billingCycle: '14_DAYS',
    isActive: true,
    features: ['admissions', 'attendance', 'academics', 'grades']
  },
  {
    id: 'plan-basic',
    name: 'BASIC',
    price: 24999,
    billingCycle: 'ANNUAL',
    isActive: true,
    features: ['admissions', 'attendance', 'timetable', 'exams', 'billing', 'academics', 'teacher_portal']
  },
  {
    id: 'plan-premium',
    name: 'PREMIUM',
    price: 49999,
    billingCycle: 'ANNUAL',
    isActive: true,
    features: [
      'admissions',
      'attendance',
      'timetable',
      'exams',
      'billing',
      'library',
      'expenses',
      'academics',
      'transport',
      'teacher_portal',
      'parent_portal'
    ]
  },
  {
    id: 'plan-enterprise',
    name: 'ENTERPRISE',
    price: 74999,
    billingCycle: 'ANNUAL',
    isActive: true,
    features: [
      'admissions',
      'attendance',
      'timetable',
      'exams',
      'billing',
      'library',
      'expenses',
      'academics',
      'transport',
      'hostel',
      'payroll',
      'teacher_portal',
      'parent_portal'
    ]
  }
];

export const INITIAL_FIRESTORE_COMMS: CommunicationMessage[] = [
  {
    id: 'comm-101',
    title: 'Platform Maintenance & Upgrade Notice',
    message: 'Scheduled cloud database index optimization will occur this Sunday from 02:00 AM to 03:30 AM IST. All school services will remain fully functional.',
    targetSchoolId: 'ALL',
    targetSchoolName: 'All Registered Schools',
    priority: 'NORMAL',
    channel: 'IN_APP',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    author: 'Super Admin'
  },
  {
    id: 'comm-102',
    title: 'New Feature Rollout: Real-time Parent UPI Fee Receipts',
    message: 'We have enabled automated instant WhatsApp/Email PDF receipts for all parents paying via Razorpay gateway. Ensure school bank accounts are verified.',
    targetSchoolId: 'ALL',
    targetSchoolName: 'All Registered Schools',
    priority: 'HIGH',
    channel: 'IN_APP',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    author: 'Super Admin'
  }
];

export const INITIAL_FIRESTORE_INVOICES: PlatformInvoice[] = [
  {
    id: 'inv-101',
    invoiceNumber: 'INV-2026-0081',
    schoolId: 'sch-vikas-001',
    schoolName: 'Vikas International Academy',
    plan: 'PREMIUM',
    amount: 49999,
    status: 'PAID',
    dueDate: '2026-10-31',
    createdAt: '2026-10-24T10:30:00Z',
    gateway: 'RAZORPAY'
  },
  {
    id: 'inv-102',
    invoiceNumber: 'INV-2026-0082',
    schoolId: 'sch-dhp-002',
    schoolName: 'Delhi Heritage Public School',
    plan: 'BASIC',
    amount: 24999,
    status: 'PAID',
    dueDate: '2026-10-28',
    createdAt: '2026-10-22T14:15:00Z',
    gateway: 'RAZORPAY'
  },
  {
    id: 'inv-103',
    invoiceNumber: 'INV-2026-0083',
    schoolId: 'sch-sxg-003',
    schoolName: 'St. Xavier Global High School',
    plan: 'ENTERPRISE',
    amount: 74999,
    status: 'PAID',
    dueDate: '2026-10-25',
    createdAt: '2026-10-19T09:45:00Z',
    gateway: 'STRIPE'
  },
  {
    id: 'inv-104',
    invoiceNumber: 'INV-2026-0084',
    schoolId: 'sch-oak-005',
    schoolName: 'Oakridge Valley School',
    plan: 'PREMIUM',
    amount: 49999,
    status: 'OVERDUE',
    dueDate: '2026-10-20',
    createdAt: '2026-10-10T16:20:00Z',
    gateway: 'RAZORPAY'
  }
];

/**
 * Seed initial Firestore collections if they are empty
 */
export async function seedInitialSuperAdminData(): Promise<void> {
  try {
    const schoolsSnap = await getDocs(collection(db, 'schools'));
    if (schoolsSnap.empty) {
      console.log('[Firebase SuperAdmin] Seeding initial schools collection...');
      const batch = writeBatch(db);
      for (const s of INITIAL_FIRESTORE_SCHOOLS) {
        batch.set(doc(db, 'schools', s.id), s);
      }
      await batch.commit();
    }

    const plansSnap = await getDocs(collection(db, 'plans'));
    if (plansSnap.empty) {
      console.log('[Firebase SuperAdmin] Seeding initial plans collection...');
      const batch = writeBatch(db);
      for (const p of INITIAL_FIRESTORE_PLANS) {
        batch.set(doc(db, 'plans', p.id), p);
      }
      await batch.commit();
    }

    const commsSnap = await getDocs(collection(db, 'communications'));
    if (commsSnap.empty) {
      console.log('[Firebase SuperAdmin] Seeding initial communications collection...');
      const batch = writeBatch(db);
      for (const c of INITIAL_FIRESTORE_COMMS) {
        batch.set(doc(db, 'communications', c.id), c);
      }
      await batch.commit();
    }

    const invSnap = await getDocs(collection(db, 'invoices'));
    if (invSnap.empty) {
      console.log('[Firebase SuperAdmin] Seeding initial invoices collection...');
      const batch = writeBatch(db);
      for (const inv of INITIAL_FIRESTORE_INVOICES) {
        batch.set(doc(db, 'invoices', inv.id), inv);
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('[Firebase SuperAdmin] Auto-seed check finished with note:', err);
  }
}

/**
 * Real-time listener for Schools collection
 */
export function subscribeToSchools(
  onData: (schools: SchoolTenant[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, 'schools');
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        // If empty on first read, trigger background seed and provide fallback initial dataset
        seedInitialSuperAdminData().catch(() => {});
        onData(INITIAL_FIRESTORE_SCHOOLS);
        return;
      }

      const list: SchoolTenant[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || data.schoolName || 'Unnamed Institution',
          subDomain: data.subDomain || data.subdomain || docSnap.id,
          contactEmail: data.contactEmail || data.email || 'admin@school.edu',
          contactPhone: data.contactPhone || data.mobileNumber || '',
          adminName: data.adminName || 'Principal',
          studentCount: Number(data.studentCount || 0),
          address: data.address || '',
          schoolType: data.schoolType || 'General Academy',
          status: data.status || 'ACTIVE',
          registrationSource: data.registrationSource || 'PORTAL',
          createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : new Date(data.createdAt.seconds * 1000).toISOString()) : new Date().toISOString(),
          approvedAt: data.approvedAt ? (typeof data.approvedAt === 'string' ? data.approvedAt : new Date(data.approvedAt.seconds * 1000).toISOString()) : undefined,
          rejectionReason: data.rejectionReason,
          subscription: {
            status: data.subscription?.status || (data.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'ACTIVE'),
            expiryDate: data.subscription?.expiryDate || new Date(Date.now() + 365 * 86400000).toISOString(),
            billingCycle: data.subscription?.billingCycle || 'ANNUAL',
            plan: {
              name: data.subscription?.plan?.name || 'BASIC',
              price: Number(data.subscription?.plan?.price || 24999)
            }
          }
        });
      });

      // Sort with PENDING_APPROVAL first, then newest registered
      list.sort((a, b) => {
        if (a.status === 'PENDING_APPROVAL' && b.status !== 'PENDING_APPROVAL') return -1;
        if (b.status === 'PENDING_APPROVAL' && a.status !== 'PENDING_APPROVAL') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      onData(list);
    },
    (err) => {
      console.warn('[Firebase SuperAdmin] Schools subscription error, using cached fallback:', err);
      if (onError) onError(err);
      onData(INITIAL_FIRESTORE_SCHOOLS);
    }
  );
}

/**
 * Approve a pending school registration in Firebase Firestore
 */
export async function approveSchoolRegistration(
  schoolId: string,
  planName: 'TRIAL' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE' = 'BASIC',
  durationMonths: number = 12
): Promise<void> {
  const schoolRef = doc(db, 'schools', schoolId);
  const now = new Date();
  const expiry = new Date(now.getTime() + (planName === 'TRIAL' ? 14 : durationMonths * 30) * 86400000);

  const priceMap: Record<string, number> = {
    TRIAL: 0,
    BASIC: 24999,
    PREMIUM: 49999,
    ENTERPRISE: 74999
  };

  await updateDoc(schoolRef, {
    status: 'ACTIVE',
    approvedAt: now.toISOString(),
    approvedBy: 'Super Admin',
    subscription: {
      status: 'ACTIVE',
      expiryDate: expiry.toISOString(),
      billingCycle: planName === 'TRIAL' ? '14_DAYS' : 'ANNUAL',
      plan: {
        name: planName,
        price: priceMap[planName] || 0
      }
    }
  });

  // Also log approval announcement in communications
  try {
    await sendSchoolCommunication({
      title: 'Registration Approved & Instance Provisioned',
      message: `Your school instance (${schoolId}) has been officially verified and activated with the ${planName} plan tier.`,
      targetSchoolId: schoolId,
      priority: 'HIGH',
      channel: 'IN_APP'
    });
  } catch (err) {
    console.warn('Communication log error:', err);
  }
}

/**
 * Reject a school registration with a reason
 */
export async function rejectSchoolRegistration(
  schoolId: string,
  reason: string
): Promise<void> {
  const schoolRef = doc(db, 'schools', schoolId);
  await updateDoc(schoolRef, {
    status: 'REJECTED',
    rejectionReason: reason || 'Application details could not be verified by compliance.',
    rejectedAt: new Date().toISOString(),
    subscription: {
      status: 'CANCELLED',
      expiryDate: new Date().toISOString(),
      plan: {
        name: 'TRIAL',
        price: 0
      }
    }
  });
}

/**
 * Update school subscription parameters (tier, expiry date, status) in Firestore
 */
export async function updateSchoolSubscription(
  schoolId: string,
  updates: {
    planName?: 'TRIAL' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
    expiryDate?: string;
    status?: 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'PENDING_APPROVAL' | 'SUSPENDED';
    studentCount?: number;
  }
): Promise<void> {
  const schoolRef = doc(db, 'schools', schoolId);
  const payload: any = {};

  if (updates.status) {
    payload.status = updates.status;
  }
  if (updates.studentCount !== undefined) {
    payload.studentCount = updates.studentCount;
  }

  const priceMap: Record<string, number> = {
    TRIAL: 0,
    BASIC: 24999,
    PREMIUM: 49999,
    ENTERPRISE: 74999
  };

  if (updates.planName || updates.expiryDate || updates.status) {
    payload.subscription = {
      status: updates.status || 'ACTIVE',
      expiryDate: updates.expiryDate || new Date(Date.now() + 365 * 86400000).toISOString(),
      billingCycle: updates.planName === 'TRIAL' ? '14_DAYS' : 'ANNUAL',
      plan: {
        name: updates.planName || 'BASIC',
        price: priceMap[updates.planName || 'BASIC'] || 24999
      }
    };
  }

  await updateDoc(schoolRef, payload);
}

/**
 * Extend a school's trial or subscription validity by days
 */
export async function extendSchoolValidity(
  schoolId: string,
  additionalDays: number = 14
): Promise<void> {
  const schoolRef = doc(db, 'schools', schoolId);
  const newExpiry = new Date(Date.now() + additionalDays * 86400000).toISOString();

  await updateDoc(schoolRef, {
    status: 'ACTIVE',
    'subscription.status': 'ACTIVE',
    'subscription.expiryDate': newExpiry
  });
}

/**
 * Real-time listener for Plans collection
 */
export function subscribeToPlans(
  onData: (plans: PlanTier[]) => void
): () => void {
  const q = collection(db, 'plans');
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(INITIAL_FIRESTORE_PLANS);
        return;
      }
      const list: PlanTier[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          name: d.name || 'BASIC',
          price: Number(d.price || 0),
          billingCycle: d.billingCycle || 'ANNUAL',
          isActive: d.isActive ?? true,
          features: Array.isArray(d.features) ? d.features : []
        });
      });
      onData(list);
    },
    () => {
      onData(INITIAL_FIRESTORE_PLANS);
    }
  );
}

/**
 * Update plan pricing and ACL feature flags in Firestore
 */
export async function updatePlanSettings(
  planId: string,
  price: number,
  features: string[],
  isActive: boolean
): Promise<void> {
  const planRef = doc(db, 'plans', planId);
  await updateDoc(planRef, {
    price,
    features,
    isActive,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Real-time listener for Communications collection
 */
export function subscribeToCommunications(
  onData: (comms: CommunicationMessage[]) => void
): () => void {
  const q = collection(db, 'communications');
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(INITIAL_FIRESTORE_COMMS);
        return;
      }
      const list: CommunicationMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          title: d.title || 'Platform Notice',
          message: d.message || '',
          targetSchoolId: d.targetSchoolId || 'ALL',
          targetSchoolName: d.targetSchoolName || 'All Registered Schools',
          priority: d.priority || 'NORMAL',
          channel: d.channel || 'IN_APP',
          createdAt: d.createdAt || new Date().toISOString(),
          author: d.author || 'Super Admin'
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    () => {
      onData(INITIAL_FIRESTORE_COMMS);
    }
  );
}

/**
 * Send a broadcast or direct school communication
 */
export async function sendSchoolCommunication(payload: {
  title: string;
  message: string;
  targetSchoolId?: string;
  targetSchoolName?: string;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  channel?: 'IN_APP' | 'EMAIL' | 'SMS';
}): Promise<void> {
  const commId = 'comm-' + Date.now();
  const commDoc: CommunicationMessage = {
    id: commId,
    title: payload.title,
    message: payload.message,
    targetSchoolId: payload.targetSchoolId || 'ALL',
    targetSchoolName: payload.targetSchoolName || (payload.targetSchoolId === 'ALL' ? 'All Registered Schools' : 'Designated School'),
    priority: payload.priority || 'NORMAL',
    channel: payload.channel || 'IN_APP',
    createdAt: new Date().toISOString(),
    author: 'Super Admin'
  };

  await setDoc(doc(db, 'communications', commId), commDoc);
}

/**
 * Real-time listener for Invoices collection
 */
export function subscribeToInvoices(
  onData: (invoices: PlatformInvoice[]) => void
): () => void {
  const q = collection(db, 'invoices');
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(INITIAL_FIRESTORE_INVOICES);
        return;
      }
      const list: PlatformInvoice[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          invoiceNumber: d.invoiceNumber || `INV-${docSnap.id.slice(-4)}`,
          schoolId: d.schoolId || '',
          schoolName: d.schoolName || 'Unknown School',
          plan: d.plan || 'BASIC',
          amount: Number(d.amount || 0),
          status: d.status || 'PENDING',
          dueDate: d.dueDate || '',
          createdAt: d.createdAt || new Date().toISOString(),
          gateway: d.gateway || 'RAZORPAY',
          notes: d.notes
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    () => {
      onData(INITIAL_FIRESTORE_INVOICES);
    }
  );
}

/**
 * Create a manual platform invoice
 */
export async function createPlatformInvoice(invoice: {
  schoolId: string;
  schoolName: string;
  plan: string;
  amount: number;
  dueDate: string;
  notes?: string;
}): Promise<void> {
  const id = 'inv-' + Date.now();
  const invNumber = 'INV-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  const newInvoice: PlatformInvoice = {
    id,
    invoiceNumber: invNumber,
    schoolId: invoice.schoolId,
    schoolName: invoice.schoolName,
    plan: invoice.plan,
    amount: invoice.amount,
    status: 'PENDING',
    dueDate: invoice.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    gateway: 'MANUAL',
    notes: invoice.notes
  };

  await setDoc(doc(db, 'invoices', id), newInvoice);
}
