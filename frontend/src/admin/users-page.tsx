import {
  type Role,
  roleSchema,
  type UserDetails,
} from '@livekit-platform/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { BackendRefusal } from '@/auth/auth-api';
import { useAuth } from '@/auth/auth-context';
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
import { changeRole, listUsers } from './users-api';

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
 * The admin Users page: every User with their Role and creation date, and a
 * control to change another User's Role. Only Admins reach it, and the
 * backend checks again on every request.
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
  /** An Admin can't change their own Role. */
  readonly isSignedInUser: boolean;
}

function UserRow({ user, isSignedInUser }: UserRowProps) {
  const { authorizedFetch } = useAuth();
  const queryClient = useQueryClient();
  const roleChange = useMutation({
    mutationFn: (role: Role) => changeRole(authorizedFetch, user.id, role),
    onSuccess: (changed) => {
      queryClient.setQueryData<UserDetails[]>(USERS_QUERY_KEY, (users) =>
        users?.map((other) => (other.id === changed.id ? changed : other)),
      );
    },
  });
  const ownRoleHintId = useId();
  const errorId = useId();
  // Shows the Role being saved; a refused change goes back to the User's Role.
  const shownRole = roleChange.isPending ? roleChange.variables : user.role;

  return (
    <TableRow>
      <TableHead scope="row">{user.email}</TableHead>
      <TableCell>
        <NativeSelect
          size="sm"
          aria-label={`Role of ${user.email}`}
          aria-describedby={isSignedInUser ? ownRoleHintId : errorId}
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
        {isSignedInUser && (
          <p id={ownRoleHintId} className="text-muted-foreground text-xs">
            You can&apos;t change your own Role.
          </p>
        )}
        {roleChange.error !== null && (
          <p id={errorId} role="alert" className="text-destructive text-xs">
            {errorMessage(roleChange.error)}
          </p>
        )}
      </TableCell>
      <TableCell>
        <time dateTime={user.createdAt}>
          {creationDate.format(new Date(user.createdAt))}
        </time>
      </TableCell>
    </TableRow>
  );
}
