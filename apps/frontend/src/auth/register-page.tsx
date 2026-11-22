import {
  MINIMUM_PASSWORD_LENGTH,
  registerRequestSchema,
} from '@open-lang/shared';
import { Link } from '@astryxdesign/core/Link';
import { register } from './auth-api';
import { CredentialsForm } from './credentials-form';

export function RegisterPage() {
  return (
    <CredentialsForm
      action="Register"
      schema={registerRequestSchema}
      send={register}
      passwordAutoComplete="new-password"
      passwordHint={`At least ${String(MINIMUM_PASSWORD_LENGTH)} characters.`}
    >
      Already registered? <Link href="/sign-in">Sign in</Link>
    </CredentialsForm>
  );
}
