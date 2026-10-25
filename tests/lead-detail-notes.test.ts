import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { NextRequest } from 'next/server';

const mockSessionUser = {
  id: '',
  userId: '',
  name: '',
  email: '',
  role: 'ADMIN' as 'ADMIN' | 'EMPLOYEE',
};

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => {
    if (!mockSessionUser.userId) return null;
    return { ...mockSessionUser };
  }),
}));

import { GET as getLeadDetail, PUT as updateLead } from '../src/app/api/leads/[id]/route';
import { POST as addLeadNote } from '../src/app/api/leads/[id]/notes/route';

describe('Lead Detail & Notes API Tests', () => {
  const runId = Math.random().toString(36).substring(2, 9);

  let adminUser: any;
  let employeeUser1: any;
  let employeeUser2: any;
  let testLead: any;

  beforeAll(async () => {
    await prisma.$connect();

    adminUser = await prisma.user.create({
      data: {
        name: 'Admin Lead Tester',
        email: `admin_lead_${runId}@example.com`,
        password_hash: 'dummy',
        role: 'ADMIN',
      },
    });

    employeeUser1 = await prisma.user.create({
      data: {
        name: 'Employee One',
        email: `emp1_lead_${runId}@example.com`,
        password_hash: 'dummy',
        role: 'EMPLOYEE',
      },
    });

    employeeUser2 = await prisma.user.create({
      data: {
        name: 'Employee Two',
        email: `emp2_lead_${runId}@example.com`,
        password_hash: 'dummy',
        role: 'EMPLOYEE',
      },
    });

    testLead = await prisma.lead.create({
      data: {
        name: 'Rahim Ahmed',
        phone: '01712345678',
        source_channel: 'Facebook Ad',
        buyer_type: 'RETAIL',
        owner_id: employeeUser1.id,
        status: 'NEW',
      },
    });
  });

  afterAll(async () => {
    await prisma.leadNote.deleteMany({ where: { lead_id: testLead.id } });
    await prisma.lead.deleteMany({ where: { id: testLead.id } });
    await prisma.auditLog.deleteMany({
      where: {
        actor_id: { in: [adminUser.id, employeeUser1.id, employeeUser2.id] },
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, employeeUser1.id, employeeUser2.id] } },
    });
    await prisma.$disconnect();
  });

  it('GET /api/leads/[id] - returns 401 when unauthenticated', async () => {
    mockSessionUser.userId = '';
    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id);
    const res = await getLeadDetail(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(401);
  });

  it('GET /api/leads/[id] - returns 403 when employee tries to view another employee lead', async () => {
    mockSessionUser.id = employeeUser2.id;
    mockSessionUser.userId = employeeUser2.id;
    mockSessionUser.name = employeeUser2.name;
    mockSessionUser.email = employeeUser2.email;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id);
    const res = await getLeadDetail(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(403);
  });

  it('GET /api/leads/[id] - returns full phone and masked_phone for lead owner', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.name = employeeUser1.name;
    mockSessionUser.email = employeeUser1.email;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id);
    const res = await getLeadDetail(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.lead.phone).toBe('01712345678');
    expect(json.lead.masked_phone).toBe('017XX-XX5678');
    expect(json.lead.owner_name).toBe(employeeUser1.name);
  });

  it('GET /api/leads/[id] - returns full phone and masked_phone for admin', async () => {
    mockSessionUser.id = adminUser.id;
    mockSessionUser.userId = adminUser.id;
    mockSessionUser.name = adminUser.name;
    mockSessionUser.email = adminUser.email;
    mockSessionUser.role = 'ADMIN';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id);
    const res = await getLeadDetail(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.lead.phone).toBe('01712345678');
    expect(json.lead.masked_phone).toBe('017XX-XX5678');
    expect(json.lead.owner_name).toBe(employeeUser1.name);
  });

  it('PUT /api/leads/[id] - rejects status ORDERED without order_amount (400)', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'ORDERED' }),
    });
    const res = await updateLead(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('ORDERED');
  });

  it('PUT /api/leads/[id] - rejects status ORDERED with zero order_amount (400)', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'ORDERED', order_amount: 0 }),
    });
    const res = await updateLead(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(400);
  });

  it('PUT /api/leads/[id] - succeeds for status ORDERED with positive order_amount', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'ORDERED', order_amount: 4500 }),
    });
    const res = await updateLead(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lead.status).toBe('ORDERED');
    expect(json.lead.order_amount).toBe(4500);
  });

  it('PUT /api/leads/[id] - rejects status LOST without lost_reason (400)', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'LOST', lost_reason: '' }),
    });
    const res = await updateLead(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('LOST');
  });

  it('PUT /api/leads/[id] - succeeds for status LOST with lost_reason', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'LOST', lost_reason: 'পণ্যের দাম বেশি মনে হয়েছে' }),
    });
    const res = await updateLead(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.lead.status).toBe('LOST');
    expect(json.lead.lost_reason).toBe('পণ্যের দাম বেশি মনে হয়েছে');
  });

  it('PUT /api/leads/[id] - forbids other employee from updating lead (403)', async () => {
    mockSessionUser.id = employeeUser2.id;
    mockSessionUser.userId = employeeUser2.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id, {
      method: 'PUT',
      body: JSON.stringify({ status: 'CONTACTED' }),
    });
    const res = await updateLead(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(403);
  });

  it('POST /api/leads/[id]/notes - rejects empty note (400)', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id + '/notes', {
      method: 'POST',
      body: JSON.stringify({ note: '   ' }),
    });
    const res = await addLeadNote(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(400);
  });

  it('POST /api/leads/[id]/notes - forbids other employee from adding note (403)', async () => {
    mockSessionUser.id = employeeUser2.id;
    mockSessionUser.userId = employeeUser2.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id + '/notes', {
      method: 'POST',
      body: JSON.stringify({ note: 'Unauthorized note attempt' }),
    });
    const res = await addLeadNote(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(403);
  });

  it('POST /api/leads/[id]/notes - appends timeline entry with author attribution', async () => {
    mockSessionUser.id = employeeUser1.id;
    mockSessionUser.userId = employeeUser1.id;
    mockSessionUser.name = employeeUser1.name;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/leads/' + testLead.id + '/notes', {
      method: 'POST',
      body: JSON.stringify({ note: 'Customer called and requested delivery on Friday.' }),
    });
    const res = await addLeadNote(req, { params: Promise.resolve({ id: testLead.id }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.note.note).toBe('Customer called and requested delivery on Friday.');
    expect(json.note.author.id).toBe(employeeUser1.id);
    expect(json.note.author.name).toBe(employeeUser1.name);
    expect(json.note.author.role).toBe('EMPLOYEE');

    // Verify timeline entry in GET lead detail
    const getReq = new NextRequest('http://localhost:3000/api/leads/' + testLead.id);
    const getRes = await getLeadDetail(getReq, { params: Promise.resolve({ id: testLead.id }) });
    const getJson = await getRes.json();
    expect(getJson.lead.notes.length).toBeGreaterThanOrEqual(1);
    expect(getJson.lead.notes[0].note).toBe('Customer called and requested delivery on Friday.');
    expect(getJson.lead.notes[0].author.name).toBe(employeeUser1.name);
  });
});
