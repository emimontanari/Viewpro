import { Metadata } from 'next';
import ForgotPasswordViewPage from '@/features/auth/components/forgot-password-view';

export const metadata: Metadata = {
  title: 'Restablecer contraseña',
  description: 'Solicitá un link para restablecer tu contraseña.'
};

export default function Page() {
  return <ForgotPasswordViewPage />;
}
