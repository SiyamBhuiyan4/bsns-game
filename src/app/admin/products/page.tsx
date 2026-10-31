import { redirect } from 'next/navigation';

export default function AdminProductsPage() {
  redirect('/admin/campaigns?tab=products');
}
