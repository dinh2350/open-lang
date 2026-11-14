import {
  type Role,
  roleSchema,
  type UserDetails,
} from '@livekit-platform/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { BackendRefusal } from '@/auth/auth-api';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { changeLocked, changeRole, listUsers } from './users-api';

const USERS_QUERY_KEY = ['admin', 'users'] as const;

const roleNames: Record<Role, string> = { member: 'Member', admin: 'Admin' };

// The app is in English; the date is shown in the browser's time zone.
const creationDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

function errorMessage(error: Error): string {
  return error instanceof BackendRefusal
    ? error.message
    : 'Something went wrong. Try again.';
}

/**
 * The admin Users page: every User with their Role, locked state and
 * creation date, and controls to change another User's Role and to lock or
 * unlock them. Only Admins reach it, and the backend checks again on every
 * request.
 */
export function UsersPage() {
  const { user: signedInUser, authorizedFetch } = useAuth();
  const users = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: () => listUsers(authorizedFetch),
    // A refusal won't change on a retry.
    retry: false,
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 pt-16">
      <h1 className="text-2xl font-semibold">Users</h1>
      {users.isPending && (
        <p role="status" className="text-muted-foreground">
          Loading Users…
        </p>
      )}
      {users.error !== null && (
        <p role="alert" className="text-destructive text-sm">
          {errorMessage(users.error)}
        </p>
      )}
      {users.data !== undefined && (
        <Table>
          <TableCaption>Every User, oldest first.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Email</TableHead>
              <TableHead scope="col">Role</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSignedInUser={user.id === signedInUser?.id}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}

interface UserRowProps {
  readonly user: UserDetails;
  /** An Admin can't change their own Role or lock themselves. */
  readonly isSignedInUser: boolean;
}

function UserRow({ user, isSignedInUser }: UserRowProps) {
  return (
    <TableRow>
      <TableHead scope="row">{user.email}</TableHead>
      <TableCell>
        <RoleControl user={user} isSignedInUser={isSignedInUser} />
      </TableCell>
      <TableCell>
        <LockControl user={user} isSignedInUser={isSignedInUser} />
      </TableCell>
      <TableCell>
        <time dateTime={user.createdAt}>
          {creationDate.format(new Date(user.createdAt))}
        </time>
      </TableCell>
    </TableRow>
  );
}

/**
 * A change an Admin makes to one User. When it succeeds, the list shows
 * that User as the backend returned them.
 */
function useUserChange<Variables>(
  change: (variables: Variables) => Promise<UserDetails>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: (changed) => {
      queryClient.setQueryData<UserDetails[]>(USERS_QUERY_KEY, (users) =>
        users?.map((other) => (other.id === changed.id ? changed : other)),
      );
    },
  });
}

/**
 * A hint, or else the error of a refused change such as a `409`, shown
 * under a control in a User's row, and the id that describes the control.
 */
function useControlNotes(hint: string | null, error: Error | null) {
  const hintId = useId();
  const errorId = useId();
  let describedBy: string | undefined;
  if (hint !== null) {
    describedBy = hintId;
  } else if (error !== null) {
    describedBy = errorId;
  }
  const notes = (
    <>
      {hint !== null && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error !== null && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {errorMessage(error)}
        </p>
      )}
    </>
  );
  return { describedBy, notes };
}

function RoleControl({ user, isSignedInUser }: UserRowProps) {
  const { authorizedFetch } = useAuth();
  const roleChange = useUserChange((role: Role) =>
    changeRole(authorizedFetch, user.id, role),
  );
  const { describedBy, notes } = useControlNotes(
    isSignedInUser ? "You can't change your own Role." : null,
    roleChange.error,
  );
  // Shows the Role being saved; a refused change goes back to the User's Role.
  const shownRole = roleChange.isPending ? roleChange.variables : user.role;

  return (
    <>
      <NativeSelect
        size="sm"
        aria-label={`Role of ${user.email}`}
        aria-describedby={describedBy}
        value={shownRole}
        disabled={isSignedInUser || roleChange.isPending}
        onChange={(event) => {
          roleChange.mutate(roleSchema.parse(event.target.value));
        }}
      >
        {roleSchema.options.map((role) => (
          <NativeSelectOption key={role} value={role}>
            {roleNames[role]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {notes}
    </>
  );
}

/** Whether the User is locked, and the button that locks or unlocks them. */
function LockControl({ user, isSignedInUser }: UserRowProps) {
  const { authorizedFetch } = useAuth();
  const lockChange = useUserChange((locked: boolean) =>
    changeLocked(authorizedFetch, user.id, locked),
  );
  const { describedBy, notes } = useControlNotes(
    isSignedInUser ? "You can't lock yourself." : null,
    lockChange.error,
  );
  const action = user.locked ? 'Unlock' : 'Lock';

  return (
    <div className="flex flex-col items-start gap-1">
      <span>{user.locked ? 'Locked' : 'Active'}</span>
      <Button
        size="xs"
        variant="outline"
        aria-label={`${action} ${user.email}`}
        aria-describedby={describedBy}
        disabled={isSignedInUser || lockChange.isPending}
        onClick={() => {
          lockChange.mutate(!user.locked);
        }}
      >
        {action}
      </Button>
      {notes}
    </div>
  );
}
