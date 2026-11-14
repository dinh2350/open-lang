import { signInRequestSchema } from '@livekit-platform/shared';
import { Link } from 'react-router';
import { signIn } from './auth-api';
import { CredentialsForm } from './credentials-form';

export function SignInPage() {
  return (
    <CredentialsForm
      action="Sign in"
      schema={signInRequestSchema}
      send={signIn}
      passwordAutoComplete="current-password"
    >
      No account yet?{' '}
      <Link to="/register" className="text-foreground underline">
        Register
      </Link>
    </CredentialsForm>
  );
}
