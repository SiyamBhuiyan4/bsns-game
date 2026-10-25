import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import EmployeeHeader from '@/components/EmployeeHeader';

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'EMPLOYEE') {
    redirect('/admin/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-full overflow-x-hidden">
      {/* Top Navigation Bar with Mobile Drawer & Horizontal Scroll */}
      <EmployeeHeader session={session} />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
