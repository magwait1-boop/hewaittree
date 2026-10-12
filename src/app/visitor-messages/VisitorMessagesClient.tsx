'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FeedbackInboxModal from '@/app/components/FeedbackInboxModal';
import ThemeToggle from '@/app/components/ThemeToggle';

export default function VisitorMessagesClient() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-default-canvas p-4 text-foreground">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="btn-base min-h-11">
          العودة إلى الشجرة
        </Link>
        <ThemeToggle />
      </div>
      <FeedbackInboxModal onClose={() => router.push('/')} />
    </main>
  );
}
