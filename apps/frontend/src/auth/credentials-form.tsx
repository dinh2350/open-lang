import type {
  AuthResponse,
  registerRequestSchema,
  signInRequestSchema,
} from '@open-lang/shared';
import { useMutation } from '@tanstack/react-query';
import { type ReactNode, type SubmitEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const emailId = useId();
  const passwordId = useId();
  const passwordHintId = useId();

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = schema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });
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
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{action}</h1>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={passwordId}>Password</Label>
          <Input
            id={passwordId}
            name="password"
            type="password"
            autoComplete={passwordAutoComplete}
            required
            aria-describedby={passwordHint && passwordHintId}
          />
          {passwordHint && (
            <p id={passwordHintId} className="text-muted-foreground text-sm">
              {passwordHint}
            </p>
          )}
        </div>
        {error !== null && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" disabled={request.isPending}>
          {action}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">{children}</p>
    </main>
  );
}
