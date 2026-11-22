import {
  type Role,
  roleSchema,
  setPasswordRequestSchema,
  type UserDetails,
} from '@open-lang/shared';
import { Banner } from '@astryxdesign/core/Banner';
import { Heading } from '@astryxdesign/core/Heading';
import { Stack } from '@astryxdesign/core/Stack';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useId, useState } from 'react';
import { BackendRefusal } from '@/auth/auth-api';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { changeLocked, changeRole, listUsers, setPassword } from './users-api';

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
 * creation date, and controls to change another User's Role, to lock or
 * unlock them, and to set a new password for them. Only Admins reach it, and
 * the backend checks again on every request.
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
    <Stack
      as="main"
      gap={6}
      padding={6}
      paddingBlockStart={10}
      maxWidth="56rem"
      style={{ marginInline: 'auto' }}
    >
      <Heading level={1}>Users</Heading>
      {users.isPending && (
        <div role="status">
          <Text as="p" color="secondary">
            Loading Users…
          </Text>
        </div>
      )}
      {users.error !== null && (
        <Banner status="error" role="alert" title={errorMessage(users.error)} />
      )}
      {users.data !== undefined && (
        <Table verticalAlign="top">
          {/* Astryx has no caption component; children mode puts this
              native caption straight into the <table>. */}
          <caption
            style={{
              captionSide: 'bottom',
              paddingBlockStart: 'var(--spacing-4)',
            }}
          >
            <Text type="supporting" color="secondary">
              Every User, oldest first.
            </Text>
          </caption>
          <TableHeader>
            <TableRow>
              <TableHeaderCell scope="col">Email</TableHeaderCell>
              <TableHeaderCell scope="col">Role</TableHeaderCell>
              <TableHeaderCell scope="col">Status</TableHeaderCell>
              <TableHeaderCell scope="col">Created</TableHeaderCell>
              <TableHeaderCell scope="col">Password</TableHeaderCell>
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
    </Stack>
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
      <TableHeaderCell scope="row">
        <Text color="primary" weight="medium">
          {user.email}
        </Text>
      </TableHeaderCell>
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
      <TableCell>
        <PasswordControl user={user} />
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

/**
 * Sets a new password for a User who forgot theirs, which signs them out
 * everywhere. The form checks the backend's own rules before sending.
 */
function PasswordControl({ user }: { readonly user: UserDetails }) {
  const { authorizedFetch } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [invalidPassword, setInvalidPassword] = useState<string | null>(null);
  const passwordChange = useMutation({
    mutationFn: (password: string) =>
      setPassword(authorizedFetch, user.id, password),
    onSuccess: () => {
      setFormOpen(false);
    },
  });
  const inputId = useId();
  const hintId = useId();
  const error =
    invalidPassword ??
    (passwordChange.error === null ? null : errorMessage(passwordChange.error));

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const request = setPasswordRequestSchema.safeParse({
      password: new FormData(event.currentTarget).get('password'),
    });
    if (!request.success) {
      setInvalidPassword(
        request.error.issues.map((issue) => issue.message).join(' '),
      );
      return;
    }
    setInvalidPassword(null);
    passwordChange.mutate(request.data.password);
  }

  if (!formOpen) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          size="xs"
          variant="outline"
          aria-label={`Set new password for ${user.email}`}
          onClick={() => {
            passwordChange.reset();
            setInvalidPassword(null);
            setFormOpen(true);
          }}
        >
          Set new password
        </Button>
        {passwordChange.isSuccess && (
          <p role="status" className="text-muted-foreground text-xs">
            New password set. {user.email} is signed out everywhere.
          </p>
        )}
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="text-xs">
        New password<span className="sr-only"> for {user.email}</span>
      </Label>
      <Input
        id={inputId}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        aria-describedby={hintId}
        className="h-8"
      />
      <p id={hintId} className="text-muted-foreground text-xs">
        At least 12 characters.
      </p>
      {error !== null && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-1">
        <Button size="xs" type="submit" disabled={passwordChange.isPending}>
          Save password
        </Button>
        <Button
          size="xs"
          type="button"
          variant="ghost"
          onClick={() => {
            setFormOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
