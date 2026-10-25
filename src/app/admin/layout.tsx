import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AdminHeader from '@/components/AdminHeader';
import AgentChat from '@/components/admin/AgentChat';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/admin-login');
  }

  if (session.role !== 'ADMIN') {
    redirect('/employee/my-work');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-full overflow-x-hidden">
      {/* Top Navigation Bar with Mobile Drawer & Horizontal Scroll */}
      <AdminHeader session={session} />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        {children}
      </main>

      <AgentChat />
    </div>
  );
}
