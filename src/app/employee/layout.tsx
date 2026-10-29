import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import EmployeeShell from '@/components/EmployeeShell';

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    // Clears a cookie that still verifies but belongs to a deactivated account, then goes to /login.
    redirect('/api/auth/logout');
  }

  if (session.role !== 'EMPLOYEE') {
    redirect('/admin/dashboard');
  }

  return <EmployeeShell session={session}>{children}</EmployeeShell>;
}
