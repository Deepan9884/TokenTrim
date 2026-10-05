import { redirect } from 'next/navigation';

/**
 * Public sign-up was removed from the admin web panel.
 * Accounts are created from the TokenTrim extension
 * (POST /api/auth/signup); the panel itself is sign-in only.
 */
export default function SignupPage() {
  redirect('/login');
}
