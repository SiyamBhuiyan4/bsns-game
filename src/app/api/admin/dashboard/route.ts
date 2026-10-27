import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { getAdminDashboardData, DashboardPeriodKey } from '@/lib/dashboard';
import { readLangFromRequest } from '@/lib/i18n/request-lang';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get('period');
    const period = (rawPeriod as DashboardPeriodKey) || 'thisMonth';
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const sectionKey = searchParams.get('sectionKey') || undefined;

    // Display labels follow the language the admin is reading the app in.
    const data = await getAdminDashboardData({
      period,
      from,
      to,
      employeeId,
      sectionKey,
      lang: readLangFromRequest(request),
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error fetching admin dashboard data:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('Unauthorized') || msg.includes('Admin')) {
      return NextResponse.json({ error: 'অননুমোদিত এক্সেস' }, { status: 403 });
    }
    return NextResponse.json({ error: 'ড্যাশবোর্ড ডাটা লোড করা যায়নি' }, { status: 500 });
  }
}
