export interface SubscriptionPlanDefinition {
  id: string;
  name: string;
  code: 'FREE_TRIAL' | 'BASIC_HALF_YEARLY' | 'BASIC_ANNUAL';
  durationMonths: number;
  priceInINR: number;
  priceInPaise: number;
  currency: string;
  studentLimit: number | null; // null = unlimited
  staffLimit: number | null;   // null = unlimited
  isTrial: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanDefinition> = {
  FREE_TRIAL: {
    id: 'FREE_TRIAL',
    name: 'Free 1-Month Trial',
    code: 'FREE_TRIAL',
    durationMonths: 1,
    priceInINR: 0,
    priceInPaise: 0,
    currency: 'INR',
    studentLimit: null, // Unlimited
    staffLimit: null,   // Unlimited
    isTrial: true,
    features: [
      'Unlimited Students & Staff Profiles',
      'Full Application Access for 1 Month',
      'Attendance, Fees & Timetable Management',
      'Exams, Grading & Progress Reports',
      'Parent Portal & Notifications',
      'Transport & Bus GPS Tracking',
    ],
  },
  BASIC_HALF_YEARLY: {
    id: 'BASIC_HALF_YEARLY',
    name: 'BASIC PLAN',
    code: 'BASIC_HALF_YEARLY',
    durationMonths: 6,
    priceInINR: 1,
    priceInPaise: 100, // 100 paise = ₹1
    currency: 'INR',
    studentLimit: null, // Unlimited
    staffLimit: null,   // Unlimited
    isTrial: false,
    features: [
      'Unlimited Students & Staff Profiles',
      'Attendance, Fees & Timetable Management',
      'Exams, Grading & Progress Reports',
      'Parent Portal & In-App Notifications',
      'Transport & Bus GPS Tracking',
    ],
  },
  BASIC_ANNUAL: {
    id: 'BASIC_ANNUAL',
    name: 'BASIC PLAN',
    code: 'BASIC_ANNUAL',
    durationMonths: 12,
    priceInINR: 2,
    priceInPaise: 200, // 200 paise = ₹2
    currency: 'INR',
    studentLimit: null, // Unlimited
    staffLimit: null,   // Unlimited
    isTrial: false,
    features: [
      'Unlimited Students & Staff Profiles',
      'Attendance, Fees & Timetable Management',
      'Exams, Grading & Progress Reports',
      'Parent Portal & In-App Notifications',
      'Transport & Bus GPS Tracking',
    ],
  },
};
