# Access Matrix

This document outlines the logic for when workspaces and sections are accessible by users.

The single source of truth for access decisions is the resolver in
`src/lib/permissions.ts`: `resolveTabAccess` for tabs/workspaces and
`resolveSectionAccess` for sections. All UI gating, filtering, and admin
mutations should defer to those functions rather than duplicating the rules.

## Workspace / Tab access

- Master Admins (admin view, not impersonating) can always see and edit everything.
- For standard users:
  - A workspace that is not set to "Add to the Catalog" is visible only to its owner(s). It does not appear in any other user's dashboard, nor in the workspace permissions or push matrix.
  - When a workspace is added to the catalog:
    - It shows in the workspace grid; admins can manage it completely.
    - It shows in the workspace permissions matrix with an "in catalog" toggle. Deselecting requires confirmation, since it cannot be added back without the original owner doing so.
    - Each group can have one of: owner (can assign access), edit, view, or not shared.
    - Each user can have one of: owner, edit, view, inherit, or not shared.
      - When inherit is selected, the user adopts the permissions of their group automatically. If the group's permissions change, inheriting users change with them.
      - New users default to `inherit` for all workspaces.
    - When group permissions change, a "power" button on the row resets all users in that group back to inherit.
    - The push matrix has a "push to all" option per workspace.
      - A pushed workspace appears in the user's dashboard.
      - A pushed workspace can also be locked, meaning the user cannot remove it from their dashboard.
      - Whenever a workspace is pushed to a user, the permissions matrix auto-updates with a push icon and access is set to viewer at minimum.
      - The same applies for groups: if a workspace is pushed to a group, every user in that group inherits the push (with viewer minimum and the push icon).
- A workspace appears in a user's catalog when any of the following hold:
  1. It is added to the catalog AND
  2. Either:
     a. It is pushed to the user (individually or via a group), OR
     b. The user has view, edit, or owner access in the permissions matrix.
- **Imported workspaces are never added to the catalog.** They live only in the importer's dashboard. The resolver and admin mutations enforce this — `updateTab`, sync import, and sync refresh all force `isLibraryItem = false` for `isReadOnlySync` records.

## Section access

- Master Admins can always see and edit every section.
- A section that is not in the catalog (`isLibraryItem = false`) is visible only to its owner(s).
- For catalog sections within a workspace the user has tab-level access to:
  - Tab owners and editors see and manage every section in the workspace.
  - Otherwise the section's own permissions apply: explicit user/department grants and denies, with `isGlobal` overriding blocks.
  - If the section has no explicit grant or deny for the user, visibility falls back to the user's tab access (having tab access implies seeing its content).
- **Imported sections are never added to the catalog.** Sync import/refresh creates them with `isLibraryItem = false`, and `togglePushRule` skips imported sections when auto-promoting a workspace's sections to the catalog.

## Resolver contract

`resolveTabAccess(tab, ctx)` and `resolveSectionAccess(section, tab, tabAccess, ctx)` return:

```ts
{
  role: "owner" | "editor" | "viewer" | "none",
  source: AccessSource,   // why the role was assigned (admin, global, push-*, owner, etc.)
  pushed: boolean,        // a push rule applies to this user
  locked: boolean,        // the applicable push rule is locked (cannot be removed)
  inherited: boolean      // role came from department/global, not an explicit user grant
}
```

`buildUserContext({ userId, dashboardGroup, isAdminView })` constructs the
`UserContext` consumed by the resolver. `canViewTab` / `canViewSection` are thin
helpers around the role check.
