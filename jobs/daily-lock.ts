import prisma from '../src/lib/prisma';
import { executeDailyLock } from '../src/lib/cron';

export async function runDailyLock(options?: { refDate?: Date; actorId?: string }) {
  console.log('🔒 [Daily Lock Job] Starting end-of-day lock execution (Asia/Dhaka 23:59)...');
  const result = await executeDailyLock(options);
  console.log(`✅ [Daily Lock Job] Successfully locked day: ${result.date}`);
  console.log(`   - Today (Dhaka): ${result.todayDhaka}`);
  console.log(`   - Yesterday (Dhaka): ${result.yesterdayDhaka}`);
  console.log(`   - Oldest Allowed (Dhaka): ${result.oldestAllowedDhaka}`);
  console.log(`   - Edit Window Days: ${result.editWindowDays}`);
  console.log(`   - Total Entries Today: ${result.totalEntriesToday}`);
  console.log(`   - Active Employees: ${result.activeEmployeesCount}`);
  console.log(`   - Submitted Employees: ${result.submittedEmployeesCount}`);
  console.log(`   - Audit Log ID: ${result.auditLogId}`);
  return result;
}

// Auto-run if executed directly via CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('daily-lock.ts') || process.argv[1].endsWith('daily-lock.js'))
) {
  runDailyLock()
    .catch((error) => {
      console.error('❌ [Daily Lock Job] Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
