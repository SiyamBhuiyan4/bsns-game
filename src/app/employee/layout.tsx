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
    redirect('/login');
  }

  if (session.role !== 'EMPLOYEE') {
    redirect('/admin/dashboard');
  }

  return <EmployeeShell session={session}>{children}</EmployeeShell>;
}
