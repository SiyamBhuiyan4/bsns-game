import { NextRequest, NextResponse } from 'next/server';
import { executeWeeklyReportDraft, validateCronAuthorization } from '@/lib/cron';

async function handleWeeklyReportDraft(req: NextRequest) {
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

    const result = await executeWeeklyReportDraft({ refDate });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in weekly-report-draft cron endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute weekly report draft cron',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleWeeklyReportDraft(req);
}

export async function POST(req: NextRequest) {
  return handleWeeklyReportDraft(req);
}
