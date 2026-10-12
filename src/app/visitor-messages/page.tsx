import type { Metadata } from 'next';
import VisitorMessagesClient from './VisitorMessagesClient';

export const metadata: Metadata = {
  title: 'رسائل الزوار — شجرة حويت',
  robots: { index: false, follow: false },
};

export default function VisitorMessagesPage() {
  return <VisitorMessagesClient />;
}
