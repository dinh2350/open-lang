import { signInRequestSchema } from '@open-lang/shared';
import { Link } from '@astryxdesign/core/Link';
import { signIn } from './auth-api';
import { useAuth } from './auth-context';
import { CredentialsForm } from './credentials-form';

/**
 * Signs a User in. A User whom the backend signed out because they were
 * locked lands here and sees the account locked message.
 */
export function SignInPage() {
  const { accountLockedMessage } = useAuth();
  return (
    <CredentialsForm
      action="Sign in"
      schema={signInRequestSchema}
      send={signIn}
      passwordAutoComplete="current-password"
      initialError={accountLockedMessage}
    >
      No account yet? <Link href="/register">Register</Link>
    </CredentialsForm>
  );
}
