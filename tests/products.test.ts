import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { NextRequest } from 'next/server';
import { GET as getProducts, POST as createProduct } from '../src/app/api/products/route';
import { PUT as updateProduct } from '../src/app/api/products/[id]/route';

// Mock session
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
  requireAuth: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    return { ...mockSessionUser };
  }),
  requireAdmin: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    if (mockSessionUser.role !== 'ADMIN') throw new Error('FORBIDDEN');
    return { ...mockSessionUser };
  }),
}));

describe('Products Catalog & Pricing Verifier Tests', () => {
  let adminUser: any;
  let employeeUser: any;
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
    const runId = Math.random().toString(36).substring(2, 8);
    const passwordHash = await hashPassword('TestPass123!');

    adminUser = await prisma.user.create({
      data: {
        name: `Prod Admin ${runId}`,
        email: `prod_admin_${runId}@test.com`,
        password_hash: passwordHash,
        role: 'ADMIN',
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: `Prod Employee ${runId}`,
        email: `prod_emp_${runId}@test.com`,
        password_hash: passwordHash,
        role: 'EMPLOYEE',
      },
    });
  });

  afterAll(async () => {
    if (createdProductIds.length > 0) {
      await prisma.dailyProductSale.deleteMany({
        where: { product_id: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }
    if (adminUser) {
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }
    if (employeeUser) {
      await prisma.user.deleteMany({ where: { id: employeeUser.id } });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockSessionUser.id = adminUser.id;
    mockSessionUser.userId = adminUser.id;
    mockSessionUser.name = adminUser.name;
    mockSessionUser.email = adminUser.email;
    mockSessionUser.role = 'ADMIN';
  });

  it('1. should return 401 when fetching products without authentication', async () => {
    mockSessionUser.userId = '';
    const req = new NextRequest('http://localhost:3000/api/products');
    const res = await getProducts(req);
    expect(res.status).toBe(401);
  });

  it('2. should reject product creation by employee (403)', async () => {
    mockSessionUser.userId = employeeUser.id;
    mockSessionUser.role = 'EMPLOYEE';

    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name_bn: 'টেস্ট মাশরুম',
        name_en: 'Test Mushroom',
        unit: 'kg',
        selling_price: 350.0,
      }),
    });

    const res = await createProduct(req);
    expect(res.status).toBe(403);
  });

  it('3. should validate input and reject zero or negative selling prices', async () => {
    const invalidPrices = [0, -50];
    for (const p of invalidPrices) {
      const req = new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name_bn: 'ভুল পণ্য',
          name_en: 'Invalid Product',
          unit: 'packet',
          selling_price: p,
        }),
      });
      const res = await createProduct(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('বিক্রয়মূল্য');
    }
  });

  it('4. should create product successfully with Decimal price and audit log', async () => {
    const req = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name_bn: 'প্রিমিয়াম মাশরুম স্পন',
        name_en: 'Premium Mushroom Spawn',
        unit: 'packet',
        selling_price: 450.5,
      }),
    });

    const res = await createProduct(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.product.name_bn).toBe('প্রিমিয়াম মাশরুম স্পন');
    expect(data.product.name_en).toBe('Premium Mushroom Spawn');
    expect(data.product.unit).toBe('packet');
    expect(Number(data.product.selling_price)).toBe(450.5);
    expect(data.product.is_active).toBe(true);

    createdProductIds.push(data.product.id);

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'Product',
        entity_id: data.product.id,
        action: 'CREATE',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actor_id).toBe(adminUser.id);
  });

  it('5. should update product details and price with PUT', async () => {
    const prod = await prisma.product.create({
      data: {
        name_bn: 'গ্যানোডার্মা চা',
        name_en: 'Ganoderma Tea',
        unit: 'box',
        selling_price: 800.0,
        is_active: true,
      },
    });
    createdProductIds.push(prod.id);

    const updateReq = new NextRequest(`http://localhost:3000/api/products/${prod.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name_bn: 'প্রিমিয়াম গ্যানোডার্মা চা',
        selling_price: 850.75,
      }),
    });

    const updateRes = await updateProduct(updateReq, { params: Promise.resolve({ id: prod.id }) });
    expect(updateRes.status).toBe(200);
    const updatedData = await updateRes.json();
    expect(updatedData.success).toBe(true);
    expect(updatedData.product.name_bn).toBe('প্রিমিয়াম গ্যানোডার্মা চা');
    expect(Number(updatedData.product.selling_price)).toBe(850.75);
  });

  it('6. should deactivate product and maintain existing DailyProductSale relationships', async () => {
    // 1. Create a product
    const product = await prisma.product.create({
      data: {
        name_bn: 'ড্রাইড অয়েস্টার মাশরুম',
        name_en: 'Dried Oyster Mushroom',
        unit: 'kg',
        selling_price: 1200.0,
        is_active: true,
      },
    });
    createdProductIds.push(product.id);

    // 2. Record a daily product sale for this product
    const saleDate = new Date('2026-10-15T00:00:00.000Z');
    const sale = await prisma.dailyProductSale.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: saleDate,
        product_id: product.id,
        quantity: 5,
        amount: 6000,
      },
    });

    // 3. Deactivate product via PUT
    const deactivateReq = new NextRequest(`http://localhost:3000/api/products/${product.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: false }),
    });

    const deactRes = await updateProduct(deactivateReq, { params: Promise.resolve({ id: product.id }) });
    expect(deactRes.status).toBe(200);
    const deactData = await deactRes.json();
    expect(deactData.product.is_active).toBe(false);

    // 4. Verify existing sales record is still intact with product details
    const fetchedSale = await prisma.dailyProductSale.findUnique({
      where: { id: sale.id },
      include: { product: true },
    });
    expect(fetchedSale).not.toBeNull();
    expect(fetchedSale?.product_id).toBe(product.id);
    expect(fetchedSale?.product.name_bn).toBe('ড্রাইড অয়েস্টার মাশরুম');
    expect(Number(fetchedSale?.amount)).toBe(6000);
    expect(fetchedSale?.product.is_active).toBe(false);

    // 5. Verify employee product fetch excludes the deactivated product
    mockSessionUser.userId = employeeUser.id;
    mockSessionUser.role = 'EMPLOYEE';

    const empReq = new NextRequest('http://localhost:3000/api/products');
    const empRes = await getProducts(empReq);
    expect(empRes.status).toBe(200);
    const empData = await empRes.json();
    const foundInActiveList = empData.products.find((p: any) => p.id === product.id);
    expect(foundInActiveList).toBeUndefined();

    // 6. Verify admin fetch with all=true includes the deactivated product
    mockSessionUser.userId = adminUser.id;
    mockSessionUser.role = 'ADMIN';

    const adminReq = new NextRequest('http://localhost:3000/api/products?all=true');
    const adminRes = await getProducts(adminReq);
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();
    const foundInAdminList = adminData.products.find((p: any) => p.id === product.id);
    expect(foundInAdminList).toBeDefined();
    expect(foundInAdminList.is_active).toBe(false);
  });

  it('7. should create product with sales target and deadline, track progress against sales, and calculate days remaining', async () => {
    mockSessionUser.userId = adminUser.id;
    mockSessionUser.role = 'ADMIN';

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 10);
    const deadlineStr = deadlineDate.toISOString().split('T')[0];

    // 1. Create product with a target of 100 units by deadline
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name_bn: 'প্রিমিয়াম বাটন মাশরুম',
        name_en: 'Premium Button Mushroom',
        unit: 'box',
        selling_price: 450,
        target_quantity: 100,
        target_deadline: deadlineStr,
      }),
    });

    const createRes = await createProduct(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const prodId = createData.product.id;
    expect(Number(createData.product.target_quantity)).toBe(100);

    // 2. Record 35 units sold by employee
    await prisma.dailyProductSale.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: new Date(),
        product_id: prodId,
        quantity: 35,
        amount: 35 * 450,
      },
    });

    // 3. Fetch products and verify progress and velocity calculations
    const fetchReq = new NextRequest('http://localhost:3000/api/products');
    const fetchRes = await getProducts(fetchReq);
    expect(fetchRes.status).toBe(200);
    const fetchData = await fetchRes.json();
    const productItem = fetchData.products.find((p: any) => p.id === prodId);

    expect(productItem).toBeDefined();
    expect(productItem.target_quantity).toBe(100);
    expect(productItem.achieved_quantity).toBe(35);
    expect(productItem.progress_percentage).toBe(35);
    expect(productItem.remaining_quantity).toBe(65);
    expect(productItem.days_remaining).toBeGreaterThanOrEqual(9);
    expect(productItem.days_remaining).toBeLessThanOrEqual(11);
    expect(productItem.daily_needed).toBeGreaterThan(0);
    expect(productItem.is_completed).toBe(false);

    // 4. Update target to 35 units (target met) via PUT
    const updateReq = new NextRequest(`http://localhost:3000/api/products/${prodId}`, {
      method: 'PUT',
      body: JSON.stringify({
        target_quantity: 35,
      }),
    });
    const updateRes = await updateProduct(updateReq, { params: Promise.resolve({ id: prodId }) });
    expect(updateRes.status).toBe(200);

    // 5. Verify target completion status
    const verifyRes = await getProducts(new NextRequest('http://localhost:3000/api/products'));
    const verifyData = await verifyRes.json();
    const completedItem = verifyData.products.find((p: any) => p.id === prodId);
    expect(completedItem.is_completed).toBe(true);
    expect(completedItem.progress_percentage).toBe(100);
  });
});
