import { redirect } from 'next/navigation';

/**
 * Daily entry now lives on My Work as its own tab. This old address is kept
 * for bookmarks and links, and is sent there on the server so the retired
 * form never flashes on screen.
 */
export default function EmployeeDailyEntryPage() {
  redirect('/employee/my-work?tab=daily_entry');
}
