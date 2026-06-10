import { Stethoscope } from 'lucide-react';

/** Auth (login) guruhi — markazlashtirilgan, toza fon. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-accent/40 p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Klinika CRM</h1>
          <p className="text-sm text-muted-foreground">
            Ko&apos;p klinikali boshqaruv tizimi
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
