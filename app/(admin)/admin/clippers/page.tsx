import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipperActions } from '@/components/admin/clipper-actions';
import { format } from 'date-fns';

export default async function ClippersPage() {
  const supabase = await createClient();

  // Get all non-admin users (clippers)
  const { data: clippers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'clipper')
    .order('created_at', { ascending: false });

  // Get admins (excluding the first/main admin for safety)
  const { data: admins } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  const pendingClippers = clippers?.filter((c) => c.status === 'pending') || [];
  const approvedClippers = clippers?.filter((c) => c.status === 'approved') || [];
  const rejectedClippers = clippers?.filter((c) => c.status === 'rejected') || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clippers & Admins</h1>
        <p className="text-gray-600">Manage clipper access, approvals, and admin privileges</p>
      </div>

      {/* Admins Section */}
      {admins && admins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Admins
              <Badge variant="default">{admins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200"
                >
                  <div>
                    <p className="font-medium">{admin.full_name || 'No name'}</p>
                    <p className="text-sm text-gray-600">{admin.email}</p>
                  </div>
                  <ClipperActions clipperId={admin.id} status="approved" isAdmin={true} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals */}
      {pendingClippers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Approvals
              <Badge variant="secondary">{pendingClippers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingClippers.map((clipper) => (
                <div
                  key={clipper.id}
                  className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div>
                    <p className="font-medium">{clipper.full_name || 'No name'}</p>
                    <p className="text-sm text-gray-600">{clipper.email}</p>
                    <p className="text-xs text-gray-400">
                      Registered {format(new Date(clipper.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <ClipperActions clipperId={clipper.id} status={clipper.status} isAdmin={false} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Clippers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Approved Clippers
            <Badge>{approvedClippers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedClippers.length > 0 ? (
            <div className="space-y-4">
              {approvedClippers.map((clipper) => (
                <div
                  key={clipper.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{clipper.full_name || 'No name'}</p>
                    <p className="text-sm text-gray-600">{clipper.email}</p>
                  </div>
                  <ClipperActions clipperId={clipper.id} status={clipper.status} isAdmin={false} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No approved clippers yet</p>
          )}
        </CardContent>
      </Card>

      {/* Rejected Clippers */}
      {rejectedClippers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Rejected
              <Badge variant="destructive">{rejectedClippers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rejectedClippers.map((clipper) => (
                <div
                  key={clipper.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-60"
                >
                  <div>
                    <p className="font-medium">{clipper.full_name || 'No name'}</p>
                    <p className="text-sm text-gray-600">{clipper.email}</p>
                  </div>
                  <ClipperActions clipperId={clipper.id} status={clipper.status} isAdmin={false} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
