'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <Card className="text-center">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-yellow-100 rounded-full">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Pending Approval</CardTitle>
        <CardDescription>
          Your account is currently under review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600">
          An admin will review your registration and approve your account shortly.
          You&apos;ll be able to access the dashboard once approved.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={handleRefresh} variant="outline" className="w-full">
            Check status
          </Button>
          <Button onClick={handleSignOut} variant="ghost" className="w-full">
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
