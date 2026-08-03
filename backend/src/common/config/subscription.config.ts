import { PlanType } from '@prisma/client';

export const PLAN_FEATURES: Record<PlanType, string[]> = {
  [PlanType.TRIAL]: ['admissions', 'attendance', 'timetable', 'exams', 'billing'],
  [PlanType.BASIC]: [
    'admissions', 'attendance', 'timetable', 'exams', 'billing',
    'library', 'expenses', 'academics'
  ],
  [PlanType.PREMIUM]: [
    'admissions', 'attendance', 'timetable', 'exams', 'billing',
    'library', 'expenses', 'academics',
    'transport', 'hostel', 'payroll', 'notifications_websockets',
    'parent_portal', 'teacher_portal'
  ]
};
