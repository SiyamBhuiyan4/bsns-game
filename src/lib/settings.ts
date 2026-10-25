import { z } from 'zod';

export const DEFAULT_SECTION_WEIGHTS = {
  SALES_PROFIT: 30,
  CONTENT: 20,
  NEW_BUYERS_B2B: 20,
  RETENTION: 15,
  INBOX_FOLLOWUP: 15,
};

export const DEFAULT_SETTINGS = {
  id: 'default',
  section_weights: DEFAULT_SECTION_WEIGHTS,
  achievement_cap: 1.0,
  failing_threshold: 0.8,
  undo_enabled: true,
  employee_edit_window_days: 1,
  weekly_report_day: 'SUNDAY',
  weekly_report_time: '09:00',
  language_default: 'bn',
  digit_style: 'bn',
};

export const sectionWeightsSchema = z
  .object({
    SALES_PROFIT: z.number().min(0, 'SALES_PROFIT ০ বা তার বেশি হতে হবে'),
    CONTENT: z.number().min(0, 'CONTENT ০ বা তার বেশি হতে হবে'),
    NEW_BUYERS_B2B: z.number().min(0, 'NEW_BUYERS_B2B ০ বা তার বেশি হতে হবে'),
    RETENTION: z.number().min(0, 'RETENTION ০ বা তার বেশি হতে হবে'),
    INBOX_FOLLOWUP: z.number().min(0, 'INBOX_FOLLOWUP ০ বা তার বেশি হতে হবে'),
  })
  .refine(
    (weights) => {
      const sum =
        weights.SALES_PROFIT +
        weights.CONTENT +
        weights.NEW_BUYERS_B2B +
        weights.RETENTION +
        weights.INBOX_FOLLOWUP;
      return Math.abs(sum - 100) < 0.0001;
    },
    {
      message: 'সেকশন ওয়েটগুলোর যোগফল অবশ্যই ঠিক ১০০ হতে হবে (Sum of section weights must be exactly 100)',
      path: ['sum'],
    }
  );

export const updateSettingsSchema = z.object({
  section_weights: sectionWeightsSchema.optional(),
  achievement_cap: z
    .number()
    .positive('অ্যাচিভমেন্ট ক্যাপ ০ এর বেশি হতে হবে (Achievement cap must be greater than 0)')
    .optional(),
  failing_threshold: z
    .number()
    .min(0, 'ফেইলিং থ্রেশহোল্ড ০ বা তার বেশি হতে হবে')
    .max(1, 'ফেইলিং থ্রেশহোল্ড ১ বা তার কম হতে হবে')
    .optional(),
  undo_enabled: z.boolean().optional(),
  employee_edit_window_days: z
    .number()
    .int('এডিট উইন্ডো পূর্ণসংখ্যা হতে হবে')
    .min(0, 'এডিট উইন্ডো ০ বা তার বেশি হতে হবে')
    .optional(),
  weekly_report_day: z.string().min(1, 'সাপ্তাহিক রিপোর্ট দিন আবশ্যক').optional(),
  weekly_report_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'সময় HH:MM ফরম্যাটে দিন (যেমন: 09:00)')
    .optional(),
  language_default: z.string().min(2, 'ডিফল্ট ভাষা আবশ্যক').optional(),
  digit_style: z.string().min(2, 'ডিজিট স্টাইল আবশ্যক').optional(),
});
