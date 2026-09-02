export interface SubscriptionPlanItem {
  id: string;
  name: string;
  code: 'FREE_TRIAL' | 'BASIC_HALF_YEARLY' | 'BASIC_ANNUAL';
  durationMonths: number;
  priceInINR: number;
  currency: string;
  studentLimit: number | null;
  staffLimit: number | null;
  isTrial: boolean;
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanItem> = {
  FREE_TRIAL: {
    id: 'FREE_TRIAL',
    name: 'Free 1-Month Trial',
    code: 'FREE_TRIAL',
    durationMonths: 1,
    priceInINR: 0,
    currency: 'INR',
    studentLimit: null,
    staffLimit: null,
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
    currency: 'INR',
    studentLimit: null,
    staffLimit: null,
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
    currency: 'INR',
    studentLimit: null,
    staffLimit: null,
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
