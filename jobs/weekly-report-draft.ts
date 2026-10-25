import prisma from '../src/lib/prisma';
import { executeWeeklyReportDraft } from '../src/lib/cron';

export async function runWeeklyReportDraft(options?: { refDate?: Date; actorId?: string }) {
  console.log('📊 [Weekly Report Job] Starting draft creation job (Sunday 09:00 Asia/Dhaka)...');
  const result = await executeWeeklyReportDraft(options);
  if (result.created) {
    console.log(`✅ [Weekly Report Job] Draft created for week: ${result.week_start} to ${result.week_end}`);
    console.log(`   - Report ID: ${result.report_id}`);
    console.log(`   - Status: ${result.status}`);
    console.log(`   - Bengali Questions Populated: ${result.questions_count}`);
    console.log(`   - Audit Log ID: ${result.auditLogId}`);
  } else {
    console.log(`ℹ️ [Weekly Report Job] Report already exists for week: ${result.week_start} to ${result.week_end}`);
    console.log(`   - Report ID: ${result.report_id}`);
    console.log(`   - Status: ${result.status}`);
  }
  return result;
}

// Auto-run if executed directly via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('weekly-report-draft.ts') || process.argv[1].endsWith('weekly-report-draft.js'))
) {
  runWeeklyReportDraft()
    .catch((error) => {
      console.error('❌ [Weekly Report Job] Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
