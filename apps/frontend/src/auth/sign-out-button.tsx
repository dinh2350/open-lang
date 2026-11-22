import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from './auth-context';

/**
 * Signs the User out on the backend, so their refresh cookie can't sign
 * anyone in again. Their pages then send them to sign-in. The error, if
 * signing out fails, carries the `sign-out-error` class, so the header can
 * put it on a line of its own below the row of controls.
 */
export function SignOutButton() {
  const { signOut } = useAuth();
  const request = useMutation({ mutationFn: signOut });
  return (
    <>
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
          className="sign-out-error"
          status="error"
          role="alert"
          title="Couldn't sign out. Try again."
        />
      )}
    </>
  );
}
