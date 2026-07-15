'use client';

import Link from 'next/link';
import { SignupForm } from '@/components/features/auth/SignupForm';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const { signup, loading } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">LB</span><span className="text-sm font-semibold">Linkbase</span></Link>
        <Card>
          <CardHeader><CardTitle>Create your workspace</CardTitle></CardHeader>
          <CardContent><SignupForm onSubmit={signup} isLoading={loading} /></CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-slate-950">Sign in</Link></p>
      </div>
    </main>
  );
}
