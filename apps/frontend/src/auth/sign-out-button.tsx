import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Stack } from '@astryxdesign/core/Stack';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from './auth-context';

/**
 * Signs the User out on the backend, so their refresh cookie can't sign
 * anyone in again. Their pages then send them to sign-in.
 */
export function SignOutButton() {
  const { signOut } = useAuth();
  const request = useMutation({ mutationFn: signOut });
  return (
    <Stack gap={2} align="end">
      <Button
        label="Sign out"
        variant="ghost"
        isDisabled={request.isPending}
        onClick={() => {
          request.mutate();
        }}
      />
      {request.isError && (
        <Banner
          status="error"
          role="alert"
          title="Couldn't sign out. Try again."
        />
      )}
    </Stack>
  );
}
