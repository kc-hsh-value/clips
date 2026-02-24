import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipperActions } from '@/components/admin/clipper-actions';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  const allClippers = clippers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profiles</h1>
        <p className="text-gray-600">View admins and manage clippers by role</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Admins
            <Badge variant="default">{admins?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {admins && admins.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.full_name || 'No name'}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.status === 'approved' ? 'default' : admin.status === 'pending' ? 'secondary' : 'destructive'}
                      >
                        {admin.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(admin.created_at), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-8">No admins found</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Clippers
            <Badge>{allClippers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allClippers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allClippers.map((clipper) => (
                  <TableRow key={clipper.id}>
                    <TableCell className="font-medium">{clipper.full_name || 'No name'}</TableCell>
                    <TableCell>{clipper.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={clipper.status === 'approved' ? 'default' : clipper.status === 'pending' ? 'secondary' : 'destructive'}
                      >
                        {clipper.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(clipper.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {clipper.status === 'approved' && (
                          <Link href={`/admin/clippers/${clipper.id}`}>
                            <Button size="sm" variant="outline">View</Button>
                          </Link>
                        )}
                        <ClipperActions clipperId={clipper.id} status={clipper.status} isAdmin={false} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-8">No clippers found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
