import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard: Inicio'
};

export default function Page() {
  redirect('/dashboard');
}
