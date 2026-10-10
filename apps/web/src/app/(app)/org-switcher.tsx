"use client";

import { switchOrg } from "./shell-actions";

type Org = { orgId: string; name: string; role: string };

export function OrgSwitcher({ orgs, current }: { orgs: Org[]; current: string }) {
  if (orgs.length < 2) {
    return <span className="text-sm text-muted">{orgs[0]?.name}</span>;
  }
  return (
    <form action={switchOrg}>
      <label className="sr-only" htmlFor="org-switch">
        Org
      </label>
      <select
        id="org-switch"
        name="orgId"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-48 truncate rounded-full border border-hair bg-transparent px-3 py-1.5 text-sm text-fg"
      >
        {orgs.map((o) => (
          <option key={o.orgId} value={o.orgId} className="bg-core text-fg">
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
