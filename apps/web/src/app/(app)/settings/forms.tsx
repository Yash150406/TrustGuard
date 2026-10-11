"use client";

import { useActionState, useState } from "react";
import {
  changeRole,
  createInviteAction,
  createTokenAction,
  removeMemberAction,
  revokeTokenAction,
  type ActionState,
} from "./actions";

const ROLE_LABELS = { viewer: "Viewer", analyst: "Analyst", admin: "Admin", owner: "Owner" } as const;
type RoleName = keyof typeof ROLE_LABELS;

const pill =
  "rounded-full px-4 py-2 text-sm font-semibold transition-transform duration-300 ease-spring active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100";
const solid = `${pill} bg-fg text-bg`;
const ghost = `${pill} border border-hair text-fg`;
const field =
  "rounded-full border border-hair bg-transparent px-4 py-2 text-sm text-fg placeholder:text-muted";

function Message({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-high">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-muted">{state.ok}</p>;
  return null;
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-full border border-hair p-1 pl-4">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px]" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        className={solid}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function MemberControls({
  userId,
  role,
  assignable,
  canRemove,
}: {
  userId: string;
  role: RoleName;
  assignable: RoleName[];
  canRemove: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeRole, {});
  const [removeState, removeAction, removePending] = useActionState(removeMemberAction, {});
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <form action={roleAction}>
          <input type="hidden" name="userId" value={userId} />
          <label className="sr-only" htmlFor={`role-${userId}`}>
            Role
          </label>
          <select
            id={`role-${userId}`}
            name="role"
            defaultValue={role}
            disabled={assignable.length === 0 || rolePending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={`${field} py-1.5`}
          >
            {(assignable.includes(role) ? assignable : [role, ...assignable]).map((r) => (
              <option key={r} value={r} className="bg-core">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </form>
        {canRemove && (
          <form action={removeAction}>
            <input type="hidden" name="userId" value={userId} />
            <button type="submit" className={`${ghost} py-1.5`} disabled={removePending}>
              Remove
            </button>
          </form>
        )}
      </div>
      <Message state={roleState.error || roleState.ok ? roleState : removeState} />
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(createInviteAction, {});
  return (
    <div className="grid grid-cols-1 gap-3">
      <form action={action} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="invite-role">
          Role for the new member
        </label>
        <select id="invite-role" name="role" defaultValue="analyst" className={field}>
          <option value="viewer" className="bg-core">Viewer</option>
          <option value="analyst" className="bg-core">Analyst</option>
          <option value="admin" className="bg-core">Admin</option>
        </select>
        <button type="submit" className={solid} disabled={pending}>
          Create invite link
        </button>
      </form>
      {state.url && (
        <>
          <CopyField value={state.url} label="Invite link" />
          <p className="text-sm text-muted">Works once and expires in 7 days.</p>
        </>
      )}
      <Message state={state} />
    </div>
  );
}

export function TokenForm() {
  const [state, action, pending] = useActionState(createTokenAction, {});
  return (
    <div className="grid grid-cols-1 gap-3">
      <form action={action} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="token-name">
          Token name
        </label>
        <input
          id="token-name"
          name="name"
          required
          maxLength={60}
          placeholder="Name, for example Work laptop"
          className={`${field} min-w-0 flex-1`}
        />
        <button type="submit" className={solid} disabled={pending}>
          Create token
        </button>
      </form>
      {state.token && (
        <>
          <CopyField value={state.token} label="New API token" />
          <p className="text-sm text-warn">Copy it now. You won&apos;t see this token again.</p>
        </>
      )}
      <Message state={state} />
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeTokenAction, {});
  return (
    <form action={action} className="grid justify-items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`${ghost} py-1.5`} disabled={pending}>
        Revoke
      </button>
      {state.error && <Message state={state} />}
    </form>
  );
}
