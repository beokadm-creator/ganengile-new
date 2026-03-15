import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';

export default async function RootPage() {
  const admin = await isAdmin();
  redirect(admin ? '/dashboard' : '/login');
}
