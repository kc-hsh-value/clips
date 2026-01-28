import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ClipperHeader } from '@/components/clipper/header';

export default async function ClipperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    redirect('/pending');
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ClipperHeader profile={profile} />
      <main className="max-w-6xl mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
}
