import {
  type Role,
  roleSchema,
  setPasswordRequestSchema,
  type UserDetails,
} from '@open-lang/shared';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { FormLayout } from '@astryxdesign/core/FormLayout';
import { Heading } from '@astryxdesign/core/Heading';
import { Selector } from '@astryxdesign/core/Selector';
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
import { TextInput } from '@astryxdesign/core/TextInput';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useId, useState } from 'react';
import { BackendRefusal } from '@/auth/auth-api';
import { useAuth } from '@/auth/auth-context';
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
  const captionId = useId();

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
        // Table wraps the <table> in a scroll region (role="group") that
        // takes its name from aria-labelledby, not from the caption.
        <Table verticalAlign="top" aria-labelledby={captionId}>
          {/* Astryx has no caption component; children mode puts this
              native caption straight into the <table>. */}
          <caption
            id={captionId}
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

// Text has no error color; the theme's status text token gives one.
const errorTextStyle = { color: 'var(--color-text-error)' } as const;

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
        <Text as="p" id={hintId} type="supporting" color="secondary">
          {hint}
        </Text>
      )}
      {error !== null && (
        <Text
          as="p"
          id={errorId}
          role="alert"
          type="supporting"
          style={errorTextStyle}
        >
          {errorMessage(error)}
        </Text>
      )}
    </>
  );
  return { describedBy, notes };
}

const roleOptions = roleSchema.options.map((role) => ({
  value: role,
  label: roleNames[role],
}));

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
    <Stack gap={1}>
      <Selector
        size="sm"
        label={`Role of ${user.email}`}
        isLabelHidden
        aria-describedby={describedBy}
        options={roleOptions}
        value={shownRole}
        isDisabled={isSignedInUser || roleChange.isPending}
        onChange={(role) => {
          roleChange.mutate(roleSchema.parse(role));
        }}
      />
      {notes}
    </Stack>
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
    <Stack gap={1} align="start">
      <Text>{user.locked ? 'Locked' : 'Active'}</Text>
      <Button
        size="sm"
        label={`${action} ${user.email}`}
        aria-describedby={describedBy}
        isDisabled={isSignedInUser || lockChange.isPending}
        onClick={() => {
          lockChange.mutate(!user.locked);
        }}
      >
        {action}
      </Button>
      {notes}
    </Stack>
  );
}

/**
 * Sets a new password for a User who forgot theirs, which signs them out
 * everywhere. The form checks the backend's own rules before sending.
 */
function PasswordControl({ user }: { readonly user: UserDetails }) {
  const { authorizedFetch } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [invalidPassword, setInvalidPassword] = useState<string | null>(null);
  const passwordChange = useMutation({
    mutationFn: (newPassword: string) =>
      setPassword(authorizedFetch, user.id, newPassword),
    onSuccess: () => {
      setFormOpen(false);
    },
  });
  const labelSuffixId = useId();
  const error =
    invalidPassword ??
    (passwordChange.error === null ? null : errorMessage(passwordChange.error));

  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const request = setPasswordRequestSchema.safeParse({ password });
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
      <Stack gap={1} align="start">
        <Button
          size="sm"
          label={`Set new password for ${user.email}`}
          onClick={() => {
            passwordChange.reset();
            setInvalidPassword(null);
            setPasswordValue('');
            setFormOpen(true);
          }}
        >
          Set new password
        </Button>
        {passwordChange.isSuccess && (
          <Text as="p" role="status" type="supporting" color="secondary">
            New password set. {user.email} is signed out everywhere.
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <form noValidate onSubmit={submit}>
      <Stack gap={1}>
        <FormLayout defaultOptionality="required">
          <TextInput
            size="sm"
            label="New password"
            aria-labelledby={labelSuffixId}
            htmlName="password"
            type="password"
            autoComplete="new-password"
            isRequired
            description="At least 12 characters."
            value={password}
            onChange={setPasswordValue}
          />
        </FormLayout>
        {/* Joined to the visible label, so each row's field has its own name. */}
        <VisuallyHidden id={labelSuffixId}>for {user.email}</VisuallyHidden>
        {error !== null && (
          <Text as="p" role="alert" type="supporting" style={errorTextStyle}>
            {error}
          </Text>
        )}
        <Stack direction="horizontal" gap={1}>
          <Button
            size="sm"
            type="submit"
            variant="primary"
            label="Save password"
            isDisabled={passwordChange.isPending}
          />
          <Button
            size="sm"
            variant="ghost"
            label="Cancel"
            onClick={() => {
              setFormOpen(false);
            }}
          />
        </Stack>
      </Stack>
    </form>
  );
}
