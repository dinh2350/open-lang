import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuth } from './auth-context';

/**
 * Signs the User out on the backend, so their refresh cookie can't sign
 * anyone in again. Their pages then send them to sign-in.
 */
export function SignOutButton() {
  const { signOut } = useAuth();
  const request = useMutation({ mutationFn: signOut });
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="ghost"
        disabled={request.isPending}
        onClick={() => {
          request.mutate();
        }}
      >
        Sign out
      </Button>
      {request.isError && (
        <p role="alert" className="text-destructive text-sm">
          Couldn&apos;t sign out. Try again.
        </p>
      )}
    </div>
  );
}
