import { Suspense } from 'react';
import type { Metadata } from 'next';
import NewHomePage from '@/components/home/NewHomePage';

export const metadata: Metadata = {
  // Homepage tab shows the brand only — nothing after "Swapno Puron Hobe".
  title: { absolute: "Swapno Puron Hobe" },
  description: "Swapno Puron Hobe — shop quality products at the best prices, delivered across Bangladesh.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-background)]" />}>
      <NewHomePage />
    </Suspense>
  );
}
