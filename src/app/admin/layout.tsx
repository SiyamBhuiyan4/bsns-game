import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import AdminShell from '@/components/AdminShell';
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
    redirect('/employee/dashboard');
  }

  return (
    <>
      <AdminShell session={session}>{children}</AdminShell>
      <AgentChat />
    </>
  );
}
