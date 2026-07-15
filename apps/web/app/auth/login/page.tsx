'use client';

import Link from 'next/link';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { login, loading } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">LB</span><span className="text-sm font-semibold">Linkbase</span></Link>
        <Card>
          <CardHeader><CardTitle>Sign in to your workspace</CardTitle></CardHeader>
          <CardContent><LoginForm onSubmit={login} isLoading={loading} /></CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">No workspace yet? <Link href="/signup" className="font-medium text-slate-950">Create one</Link></p>
      </div>
    </main>
  );
}
