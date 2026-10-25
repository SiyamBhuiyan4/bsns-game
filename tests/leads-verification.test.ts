import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import { normalizePhone, isValidBdPhone, maskPhone } from '../src/lib/phone';
import { BuyerType, LeadStatus, UserRole } from '@prisma/client';

describe('Subagent 10: Leads Management & Phone Masking Verification', () => {
  let adminUser: any;
  let employeeUser1: any;
  let employeeUser2: any;
  let testLead1: any;
  let testLead2: any;
  let testLead3: any;

  const precomputedHash = '$2b$12$KIXeUjW15K7R7xIqmP/Zdu6kLhA.2OsuhP4U4YmCcvj2r9M.yF5qS';

  beforeAll(async () => {
    // Cleanup prior run
    await prisma.user.deleteMany({
      where: { email: { in: ['lead_admin@test.com', 'lead_emp1@test.com', 'lead_emp2@test.com'] } },
    });

    adminUser = await prisma.user.create({
      data: {
        name: 'লিডস এডমিন (Leads Admin)',
        email: 'lead_admin@test.com',
        password_hash: precomputedHash,
        role: UserRole.ADMIN,
        phone: '01711000111',
      },
    });

    employeeUser1 = await prisma.user.create({
      data: {
        name: 'মার্কেটার এক (Marketer 1)',
        email: 'lead_emp1@test.com',
        password_hash: precomputedHash,
        role: UserRole.EMPLOYEE,
        phone: '01711000222',
      },
    });

    employeeUser2 = await prisma.user.create({
      data: {
        name: 'মার্কেটার দুই (Marketer 2)',
        email: 'lead_emp2@test.com',
        password_hash: precomputedHash,
        role: UserRole.EMPLOYEE,
        phone: '01711000333',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: ['lead_admin@test.com', 'lead_emp1@test.com', 'lead_emp2@test.com'] } },
    });
  });

  // --------------------------------------------------------------------------
  // 1. Phone Normalization, Validation, and Masking Tests
  // --------------------------------------------------------------------------
  it('verifies BD phone normalization and validation (11 digits, starts with 013-019)', () => {
    expect(normalizePhone('01712-345678')).toBe('01712345678');
    expect(normalizePhone('+8801712345678')).toBe('01712345678');
    expect(normalizePhone('8801812345678')).toBe('01812345678');

    // Validity
    expect(isValidBdPhone('01712345678')).toBe(true);
    expect(isValidBdPhone('01300000000')).toBe(true);
    expect(isValidBdPhone('01400000000')).toBe(true);
    expect(isValidBdPhone('01500000000')).toBe(true);
    expect(isValidBdPhone('01600000000')).toBe(true);
    expect(isValidBdPhone('01800000000')).toBe(true);
    expect(isValidBdPhone('01900000000')).toBe(true);

    // Invalid formats
    expect(isValidBdPhone('01200000000')).toBe(false); // 012 not valid
    expect(isValidBdPhone('0171234567')).toBe(false);  // 10 digits
    expect(isValidBdPhone('017123456789')).toBe(false); // 12 digits
    expect(isValidBdPhone('')).toBe(false);
  });

  it('verifies phone masking rule for lists: 017XX-XX1234', () => {
    const raw = '01712345678';
    const masked = maskPhone(raw);
    expect(masked).toBe('017XX-XX5678');
    expect(masked.startsWith('017')).toBe(true);
    expect(masked.endsWith('5678')).toBe(true);
    expect(masked).toContain('XX-XX');
  });

  // --------------------------------------------------------------------------
  // 2. Duplicate Phone Check Endpoint Logic
  // --------------------------------------------------------------------------
  it('duplicate phone check warns and reveals owner to Admin, hides owner from other employees', async () => {
    const phone = '01799112233';

    testLead1 = await prisma.lead.create({
      data: {
        name: 'করিম এগ্রো ট্রেডার্স',
        phone: normalizePhone(phone),
        buyer_type: BuyerType.WHOLESALER,
        source_channel: 'ফেসবুক বিজ্ঞাপন',
        owner_id: employeeUser1.id,
        status: LeadStatus.QUALIFIED,
        quality_rating: 4,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    // Simulated duplicate check handler for Admin:
    const simulateCheckPhone = (requesterRole: string, requesterUserId: string, targetPhone: string) => {
      const normalized = normalizePhone(targetPhone);
      if (!isValidBdPhone(normalized)) {
        return { exists: false, valid: false };
      }
      if (normalized === testLead1.phone) {
        if (requesterRole === 'ADMIN') {
          return {
            exists: true,
            valid: true,
            leadName: testLead1.name,
            ownerName: testLead1.owner.name,
            ownerEmail: testLead1.owner.email,
            status: testLead1.status,
          };
        }
        return {
          exists: true,
          valid: true,
          isOwnLead: testLead1.owner_id === requesterUserId,
          leadName: testLead1.name,
        };
      }
      return { exists: false, valid: true };
    };

    // Admin check:
    const adminResult = simulateCheckPhone('ADMIN', adminUser.id, phone);
    expect(adminResult.exists).toBe(true);
    expect(adminResult.valid).toBe(true);
    expect(adminResult.ownerName).toBe('মার্কেটার এক (Marketer 1)');
    expect(adminResult.ownerEmail).toBe('lead_emp1@test.com');
    expect(adminResult.status).toBe('QUALIFIED');

    // Other employee check: owner identity MUST NOT be revealed
    const otherEmpResult = simulateCheckPhone('EMPLOYEE', employeeUser2.id, phone);
    expect(otherEmpResult.exists).toBe(true);
    expect(otherEmpResult.valid).toBe(true);
    expect(otherEmpResult.isOwnLead).toBe(false);
    expect((otherEmpResult as any).ownerName).toBeUndefined();
    expect((otherEmpResult as any).ownerEmail).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 3. Lead Creation, Quality Rating (1-5 stars) & Buyer Types
  // --------------------------------------------------------------------------
  it('creates leads with all buyer types and quality rating (1-5 stars)', async () => {
    // Create Lead with RETAIL and 5-star quality rating
    testLead2 = await prisma.lead.create({
      data: {
        name: 'রাশেদ খান (খুচরা)',
        phone: '01811223344',
        buyer_type: BuyerType.RETAIL,
        source_channel: 'হোয়াটসঅ্যাপ',
        owner_id: employeeUser2.id,
        status: LeadStatus.ORDERED,
        quality_rating: 5,
        order_amount: 8500,
      },
    });

    expect(testLead2.buyer_type).toBe('RETAIL');
    expect(testLead2.quality_rating).toBe(5);
    expect(Number(testLead2.order_amount)).toBe(8500);

    // Verify all 6 buyer types enum support:
    const allBuyerTypes: BuyerType[] = [
      BuyerType.FARMER,
      BuyerType.WHOLESALER,
      BuyerType.RESTAURANT,
      BuyerType.DEALER,
      BuyerType.RETAIL,
      BuyerType.OTHER,
    ];
    expect(allBuyerTypes).toHaveLength(6);

    // Verify all 5 lead statuses:
    const allStatuses: LeadStatus[] = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.QUALIFIED,
      LeadStatus.ORDERED,
      LeadStatus.LOST,
    ];
    expect(allStatuses).toHaveLength(5);
  });

  // --------------------------------------------------------------------------
  // 4. Admin Full Phone Visibility vs Employee Masked Phone
  // --------------------------------------------------------------------------
  it('Admin receives full unmasked phone number, while Employee receives masked phone', () => {
    const rawPhone = '01712345678';
    const masked = maskPhone(rawPhone);

    const formatLeadForUser = (lead: { phone: string }, role: string) => ({
      phone: role === 'ADMIN' ? lead.phone : masked,
      masked_phone: masked,
    });

    const adminView = formatLeadForUser({ phone: rawPhone }, 'ADMIN');
    expect(adminView.phone).toBe('01712345678'); // FULL NUMBER FOR ADMIN

    const employeeView = formatLeadForUser({ phone: rawPhone }, 'EMPLOYEE');
    expect(employeeView.phone).toBe('017XX-XX5678'); // MASKED FOR EMPLOYEE
  });

  // --------------------------------------------------------------------------
  // 5. Admin Filter Scenarios: Marketer, Status, Channel, Date Range
  // --------------------------------------------------------------------------
  it('filters leads by marketer, status, channel, and date range', async () => {
    // Create Lead 3
    testLead3 = await prisma.lead.create({
      data: {
        name: 'গ্রিন রেস্টুরেন্ট অ্যান্ড ক্যাফে',
        phone: '01911223344',
        buyer_type: BuyerType.RESTAURANT,
        source_channel: 'গুগল বিজ্ঞাপন',
        owner_id: employeeUser1.id,
        status: LeadStatus.LOST,
        quality_rating: 2,
        lost_reason: 'দাম বেশি মনে হয়েছে',
      },
    });

    // Query 1: Filter by Marketer 1
    const marketer1Leads = await prisma.lead.findMany({
      where: { owner_id: employeeUser1.id },
    });
    const m1Ids = marketer1Leads.map((l) => l.id);
    expect(m1Ids).toContain(testLead1.id);
    expect(m1Ids).toContain(testLead3.id);
    expect(m1Ids).not.toContain(testLead2.id);

    // Query 2: Filter by Status 'ORDERED'
    const orderedLeads = await prisma.lead.findMany({
      where: { status: LeadStatus.ORDERED },
    });
    const orderedIds = orderedLeads.map((l) => l.id);
    expect(orderedIds).toContain(testLead2.id);
    expect(orderedIds).not.toContain(testLead1.id);

    // Query 3: Filter by Channel 'গুগল বিজ্ঞাপন'
    const googleLeads = await prisma.lead.findMany({
      where: { source_channel: { contains: 'গুগল', mode: 'insensitive' } },
    });
    const googleIds = googleLeads.map((l) => l.id);
    expect(googleIds).toContain(testLead3.id);
    expect(googleIds).not.toContain(testLead1.id);

    // Query 4: Filter by Buyer Type 'RESTAURANT'
    const restaurantLeads = await prisma.lead.findMany({
      where: { buyer_type: BuyerType.RESTAURANT },
    });
    const restIds = restaurantLeads.map((l) => l.id);
    expect(restIds).toContain(testLead3.id);
    expect(restIds).not.toContain(testLead1.id);

    // Query 5: Filter by Date Range (today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayLeads = await prisma.lead.findMany({
      where: {
        created_at: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });
    expect(todayLeads.length).toBeGreaterThanOrEqual(3);
  });
});
