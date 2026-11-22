import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Heading } from '@astryxdesign/core/Heading';
import { Stack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import type {
  AuthResponse,
  registerRequestSchema,
  signInRequestSchema,
} from '@open-lang/shared';
import { useMutation } from '@tanstack/react-query';
import { type ReactNode, type SubmitEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { BackendRefusal } from './auth-api';
import { useAuth } from './auth-context';

interface Credentials {
  readonly email: string;
  readonly password: string;
}

interface CredentialsFormProps {
  /** The page heading, which is also the submit button's label. */
  readonly action: 'Sign in' | 'Register';
  /** The shared schema the backend validates the request with. */
  readonly schema: typeof signInRequestSchema | typeof registerRequestSchema;
  readonly send: (credentials: Credentials) => Promise<AuthResponse>;
  readonly passwordAutoComplete: 'current-password' | 'new-password';
  readonly passwordHint?: string;
  /** An error to show until the person submits the form, such as why they were signed out. */
  readonly initialError?: string | null;
  /** A link to the other way in. */
  readonly children: ReactNode;
}

function errorMessage(error: Error): string {
  return error instanceof BackendRefusal
    ? error.message
    : 'Something went wrong. Try again.';
}

/**
 * An email and password form that signs the User in and takes them to the
 * Conversation page. It checks the credentials against the backend's own
 * schema first, so a mistake costs none of the rate-limited attempts.
 */
export function CredentialsForm({
  action,
  schema,
  send,
  passwordAutoComplete,
  passwordHint,
  initialError = null,
  children,
}: CredentialsFormProps) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [invalidCredentials, setInvalidCredentials] = useState<string | null>(
    null,
  );
  const request = useMutation({
    mutationFn: send,
    onSuccess: (response) => {
      signIn(response);
      void navigate('/', { replace: true });
    },
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const credentials = schema.safeParse({ email, password });
    if (!credentials.success) {
      setInvalidCredentials(
        credentials.error.issues.map((issue) => issue.message).join(' '),
      );
      return;
    }
    setInvalidCredentials(null);
    request.mutate(credentials.data);
  }

  const error =
    invalidCredentials ??
    (request.error === null ? null : errorMessage(request.error)) ??
    (request.isIdle ? initialError : null);

  return (
    <Stack as="main" align="center" justify="center" minHeight="100svh">
      <Card width="100%" maxWidth={384} padding={6}>
        <Stack gap={6}>
          <Heading level={1}>{action}</Heading>
          <form noValidate onSubmit={submit}>
            <Stack gap={4}>
              <FormLayout defaultOptionality="required">
                <TextInput
                  label="Email"
                  htmlName="email"
                  type="email"
                  autoComplete="email"
                  isRequired
                  value={email}
                  onChange={setEmail}
                />
                <TextInput
                  label="Password"
                  htmlName="password"
                  type="password"
                  autoComplete={passwordAutoComplete}
                  isRequired
                  description={passwordHint}
                  value={password}
                  onChange={setPassword}
                />
              </FormLayout>
              {error !== null && (
                <Banner status="error" role="alert" title={error} />
              )}
              <Button
                label={action}
                type="submit"
                variant="primary"
                isDisabled={request.isPending}
              />
            </Stack>
          </form>
          <Text as="p" color="secondary">
            {children}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
