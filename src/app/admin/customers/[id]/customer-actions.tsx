"use client";

import { ShieldCheck, Warning, Wrench } from "@phosphor-icons/react/dist/ssr";
import { useState, type ReactNode } from "react";
import { deleteCustomer, saveCustomerNote, sendCustomerReset, setCustomerBlocked, setCustomerRole } from "@/lib/actions/admin-people";
import { ActionButton, useAction } from "../../_components/controls";
import { IconHeading } from "../../_components/people-ui";
import { ConfirmButton } from "../../_components/people-controls";
import { buttonClass, controlClass, dangerButtonClass, Notice, Panel, textAreaClass } from "../../_components/ui";

function ActionRow({ title, about, children }: { title: string; about: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 pb-3 last:pb-0">
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted">{about}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StaffNote({ userId, note }: { userId: string; note: string }) {
  const { pending, result, run } = useAction();
  const [value, setValue] = useState(note);
  return (
    <form className="grid justify-items-start gap-2" onSubmit={(event) => { event.preventDefault(); run(() => saveCustomerNote(userId, value)); }}>
      <textarea aria-label="Private note" rows={3} maxLength={4000} value={value} onChange={(event) => setValue(event.target.value)} className={textAreaClass} placeholder="Only your team can see this." />
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving" : "Save note"}</button>
      <Notice result={result} compact />
    </form>
  );
}

function RoleForm({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { pending, result, run, clear } = useAction();
  const [password, setPassword] = useState("");
  const role = isAdmin ? "customer" : "admin";
  return (
    <Panel title={<IconHeading icon={ShieldCheck}>{isAdmin ? "Remove admin access" : "Give admin access"}</IconHeading>}>
      <form
        className="grid content-start justify-items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          clear();
          run(() => setCustomerRole(userId, role, password), () => setPassword(""));
        }}
      >
        <p className="text-xs text-muted">{isAdmin ? "They keep their account but can no longer open this admin panel." : "They can see and change everything in this admin panel."} Enter your password to confirm.</p>
        <label className="grid w-full max-w-xs gap-1 text-xs text-muted">
          Your password
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={controlClass} />
        </label>
        <button type="submit" disabled={pending || !password} className={buttonClass}>{pending ? "Checking" : isAdmin ? "Remove admin access" : "Give admin access"}</button>
        <Notice result={result} compact />
      </form>
    </Panel>
  );
}

function DeleteForm({ userId, email }: { userId: string; email: string }) {
  const { pending, result, run } = useAction();
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="grid content-start justify-items-start gap-2 pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => deleteCustomer(userId, typed, password));
      }}
    >
      <div>
        <p className="font-medium">Delete this customer for good</p>
        <p className="text-xs text-muted">This cannot be undone. Their personal details are erased. Paid orders stay on record without their name. You cannot do this while they have an order or bespoke piece in progress.</p>
      </div>
      <label className="grid w-full max-w-md gap-1 text-xs text-muted">
        <span className="break-words">Type their email to confirm: {email}</span>
        <input autoComplete="off" required value={typed} onChange={(event) => setTyped(event.target.value)} className={controlClass} />
      </label>
      <label className="grid w-full max-w-xs gap-1 text-xs text-muted">
        Your password
        <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={controlClass} />
      </label>
      <button type="submit" disabled={pending || !typed || !password} className={dangerButtonClass}>{pending ? "Deleting" : "Delete this customer"}</button>
      <Notice result={result} compact />
    </form>
  );
}

export function CustomerActions({ userId, email, isAdmin, blocked, isSelf }: { userId: string; email: string; isAdmin: boolean; blocked: boolean; isSelf: boolean }) {
  const showBlock = !isSelf && (blocked || !isAdmin);
  const showDelete = !isSelf && !isAdmin;
  return (
    <>
      <Panel title={<IconHeading icon={Wrench}>Help this customer</IconHeading>}>
        <ActionRow title="Reset their password" about="Sends them an email with a link to choose a new password.">
          {blocked ? <p className="text-xs text-muted">Unblock them first.</p> : <ActionButton action={sendCustomerReset.bind(null, userId)}>Send reset email</ActionButton>}
        </ActionRow>
      </Panel>
      {isSelf ? <p className="text-xs text-muted">You cannot change your own access or delete your own account here.</p> : blocked && !isAdmin ? null : <RoleForm userId={userId} isAdmin={isAdmin} />}
      {!isSelf && isAdmin && !blocked ? <p className="text-xs text-muted">Remove admin access before you can block this person.</p> : null}
      {showBlock || showDelete ? (
        <Panel title={<IconHeading icon={Warning}><span className="text-danger">Be careful</span></IconHeading>} className="border-[var(--adm-danger-line)]">
          <div className="grid divide-y divide-line">
            {showBlock ? (
              <ActionRow title={blocked ? "Let them sign in again" : "Block this customer"} about={blocked ? "They are blocked and cannot sign in." : "They are signed out right away and cannot sign in. You can undo this later."}>
                {blocked ? (
                  <ConfirmButton action={setCustomerBlocked.bind(null, userId, false)} label="Unblock" confirmLabel="Yes, unblock" warning="They will be able to sign in again." />
                ) : (
                  <ConfirmButton action={setCustomerBlocked.bind(null, userId, true)} label="Block" confirmLabel="Yes, block them" warning="Are you sure? They will be signed out straight away." danger />
                )}
              </ActionRow>
            ) : null}
            {showDelete ? <DeleteForm userId={userId} email={email} /> : null}
          </div>
        </Panel>
      ) : null}
    </>
  );
}
