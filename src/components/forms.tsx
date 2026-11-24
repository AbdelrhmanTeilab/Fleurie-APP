'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

type State = { error?: string; ok?: string; secret?: string } | undefined;
export function Submit({ children, className = 'btn' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{children}</button>;
}
export function ActionForm({ action, children, className }: { action: (s: State, f: FormData) => Promise<State>; children: React.ReactNode; className?: string }) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} className={className}>
      {children}
      {state?.error && <div className="msg err" role="alert">{state.error}</div>}
      {state?.ok && <div className="msg ok">{state.ok}</div>}
      {state?.secret && <div className="msg ok"><div>Temporary password (shown once):</div><div className="secret">{state.secret}</div></div>}
    </form>
  );
}
export function Field({ label, name, type = 'text', hint, ...rest }: { label: string; name: string; type?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (<div><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} {...rest} />{hint && <div className="hint">{hint}</div>}</div>);
}
