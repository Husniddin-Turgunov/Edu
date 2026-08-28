"use client";

import { useState, type ReactNode } from "react";

export function ExpandOnClick({
  hint,
  action,
  children,
}: {
  hint?: string;
  action: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="learn-month-closed" style={{ marginTop: 14 }}>
        {hint ? <p className="muted">{hint}</p> : null}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setOpen(true)}
        >
          {action}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
