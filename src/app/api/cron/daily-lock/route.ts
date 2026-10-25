import { NextRequest, NextResponse } from 'next/server';
import { executeDailyLock, validateCronAuthorization } from '@/lib/cron';

async function handleDailyLock(req: NextRequest) {
  try {
    if (!validateCronAuthorization(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    let refDate: Date | undefined;

    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        refDate = parsed;
      }
    }

    const result = await executeDailyLock({ refDate });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in daily-lock cron endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to execute daily lock', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleDailyLock(req);
}

export async function POST(req: NextRequest) {
  return handleDailyLock(req);
}
