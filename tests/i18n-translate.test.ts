import { describe, it, expect } from 'vitest';
import { translate } from '@/lib/i18n/translate';

describe('translate', () => {
  it('translates an exact dictionary hit', () => {
    expect(translate('নেটওয়ার্ক ত্রুটি', 'en')).toBe('Network error');
  });
  it('leaves Bangla alone when the language is Bangla', () => {
    expect(translate('নেটওয়ার্ক ত্রুটি', 'bn')).toBe('নেটওয়ার্ক ত্রুটি');
  });
  it('fills a server-built message back into its English template', () => {
    expect(translate('৫টি নির্বাচিত', 'en')).toBe('5 selected');
    expect(translate('মার্কেটিং টিম সেকশনে গ্রুপ লিংক আপলোড করুন · সর্বোচ্চ ৫ MB, ১০,০০০ সারি', 'en'))
      .toBe('Upload group links to section মার্কেটিং টিম · max 5 MB, 10,000 rows');
  });
  it('uses the English written inline in the source string', () => {
    expect(translate('অনুমতি নেই / Unauthorized', 'en')).toBe('Unauthorized');
    expect(translate('নতুন সেকশন সফলভাবে তৈরি হয়েছে (Section created successfully)', 'en'))
      .toBe('Section created successfully');
  });
  it('falls back to the original when nothing is known', () => {
    expect(translate('এটি অভিধানে নেই', 'en')).toBe('এটি অভিধানে নেই');
  });
  it('passes through empty and nullish values', () => {
    expect(translate('', 'en')).toBe('');
    expect(translate(null, 'en')).toBe('');
    expect(translate(undefined, 'en')).toBe('');
  });
});
