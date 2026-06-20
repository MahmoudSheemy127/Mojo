// src/layouts/AuthLayout.tsx
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

/** Unauthenticated shell: app logo above a centered card on the deepest bg. */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-deepest px-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-avatar bg-accent text-xl font-bold text-white">
          M
        </div>
        <h1 className="text-2xl font-bold text-text-normal">Mojo</h1>
      </div>
      <div className="w-full max-w-[400px] rounded-modal bg-bg-sidebar p-6 shadow-lg">
        {children}
      </div>
    </div>
  );
}
