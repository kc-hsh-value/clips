import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    if (profile?.status === 'approved') {
      redirect(profile.role === 'admin' ? '/admin' : '/dashboard');
    } else if (profile?.status === 'pending') {
      redirect('/pending');
    }
  }

  redirect('/login');
}
