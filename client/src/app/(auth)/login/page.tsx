import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Kirish' };

export default function LoginPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Tizimga kirish</CardTitle>
        <CardDescription>
          Hisobingizga kirish uchun ma&apos;lumotlarni kiriting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
