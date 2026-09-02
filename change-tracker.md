# Change Tracker: Home Dashboard

## Running Change Log

### 2026-09-02 - PCO Multi-Select Date Ranges, Pagination Controls & Overdue Call Red Highlights (v1.22.0)
- **Summary**: Delivered requested features for Planning Center Celebrations widget:
  1. **Multi-Select Date Range Options**: Built `filterByMultiDateRanges` in `src/lib/pco.ts` and enabled multi-selection for date ranges (`prev_month`, `current_month`, `next_month`, `prev_x_days`, `next_x_days`) with interactive filter chips in widget header.
  2. **Max Listings Pagination**: Added `maxItems` configuration setting and clean `< Prev` / `Next >` pagination bar with total celebration indicators.
  3. **Red Overdue Call Highlight**: When a celebration date has passed (`daysUntil < 0`) and has not been marked as called (`!isCalled`), the Call button glows red with an animated pulsing phone icon, subtle red card border, and "Overdue Call" badge.
- **Files Modified**:
  - [src/lib/pco.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/pco.ts) (added `filterByMultiDateRanges` for multi-range filtering)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated `fetchPcoBirthdaysAndAnniversaries` type signature and multi-range filtering)
  - [src/components/widgets/PcoBirthdaysWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PcoBirthdaysWidget.tsx) (added range chips, pagination bar, red overdue call highlighting)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.22.0`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1182ms with 0 errors.

### 2026-09-02 - PCO Household ID Anniversary Couple Pairing (v1.21.1)
- **Summary**: Resolved issue where anniversary couples with differing last names (e.g. IDs 118896795 and 118896800) were not combined into a single card. Updated PCO People API queries to request `?include=households` and extracted `householdId` from `relationships.households.data` and `primary_household_id`. Grouped anniversary items by `householdId` (`hh_${householdId}_${dateMonthDay}`), ensuring couples are 100% paired regardless of last name spelling differences, while continuing to link directly to the male profile card.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated `fetchPcoBirthdaysAndAnniversaries` to include households and group anniversaries by `householdId`)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.21.1`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 927ms with 0 errors.

### 2026-09-02 - PCO Celebrations Date Range Window, Combined Anniversaries, Prominent Date Badge & Clickable Cards (v1.21.0)
- **Summary**: Implemented key requested enhancements for the Planning Center Celebrations widget:
  1. **Custom Date Range Window**: Added configurable `daysBefore` (x days before today) and `daysAfter` (y days after today) settings and updated filtering in `src/lib/pco.ts` and `src/app/admin/actions.ts`.
  2. **Combined Anniversary Profiles**: Paired married spouses on anniversary dates into a single card (e.g. "John & Jane Smith") linked directly to the male profile.
  3. **Clickable Cards**: Made the entire card clickable to open the Planning Center profile, with `stopPropagation` added to Pencil (correction note) and Call buttons.
  4. **Prominent MMM-DD Date Badge**: Replaced the initials circle with a calendar-style date badge displaying uppercase month (`MMM`) and day (`DD`).
- **Files Modified**:
  - [src/lib/pco.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/pco.ts) (updated `PcoPersonItem`, signed days calculation, and date range window filter)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated `fetchPcoBirthdaysAndAnniversaries` for combined anniversary grouping and custom date window)
  - [src/components/widgets/PcoBirthdaysWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PcoBirthdaysWidget.tsx) (updated widget UI, date badge, card click handlers, and settings modal)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.21.0`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 975ms with 0 errors.

### 2026-09-02 - Workspace Edits & Drag-and-Drop Server Authorization Fix (v1.20.5)
- **Summary**: Pinpointed and fixed the exact root cause of the 500 Internal Server Error when saving workspace settings, adding sections, or performing drag-and-drop (`onDrop`). `addSectionToTab` in `src/app/admin/actions.ts` contained a redundant strict check (`tab.editors.some(...) || tab.owners.some(...)`) that threw an uncaught error for tabs without explicit owner/editor entries, overriding permission matrix rules. Removed the redundant check from `addSectionToTab` and updated `addSectionToTab` to safely update existing `tabSection` records instead of crashing on unique constraints. Updated `requireTabRole` in `src/lib/authz.ts` to grant edit permissions for unassigned non-read-only workspace tabs (`owners.length === 0 && editors.length === 0`) and allowed users (`allowedUsers`).
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (removed redundant strict check & added update handling in `addSectionToTab`)
  - [src/lib/authz.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/authz.ts) (updated `requireTabRole` for unassigned and allowed workspace tabs)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.20.5`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 966ms with 0 errors.

### 2026-09-02 - Widget Authorization & Error Boundary Diagnostics (v1.20.4)
- **Summary**: Identified and resolved the root cause of Minified React Error #441 affecting all widgets for non-admin users. During audit hardening, `fetchPortainerContainers` in `src/app/admin/actions.ts` called `requireAdmin()` outside its `try` block. Whenever a non-admin user loaded a tab containing a Portainer widget, `requireAdmin()` threw `Forbidden: Admin access required`, causing Next.js to return HTTP 500 (Internal Server Error) and React 19 to crash. Fixed `fetchPortainerContainers` to use `requireSession()` inside the `try` block. Built `WidgetErrorBoundary` component (`src/components/WidgetErrorBoundary.tsx`) and wrapped all widgets (`PortainerWidget`, `PcoBirthdaysWidget`, `FreeScoutWidget`, `OutlookCalendarWidget`) in `Dashboard.tsx` to render detailed inline diagnostic errors with a "Retry Widget Render" control instead of crashing the React application tree.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated `fetchPortainerContainers` authorization to `requireSession()`)
  - [src/components/WidgetErrorBoundary.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/WidgetErrorBoundary.tsx) (NEW: React Error Boundary for widgets)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (wrapped all widget components in `WidgetErrorBoundary`)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.20.4`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1046ms with 0 errors.

### 2026-09-02 - Server Action Authorization & CSP Fonts Fix (v1.20.3)
- **Summary**: Fixed 500 Internal Server Error during widget addition / section drag-and-drop (`addSectionToTab`). Updated `requireSectionRole` in `src/lib/authz.ts` to support unattached brand-new sections and validate target tab authorization (`targetTabId`). Connected real session user ID in `createSection` (`src/app/admin/actions.ts`). Updated `Content-Security-Policy` header in `next.config.ts` to allow Google Fonts stylesheet and font origins (`https://fonts.googleapis.com` and `https://fonts.gstatic.com`). Added `id` and `name` attributes to form fields in `PcoBirthdaysWidget.tsx`.
- **Files Modified**:
  - [src/lib/authz.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/authz.ts) (updated `requireSectionRole` for targetTabId and unattached section access)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated `createSection` to connect real user ID as owner and `addSectionToTab` to pass `targetTabId`)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard/next.config.ts) (updated CSP header to allow Google Fonts)
  - [src/components/widgets/PcoBirthdaysWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PcoBirthdaysWidget.tsx) (added `id` and `name` attributes to form elements)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.20.3`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 892ms with 0 errors.

### 2026-09-02 - PCO Celebrations & Widget Type Identification Fix (v1.20.2)
- **Summary**: Fixed a critical bug in `Dashboard.tsx` where any section with `isWidget: true` (such as `pco_birthdays`) was evaluated as `isPortainer = currentSection.isWidget || ...`, triggering Portainer container dereferencing and crashing with React Error #441 when adding or navigating the PCO Celebrations widget. Fixed widget identification checks in `flatMatchedBookmarks` and keyboard navigation. Added safe JSON parsing and explicit string coercion in `PcoBirthdaysWidget.tsx`.
- **Files Modified**:
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (fixed `isPortainer` condition checks in `flatMatchedBookmarks` and keyboard navigation)
  - [src/components/widgets/PcoBirthdaysWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PcoBirthdaysWidget.tsx) (added safe JSON parsing, error string coercion, and fallback rendering)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (converted `@/lib/pco` to static top-level import)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.20.2`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1002ms with 0 errors.

### 2026-09-02 - Workspace Edit Permissions & React Error #441 Fix (v1.20.1)
- **Summary**: Resolved 2 issues: (1) Fixed `requireTabRole` in `src/lib/authz.ts` to grant Admin users (`isAdmin: true`) full access to non-readOnlySync tabs, fixing workspace settings saving (`updateTab`) and section addition errors (`addSectionToTab`). Connected `getEffectiveUserId()` in `createSection` (`src/app/admin/actions.ts`). (2) Wrapped async widget catalog addition in `Dashboard.tsx` and modal forms (`TabModal`, `SectionModal`) in `try/catch` with explicit error alerts, resolving Minified React Error #441 and surfacing clear diagnostic notifications.
- **Files Modified**:
  - [src/lib/authz.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/authz.ts) (added Admin bypass check to `requireTabRole`)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (connected `getEffectiveUserId()` in `createSection`)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (wrapped widget catalog Add button handler in `try/catch`)
  - [src/components/TabModal.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/TabModal.tsx) (surfaced save error alerts)
  - [src/components/SectionModal.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/SectionModal.tsx) (surfaced save error alerts)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.20.1`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1004ms with 0 errors.

### 2026-09-02 - Planning Center (PCO) Birthdays & Anniversaries Widget (v1.20.0)
- **Summary**: Implemented a new Planning Center Online (PCO) Birthdays & Anniversaries Widget. Connects to PCO People API v2 to fetch upcoming birthdays and anniversaries from specified list IDs. Displays person photo/avatar, name (with direct links to PCO profiles at `https://people.planningcenteronline.com/people/{person_id}`), event pill badges, and days-until tags. Supports `Combined Feed` or `Split Sections` layouts, flexible date range filtering (`This Month`, `Next Month`, `Next 30/60/90 Days`), annual call tracking persistence (`togglePcoCallStatus`), and profile correction note submission directly into PCO Workflows (`submitPcoProfileCorrection`). Registered in Catalog Widgets (`Dashboard.tsx`).
- **Files Modified**:
  - [src/lib/pco.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/pco.ts) (created PCO API auth, date calculation, formatting, and filtering helpers)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `fetchPcoBirthdaysAndAnniversaries`, `submitPcoProfileCorrection`, and `togglePcoCallStatus` server actions)
  - [src/components/widgets/PcoBirthdaysWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PcoBirthdaysWidget.tsx) (created PCO widget component with profile links, call tracking, correction notes, and settings modal)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (registered `pco_birthdays` in Catalog Widgets and rendered widget component)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.20.0`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1654ms with 0 errors.

### 2026-09-01 - Portainer Modal Crash Fix & Search Bar + Arrow Navigation Selection (v1.19.1)
- **Summary**:
  1. Fixed crash when clicking Settings in Portainer widget by removing outdated `primarySortBy === "manual"` reference in modal container list sorting.
  2. Integrated Portainer containers into search bar selection and arrow-key navigation in `Dashboard.tsx` (`flatMatchedBookmarks`, `selectedSearchItem`, `isHighlighted` styling, mouse hover synchronization).
  3. Extended grid arrow-key navigation (`handleKeyDown`) so `ArrowDown`, `ArrowUp`, and `Enter`/`Space` navigate and open containers within Portainer sections.
- **Files Modified**:
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (fixed modal crash, added `selectedContainerName`, `onContainerHover`, and visual highlight)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (indexed containers for search and grid arrow navigation, connected container selection props)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.19.1`)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled 100% cleanly.

### 2026-09-01 - Card Elements Visibility & Draggable Multi-Tier Sort Priority for FreeScout & Portainer (v1.19.0)
- **Summary**:
  1. Added card elements visibility checklist in FreeScout settings modal to selectively toggle Ticket #, Mailbox Name, Status Pill, Date / Time, Message Preview, Customer / Submitter, and Assigned Owner.
  2. Implemented multi-tier draggable sorting priority with independent Asc/Desc order direction for FreeScout (supporting Status, Last Updated, Created Date, Ticket #, Customer Name, and Subject).
  3. Implemented multi-tier draggable sorting priority with independent Asc/Desc direction for Portainer (supporting Status, Name, Manual Order, Image, and Created Date).
- **Files Modified**:
  - [src/lib/freescout.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/freescout.ts) (added `FreeScoutSortRule` and `FreeScoutVisibleElements`)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (supported `sortRules` and `visibleElements` persistence)
  - [src/components/widgets/FreeScoutWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/FreeScoutWidget.tsx) (card elements visibility & draggable sort rules)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (draggable multi-tier sort rules with Asc/Desc selectors)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.19.0`)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled 100% cleanly.

### 2026-09-01 - FreeScout Widget Mailbox & Filter Drag-and-Drop Fix + Up/Down Controls (v1.18.4)
- **Summary**:
  1. Fixed HTML5 drag-and-drop event handling on mailbox and status items in `FreeScoutWidget.tsx` by setting `e.dataTransfer.effectAllowed = "move"`, `e.dataTransfer.setData("text/plain", ...)`, and `e.dataTransfer.dropEffect = "move"`.
  2. Fixed drag event interception by separating checkbox `<input>` and `<label>` controls from capturing drag gestures, adding drag-end cleanup handlers (`onDragEnd`) and visual drag-over border/background highlights.
  3. Added explicit 1-click `ChevronUp` and `ChevronDown` reorder buttons alongside the `GripVertical` handle for instant accessibility and mobile/trackpad convenience.
- **Files Modified**:
  - [src/components/widgets/FreeScoutWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/FreeScoutWidget.tsx) (HTML5 drag-and-drop event fix, Up/Down chevron buttons, drag-over styles)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.18.4`)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `DATABASE_URL="postgresql://user:pass@localhost:5432/db" npm run build` compiled 100% cleanly.

### 2026-08-31 - FreeScout In Progress Label, Draggable Mailbox Ordering & Draggable Status Priority (v1.18.3)
- **Summary**:
  1. Renamed "Pending" status label to "In Progress" across all widget badges, counter chips, cards, and modal checklists.
  2. Implemented drag-and-drop ordering for mailboxes in the settings modal with `mailboxOrder` state, allowing tabs to render in custom user-defined sequence.
  3. Implemented drag-and-drop ordering for ticket statuses in the settings modal with `statusOrder` state, dictating both header counter badge order and status sorting order.
- **Files Modified**:
  - [src/lib/freescout.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/freescout.ts) (added `mailboxOrder` and `statusOrder` support)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated actions to pass through and persist `mailboxOrder` and `statusOrder`)
  - [src/components/widgets/FreeScoutWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/FreeScoutWidget.tsx) ("In Progress" rename, draggable mailbox list, draggable status list)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.18.3`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - FreeScout Active Mailbox Tab Visibility & Drafts/Deleted Filtering (v1.18.2)
- **Summary**:
  1. Updated mailbox tab bar condition in `FreeScoutWidget.tsx` to check `activeMailboxes.length > 1` (calculated against `selectedMailboxIds`), ensuring the tab bar is hidden when only a single mailbox is active.
  2. Added filtering in `src/lib/freescout.ts` to exclude draft and deleted conversations (`state === "draft"`, `status === "draft"`, `item.isDraft`, `state === "deleted"`, `item.deletedAt`).
- **Files Modified**:
  - [src/lib/freescout.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/freescout.ts) (drafts & deleted conversations filter)
  - [src/components/widgets/FreeScoutWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/FreeScoutWidget.tsx) (active mailbox computation for tab visibility)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.18.2`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - FreeScout Mailbox Tabs, Header Control Pinning, Status Sorting & Closed Issues Fix (v1.18.1)
- **Summary**: Refined the FreeScout Help Desk widget based on user feedback:
  1. Added mailbox tabs (All Mailboxes + individual mailbox tabs) with issue counts, displayed whenever more than 1 mailbox is configured.
  2. Fixed header control layout to permanently pin Refresh and Settings buttons to the top right corner without wrapping.
  3. Added ticket status sorting (`sortBy: "status"` - Unresolved ➔ Pending ➔ Closed) to widget settings and client-side sorting.
  4. Fixed closed tickets displaying as open/unresolved by adding `normalizeFreeScoutStatus` to parse numeric status codes (`1`, `2`, `3`, `4`) and check `closedAt` / `closed_at` timestamps.
- **Files Modified**:
  - [src/lib/freescout.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/freescout.ts) (added `normalizeFreeScoutStatus` and status sorting)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (updated `sortBy` union type)
  - [src/components/widgets/FreeScoutWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/FreeScoutWidget.tsx) (mailbox tabs, pinned header controls, status sorting)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.18.1`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - FreeScout Help Desk Widget (v1.18.0)
- **Summary**: Built and shipped a native FreeScout Help Desk widget (`widgetType: "freescout"`). Connects to self-hosted FreeScout instances via REST API to display mailboxes with unresolved (active) and pending issues. Features interactive status filters, mailbox selection chips, text search, sorting by updated/created/ticket #, customer & assignee info, and direct 1-click issue link navigation. Includes a comprehensive settings modal with live connection testing and multi-mailbox checklists.
- **Files Modified**:
  - [src/lib/freescout.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/freescout.ts) (FreeScout REST API client, mailbox & conversation parser, connection tester)
  - [src/components/widgets/FreeScoutWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/FreeScoutWidget.tsx) (widget React UI, settings modal, status pills, filter chips)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added FreeScout server actions)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (widget rendering, catalog drawer, and global search matching)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.18.0`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - Purge Unused Icons Schema Field Fix (v1.17.1)
- **Summary**: Fixed Prisma query invocation error in `checkIconUsage` and `purgeUnusedCustomUploadedIcons`. `Theme` model fields are `logoIcon` and `backgroundColor` (not `icon`/`background`). Also added `GlobalSettings` app logo fields (`logoUrlLight`, `logoUrlDark`, `logoUrlSquareLight`, `logoUrlSquareDark`) to ensure custom app logos are never inadvertently purged.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (fixed Prisma `Theme` field names and added `GlobalSettings`)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.17.1`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - Purge Unused Custom Uploaded Icons (v1.17.0)
- **Summary**: Added an option in `IconPicker.tsx` (Custom tab ➔ Uploaded Custom Icons) to purge all unused custom uploaded icons from disk. Implemented `purgeUnusedCustomUploadedIcons` in `src/app/admin/actions.ts` to scan `public/uploads` and `public/uploads/icons`, cross-reference bookmarks, sections, tabs, and themes in Prisma DB, and delete unreferenced icon files with full confirmation and remaining count reporting.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `purgeUnusedCustomUploadedIcons`)
  - [src/components/IconPicker.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/IconPicker.tsx) (added Purge Unused button, handler, and state)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.17.0`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - Teams Link in Descriptions & Settings Token Preservation Fix (v1.16.3)
- **Summary**: Resolved 2 issues: (1) Added full `body` selection and regex/href link cleaner in `src/lib/outlook.ts` to detect Microsoft Teams meeting links in event descriptions/body. (2) Resolved "Calendar Error: Outlook account not connected" when saving widget settings or changing filters. Root cause: `handleSaveConfig` was passing client-side `rawConfig` that lacked newly acquired OAuth tokens, overwriting `section.widgetConfig` in the database. Added `saveOutlookWidgetSettingsAction` to merge settings safely in PostgreSQL while preserving OAuth tokens and account credentials across all tab sections.
- **Files Modified**:
  - [src/lib/outlook.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/outlook.ts) (added body field and enhanced Teams URL extractor)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `saveOutlookWidgetSettingsAction` and safe merge in `updateSectionWidgetConfig`)
  - [src/components/widgets/OutlookCalendarWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/OutlookCalendarWidget.tsx) (used `saveOutlookWidgetSettingsAction`)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.16.3`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - Outlook Widget Settings Modal Crash Fix & Type Guards (v1.16.2)
- **Summary**: Fixed client-side crash when clicking the Outlook Calendar widget settings gear. Root cause: `selectedCalendarIds`, `daysAhead`, `calendars`, or account profile variables could be non-array/object types during initial state synchronization, causing React render exceptions inside the settings modal. Added strict type guards and fallbacks for all modal render fields and array operations.
- **Files Modified**:
  - [src/components/widgets/OutlookCalendarWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/OutlookCalendarWidget.tsx) (hardened state parsing and modal rendering)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.16.2`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in Turbopack.

### 2026-08-31 - Outlook Subscribed Calendars & Connection State Persistence Fix (v1.16.1)
- **Summary**: Resolved 2 issues reported with the Microsoft Outlook Calendar widget: (1) Fixed missing subscribed calendar events by querying Microsoft Graph `GET /me/calendarGroups` and enumerating all calendar groups (Subscribed Calendars, Other Calendars, Shared Calendars). Updated `fetchOutlookEvents` to query all calendars in parallel via `/me/calendars/{calId}/calendarView`, attaching calendar names and color swatches. (2) Resolved premature "Outlook Disconnected" status by synchronizing React component state with `rawConfig` in `useEffect` and preventing transient network errors from clearing user authentication state.
- **Files Modified**:
  - [src/lib/outlook.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/outlook.ts) (added calendarGroups traversal and per-calendar view querying)
  - [src/components/widgets/OutlookCalendarWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/OutlookCalendarWidget.tsx) (synced state with rawConfig and added calendar color dot)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.16.1`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npx eslint` passed with 0 errors and 0 warnings.
  - `npm run build` compiled cleanly with Turbopack.

### 2026-08-31 - Microsoft Outlook Calendar Widget & Teams Integration (v1.16.0)
- **Summary**: Implemented a full-featured Microsoft Outlook Calendar widget. Features include: (1) Microsoft Graph API and OAuth 2.0 integration (`src/lib/outlook.ts`, `/api/widgets/outlook/auth`, `/api/widgets/outlook/callback`) with automatic offline token refresh. (2) Configurable date range (1 to 30 days ahead) for upcoming calendar events. (3) Calendar polling and live multi-select filter checklist allowing users to toggle visible calendars. (4) 1-click Microsoft Teams meeting launch with purple Teams badge/button for events containing online meeting links or Teams join URLs. (5) Widget Settings modal with Microsoft OAuth connect/disconnect, date range slider, and optional custom Azure app credentials. (6) Widget catalog registration in `Dashboard.tsx` with drag-and-drop / 1-click column placement. (7) Global dashboard search integration.
- **Files Modified**:
  - [src/lib/outlook.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/outlook.ts) (Microsoft Graph client, OAuth token refresh, event & calendar parser, Teams URL extractor)
  - [src/app/api/widgets/outlook/auth/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/widgets/outlook/auth/route.ts) (OAuth authorize route)
  - [src/app/api/widgets/outlook/callback/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/widgets/outlook/callback/route.ts) (OAuth callback, token exchange, profile query, postMessage opener notification)
  - [src/components/widgets/OutlookCalendarWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/OutlookCalendarWidget.tsx) (React widget component with event grouping, Teams join button, settings modal)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `fetchOutlookCalendarsAction`, `fetchOutlookEventsAction`, `disconnectOutlookAccountAction`)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (catalog drawer item, drop handler, search matching, rendering)
- **Validation**:
  - `npx eslint` passed with 0 errors / 0 warnings across all new and updated files.
  - `npm run build` compiled cleanly in 613ms with Turbopack.

### 2026-08-31 - Portainer Container Global Search & Section Position Persistence Fix (v1.15.1)
- **Summary**: Resolved 2 critical user issues: (1) Fixed section order mapping bug in `src/app/page.tsx` where `ts.order` was missing in `visibleSections` mapping, causing moved widget sections to revert to creation order when expanded or revalidated. (2) Integrated Portainer Docker containers into global dashboard search (`filteredTabs` and `flatMatchedBookmarks` in `Dashboard.tsx`). Searching in the top search bar now filters Portainer container cards, displays matching containers in keyboard search results, and launches container public URLs on Enter or click.
- **Files Modified**:
  - [src/app/page.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/page.tsx) (added `order: ts.order` mapping to preserve section column & order on re-renders)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (integrated Docker container search matching into `filteredTabs` & `flatMatchedBookmarks`)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (added `filter` and `onContainersLoaded` props)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.15.1`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 811ms with 0 errors.

### 2026-08-31 - Two-Tier Sorting, Uploaded Icon Library & Modal Drag Isolation (v1.15.0)
- **Summary**: Implemented 4 major user feature enhancements: (1) Added 2-tier sorting configuration (`primarySortBy`, `primarySortOrder`, `secondarySortBy`, `secondarySortOrder`) supporting Name, Status, and Manual ordering in `PortainerWidget.tsx`. Added Up/Down position movement buttons for manual container reordering. (2) Fixed inadvertent background and modal dragging when modals are open by stopping drag event propagation (`onDragStart`, `onDragOver`, `onDrop`) on modal overlays (`.modal-overlay`). (3) Added Uploaded Custom Icon Library to the "Custom" tab of `IconPicker.tsx` (shared across all icon pickers), allowing users to search, preview, and select previously uploaded custom icons. (4) Added icon deletion functionality with automated database usage checks (`checkIconUsage` in `src/app/admin/actions.ts`), displaying detailed warning alerts before deleting icons that are currently in use by bookmarks, sections, tabs, or themes.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `getCustomUploadedIcons`, `checkIconUsage`, and `deleteCustomUploadedIcon` server actions)
  - [src/components/IconPicker.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/IconPicker.tsx) (rendered searchable uploaded custom icon library and delete handler with in-use warnings)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (implemented 2-tier sorting, manual reordering controls, and modal drag isolation)
  - [src/components/BookmarkModal.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/BookmarkModal.tsx) (stopped drag propagation on modal overlay)
  - [src/components/SectionModal.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/SectionModal.tsx) (stopped drag propagation on modal overlay)
  - [src/components/TabModal.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/TabModal.tsx) (stopped drag propagation on modal overlay)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.15.0`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1421ms with 0 errors.

### 2026-08-31 - Automatic Public Container URL Discovery (v1.14.6)
- **Summary**: Implemented automatic public URL extraction for Portainer container cards. Added `extractPublicUrlFromLabels` in `src/app/admin/actions.ts` to parse container labels, supporting explicit URL labels (`homepage.url`, `homarr.url`, `public_url`, `public.url`, `url`), Nginx `VIRTUAL_HOST` labels, and Traefik `Host(...)` router rules (e.g. `traefik.http.routers.<app>.rule = Host(\`app.domain.com\`)\`). Updated `PortainerWidget.tsx` so clicking a container card automatically uses `c.inferredUrl` (the real public domain) when no custom URL is set, eliminating manual URL configuration.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `extractPublicUrlFromLabels` helper and attached `inferredUrl` to fetched containers)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (used `c.inferredUrl` as default launch URL before port fallback)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.6`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1009ms with 0 errors.

### 2026-08-31 - Portainer Sort Direction, Visibility Sorting & Icon Drop Zone Race Fix (v1.14.5)
- **Summary**: Implemented 3 user enhancements. (1) Added `sortOrder` state (`asc` / `desc`) to `PortainerWidget.tsx` allowing ascending or descending sorting for both Name and Status. (2) Fixed drag-and-drop race condition in `IconPicker.tsx` custom drop zone by adding `e.stopPropagation()` and checking `!e.currentTarget.contains(e.relatedTarget)` so dragging images over drop zone children does not toggle drag state or switch background tabs. (3) Sorted the Container Visibility list in Portainer Widget API Settings modal alphabetically by container name.
- **Files Modified**:
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (added `sortOrder` state/select, updated visible container sort, and sorted visibility list by name)
  - [src/components/IconPicker.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/IconPicker.tsx) (stopped drag event propagation and fixed child element leave checking)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.5`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 1135ms with 0 errors.

### 2026-08-31 - Portainer Widget Enhancements & Title Space Key Unblocking (v1.14.4)
- **Summary**: Resolved 3 Portainer widget and input editing requests. (1) Fixed issue where spaces could not be typed into title inputs in modals/widgets by checking `target.tagName` in `handleGridKeyDown` and `handleTabsKeyDown` in `src/components/Dashboard.tsx`. (2) Added status indicator dot badge (`#10b981` running / `#ef4444` stopped) overlaid on container icons in `src/components/widgets/PortainerWidget.tsx` so container state is visible even when custom logos are used. (3) Added `sortBy` setting (`name` | `status`) in Portainer widget settings with option dropdown to sort containers by status (running first) or alphabetically by name.
- **Files Modified**:
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (bypassed input/textarea elements in grid and tab keydown listeners)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/widgets/PortainerWidget.tsx) (added `sortBy` state, sort logic, status dot indicator badge, and sort dropdown in settings modal)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.4`)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npm run build` compiled cleanly in 811ms with zero errors.

### 2026-08-29 - Bookmark Duplication Feature (v1.14.3)
- **Summary**: Implemented a bookmark duplication feature. Added a `duplicateBookmark(id)` server action in `src/app/admin/actions.ts` that copies the original bookmark and places it right below it in the same section (shifting subsequent bookmarks up in order). Added a duplicate button (using Lucide `<Copy />` icon) in edit mode next to the delete button on bookmark cards in `src/components/Dashboard.tsx` with proper event propagation blocking (`stopPropagation`).
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (implemented `duplicateBookmark` server action)
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/components/Dashboard.tsx) (added duplicate button and stopped propagation on click)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.3`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard/package-lock.json) (updated lockfile version)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - Next.js production build (`npm run build`) succeeded.

### 2026-08-29 - Admin Bookmark Saving Permission Bypass Fix (v1.14.2)
- **Summary**: Fixed issue where saving bookmarks failed (the save button did nothing) for global administrators. The root cause was that `requireSectionRole` in `src/lib/authz.ts` lacked an admin bypass, thereby blocking normal admins from modifying bookmarks in sections where they were not explicitly owners/editors. Added admin bypass block following the access-matrix spec. Refined `isLocalAdmin` check to support both `admin@local` and `admin@local.host` emails. Resolved TypeScript and ESLint type lints in `src/lib/authz.ts`.
- **Files Modified**:
  - [src/lib/authz.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/authz.ts) (added admin bypass check to `requireSectionRole`, refined `isLocalAdmin` email validation, and resolved lints)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to `1.14.2`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard/package-lock.json) (updated lockfile version)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - Next.js production build (`npm run build`) succeeded.
  - ESLint verification (`npx eslint src/lib/authz.ts`) passed cleanly.

### 2026-08-13 - Dependency Security Upgrade & Next.js 16.3.1 (v1.14.1)
- **Summary**: Patched 17 npm vulnerabilities (1 low, 4 moderate, 9 high, 3 critical) including `@auth/core` CVE-2026-7rqj-j65f-68wh, `fast-uri` CVE-2026-2826-b924-f7ph, `undici` CVEs, `hono`, `nanoid`, `valibot`, and bumped `next` from `16.2.2` to `16.3.1` (and `eslint-config-next` to `16.3.1`) to resolve Next.js Server Component DoS / XSS / cache-poisoning advisories (GHSA-q4gf-8mx6-v5v3, GHSA-ffhc-5mcf-pf4q, etc.). Removed deprecated `eslint` option block from `next.config.ts`. Ran full `npm audit` verification bringing vulnerability count from 17 down to 0. Preserved fenced security and auth files (`src/auth.ts`, `src/lib/permissions.ts`, `src/lib/iam.ts`, `api/iam/*`, `entrypoint.sh`).
- **Files Modified**:
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.14.1`, `next` and `eslint-config-next` to `16.3.1`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package-lock.json) (locked dependencies, 0 vulnerabilities remaining)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/next.config.ts) (removed deprecated `eslint` option)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
- **Validation**:
  - `npm audit` returned 0 vulnerabilities (reduced from 17).
  - Next.js production build (`npm run build`) succeeded in Turbopack without warnings/errors.
  - Local smoke test verified `/login` HTTP 200 and rendered footer version `v1.14.1`.

### 2026-08-13 - Password Hashing Migration & Local Admin Hardening (v1.14.0)
- **Summary**: Resolved security audit finding M3 by migrating local administrator credential storage and verification from legacy plaintext to bcrypt hashing (`bcryptjs`, cost factor 12). Added nullable `passwordHash` field to Prisma `User` schema while keeping `password` temporarily for non-disruptive migration. Updated credentials provider in `src/auth.config.ts` to check `bcrypt.compare()` when `passwordHash` is present, falling back to legacy plaintext comparison with automatic silent upgrade (calculating bcrypt hash, storing `passwordHash`, and setting `password` to null on successful login). Removed hardcoded default `"admin"` plaintext password seed fallback, bootstrapping uninitialized admin accounts with a cryptographically secure random password printed once to container logs. Updated `updateLocalAdminSettings` in `src/app/admin/actions.ts` to hash passwords with bcrypt and clear plaintext fields. Created standalone post-deploy database migration script `scripts/migrate-passwords.mjs` to batch-upgrade existing plaintext passwords. Preserved fenced files (`entrypoint.sh` and `src/auth.ts`). Pre-migration Postgres dumps taken on MTCD and Abraham databases.
- **Files Modified**:
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/schema.prisma) (added `passwordHash String?` to User model)
  - [prisma/migrations/20260813213000_add_password_hash/migration.sql](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/migrations/20260813213000_add_password_hash/migration.sql) (migration SQL for `passwordHash` column)
  - [src/auth.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts) (added credentials provider with bcrypt verification, silent legacy upgrade, and random admin bootstrap)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (updated `updateLocalAdminSettings` to bcrypt-hash passwords and clear plaintext)
  - [scripts/migrate-passwords.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-passwords.mjs) (created batch password hashing migration script)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.14.0`)
  - [package-lock.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package-lock.json) (synchronized version to `1.14.0`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Validated local Next.js compilation via `npm run build`.
  - Unit tested bcrypt hashing and comparison.
  - Verified non-disruptive silent upgrade logic.
  - Confirmed pre-migration PostgreSQL backups captured on both servers.

### 2026-08-13 - Security Quick Hits & Hardening (v1.13.1)
- **Summary**: Implemented 8 security hardening and audit items across the application. Replaced `Math.random()` with `crypto.randomBytes(32)` for cryptographically secure IAM API key generation (M6). Removed URL query parameter `?api_key=` fallback in IAM roles (`/api/iam/roles`) and users (`/api/iam/users`) routes, requiring `Authorization: Bearer` or `X-API-Key` headers (M7). Replaced direct string comparisons with constant-time `crypto.timingSafeEqual` in `validateIamApiKey` and workspace sync token verification (L2). Bound development PostgreSQL port to loopback interface `127.0.0.1:5434:5432` in `docker-compose.yml` (L3). Added `checks: ["pkce", "state"]` to `MicrosoftEntraID` and `synology` OIDC providers in `src/auth.config.ts` (L4). Created in-memory sliding window rate limiter `src/lib/rate-limit.ts` and applied 60 req/min limit to `/api/track/click` (M8) and 10 req/min limit to POST `/api/auth/[...nextauth]` (L5). Added dangerous protocol filter (`javascript:`, `data:`, `vbscript:`, `file:`) to `parseBookmarksHtml` and sanitized bookmark URLs with `normalizeUrl` in `executeBookmarkImport` (L6). Added DNS-rebinding TOCTOU architectural documentation to `isSafeUrl` in `src/lib/ssrf.ts` (I3). Added explanatory documentation for `allowDangerousEmailAccountLinking` in `src/auth.config.ts` (I1) and documented unused `Session` model under JWT strategy in `prisma/schema.prisma` (I2).
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (used `crypto.randomBytes` for IAM API key generation - M6; normalized URLs during bookmark import - L6)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/iam/roles/route.ts) (removed `?api_key=` query param fallback - M7)
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/iam/users/route.ts) (removed `?api_key=` query param fallback - M7; bumped version to `1.13.1`)
  - [src/lib/iam.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/iam.ts) (timing-safe comparison for IAM API key - L2)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (timing-safe comparison for sync token - L2)
  - [docker-compose.yml](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/docker-compose.yml) (bound Postgres port to 127.0.0.1 - L3)
  - [src/auth.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/auth.config.ts) (added PKCE and state checks to Entra/Synology providers - L4; documented account linking intent - I1)
  - [src/lib/rate-limit.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/rate-limit.ts) (created sliding window rate limiter - L5, M8)
  - [src/app/api/track/click/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/track/click/route.ts) (applied 60 req/min rate limit - M8)
  - [src/app/api/auth/[...nextauth]/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/auth/%5B...nextauth%5D/route.ts) (applied 10 req/min rate limit on POST - L5)
  - [src/lib/bookmark-parser.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/bookmark-parser.ts) (filtered forbidden protocols - L6)
  - [src/lib/ssrf.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/ssrf.ts) (documented DNS rebinding TOCTOU window - I3)
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/prisma/schema.prisma) (documented unused Session model - I2)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.13.1`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Verified Next.js build compilation with `npm run build`.
  - Smoke-tested IAM 401 unauthenticated query rejection and track click rate limiter.

### 2026-08-13 - Security Hardening & Vulnerability Remediation (v1.13.0)
- **Summary**: Patched 3 Critical and 8 High findings from the security audit. Gated `getGlobalSettings` behind `requireAdmin` (C1). Added `requireSectionRole` authorization checks to all bookmark server actions `createBookmark`, `updateBookmark`, `deleteBookmark`, and `moveBookmark` (C2). Gated `fetchPortainerContainers` behind `requireAdmin` and added strict host allowlist validation against `ALLOWED_PORTAINER_HOSTS` / `PORTAINER_URL` before transmitting API credentials (C3). Removed unauthenticated development leftover endpoint `src/app/api/debug-tabs/route.ts` (H1). Removed SSRF fallback bypass in `downloadImageFromUrl` (H2). Hardened file upload handling in `src/app/api/upload/route.ts` and `uploadImage` server action with extension allowlists (`png`, `jpg`, `jpeg`, `webp`, `gif`, `ico`), 5MB size limit, magic-byte format validation, and sanitized filenames; added CSP (`default-src 'none'; img-src 'self'; style-src 'unsafe-inline'`) and nosniff headers to `/api/uploads/[...path]` static file server (H3). Fixed `getEffectiveUserId` to restrict impersonation checking to admin users (H5). Enforced self-or-admin authorization in `setUserDefaultTab` (H6). Added `requireAdmin` to `reorderTabs` (H7). Changed `transferTabOwnership` requirement from editor to tab owner (H8). Added SSRF validation via `isSafeUrl()` on cross-server workspace sync URLs in `importWorkspaceFromSyncUrl` and `refreshSyncedWorkspace` (H9). Added path-traversal guard to `encodeMediaToBase64` in `/api/sync/workspace` (H10). Configured global security response headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy) and disabled `X-Powered-By` header in `next.config.ts` (M1, L1; note: inline scripts and unsafe-eval are permitted as required by Next.js hydration). Gated `/api/icons` behind session check returning 401 for unauthenticated requests (M2).
- **Files Modified**:
  - [src/app/api/debug-tabs/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/debug-tabs/route.ts) (deleted unsafe debug endpoint - H1)
  - [src/app/api/icons/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/icons/route.ts) (added `requireSession()` guard returning 401 - M2)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (gated `getGlobalSettings` - C1; added authz to bookmark actions - C2; gated & allowlisted `fetchPortainerContainers` - C3; removed fallback in `downloadImageFromUrl` - H2; hardened `uploadImage` - H3; gated `getEffectiveUserId` - H5; enforced self-or-admin in `setUserDefaultTab` - H6; gated `reorderTabs` - H7; required owner in `transferTabOwnership` - H8; validated sync URLs with `isSafeUrl` - H9)
  - [src/lib/image-validation.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/image-validation.ts) (created image magic-byte, extension allowlist, and filename sanitization utilities - H3)
  - [src/app/api/upload/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/upload/route.ts) (hardened extension, 5MB limit, magic-byte sniffing, and sanitized filename - H3)
  - [src/app/api/uploads/[...path]/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/uploads/%5B...path%5D/route.ts) (added CSP and X-Content-Type-Options headers - H3)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (added path traversal resolution guard in base64 media loop - H10)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/next.config.ts) (disabled `poweredByHeader` and added global security headers - M1, L1)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.13.0`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Ran `npm run build` locally to verify Next.js compilation.
  - Verified `next.config.ts` module load.

### 2026-08-11 - Self-Hosted Icon Route URL Fix & Path Rewriter (v1.12.1)
- **Summary**: Fixed issue where stored `/uploads/icons/<hash>.<ext>` paths returned 404 on production because Next.js does not serve post-build files added to `/public/uploads/` directly. Updated `downloadIconToDisk` and `saveBase64IconToDisk` in `src/lib/icon-storage.ts` to return `/api/uploads/icons/<hash>.<ext>` paths, matching the runtime `/api/uploads/[...path]/route.ts` dynamic file server while keeping disk writes at `/app/public/uploads/icons/<hash>.<ext>`. Updated `encodeMediaToBase64` in `src/app/api/sync/workspace/route.ts` to match both `/uploads/` and `/api/uploads/` local paths. Updated `scripts/migrate-icons-to-disk.mjs` to check `/api/uploads/` for idempotency. Created `scripts/fix-icon-paths.mjs` ESM migration script with `--dry-run` default, `--apply` flag, and automated PostgreSQL table backups (`pg_dump` with Prisma JSON fallback) to rewrite existing `/uploads/icons/%` database values to `/api/uploads/icons/%`.
- **Files Modified**:
  - [src/lib/icon-storage.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/icon-storage.ts) (updated returned URL path format to `/api/uploads/icons/<hash>.<ext>`)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (updated `encodeMediaToBase64` to match both `/uploads/` and `/api/uploads/`)
  - [scripts/migrate-icons-to-disk.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-icons-to-disk.mjs) (updated `isExternalUrl` and `downloadIconToDisk` to skip `/api/uploads/` paths)
  - [scripts/fix-icon-paths.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/fix-icon-paths.mjs) (created path rewriter ESM migration script)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.12.1`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Tested ESM script loading and execution for `fix-icon-paths.mjs` and `migrate-icons-to-disk.mjs`.
  - Verified Next.js build compilation with `npm run build`.

### 2026-08-11 - Self-Hosted Icons & Storage Infrastructure (v1.12.0)
- **Summary**: Implemented self-hosted icon storage across the application to eliminate external CDN dependencies (Brandfetch expiration, jsDelivr slowdowns). Created `src/lib/icon-storage.ts` with `downloadIconToDisk` (5s timeout, 2MB max, content-type + magic-byte sniffing, SVG sanitization), `saveBase64IconToDisk`, `isExternalUrl`, and `isLucideIconName`. Updated `IconPicker.tsx` to route external icon URLs through a new server action `downloadAndStoreIcon` in `src/app/admin/actions.ts` emitting `/uploads/icons/<hash>.<ext>` paths while preserving search UX and gracefully handling errors. Updated `refreshSyncedWorkspace` and `processMediaField` to store local icons and updated `src/app/api/sync/workspace/route.ts` `encodeMediaToBase64` to inline external URLs as base64 data URIs. Created idempotent migration script `scripts/migrate-icons-to-disk.mjs` with `--dry-run` default, `--apply` flag, and automated PostgreSQL table backups (`pg_dump` with Prisma JSON fallback).
- **Files Modified**:
  - [src/lib/icon-storage.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/lib/icon-storage.ts) (created helper module)
  - [src/components/IconPicker.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/components/IconPicker.tsx) (routed external URLs through server action and emitted local paths)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (added `downloadAndStoreIcon` server action and updated `processMediaField`)
  - [src/app/api/sync/workspace/route.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/api/sync/workspace/route.ts) (extended `encodeMediaToBase64` for external URLs)
  - [scripts/migrate-icons-to-disk.mjs](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/scripts/migrate-icons-to-disk.mjs) (created icon migration ESM script)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.12.0`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Ran `npm run build` locally — compiled successfully in 21s with 0 errors.
  - Verified ESM migration script loads cleanly with `node scripts/migrate-icons-to-disk.mjs`.

### 2026-08-11 - Portainer & Workspace Sync Fetch Timeout Hardening (v1.11.2)
- **Summary**: Implemented defensive 5-second fetch timeouts (`AbortSignal.timeout(5000)`) and non-blocking error handling across all outbound server action fetches in `refreshSyncedWorkspace` and `fetchPortainerContainers`. Caught `AbortError` / `TimeoutError` exceptions cleanly, returning error objects instead of throwing, and added WARN log output specifying the target URL and elapsed duration. Updated `PortainerWidget` loading state to display a timeout indicator (`(5s timeout)`) and render an inline error card with a retry button when container fetches fail or time out.
- **Files Modified**:
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/actions.ts) (added `signal: AbortSignal.timeout(5000)`, WARN logging with target URL and elapsed time, and clean non-throwing error handling to `refreshSyncedWorkspace` and all `fetch` calls in `fetchPortainerContainers`)
  - [src/components/widgets/PortainerWidget.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/components/widgets/PortainerWidget.tsx) (added 5s timeout indicator to loading text and rendered inline error card with retry button on error)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.11.2`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Ran local `npm run build` compilation to verify complete type safety.
  - Verified Synology SSO button auto-hides via existing env gate (`hasSynology={!!process.env.SYNOLOGY_CLIENT_ID}`).

### 2026-08-11 - Abraham Container Env-Preservation Fix & Authentik Migration Path (v1.11.1)
- **Summary**: Rewrote `deploy_abraham_container()` in `update_portainer.py` to inspect the running `dashboard-app` container (`GET /api/endpoints/3/docker/containers/dashboard-app/json`) before recreating it. Preserves existing environment variables, `HostConfig` (port bindings & directory mounts), and `NetworkingConfig` across container redeployments instead of hardcoding static `SYNOLOGY_*` credentials and wiping container env state. Added minimal default env fallbacks for first-time deploys, ensured `REDEPLOY_DATE` is always updated to trigger image pull/restart, and removed hardcoded Synology credentials from deploy script to support transition to Authentik SSO (`https://auth.abraham16.com`).
- **Files Modified**:
  - [update_portainer.py](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/update_portainer.py) (rewrote `deploy_abraham_container()` to read container inspect config before recreate, parse existing `Env`, preserve `HostConfig`/`NetworkingConfig`, and inject missing minimal defaults)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.11.1`)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
- **Validation**:
  - Tested container inspection against Portainer endpoint 3 API (`GET /api/endpoints/3/docker/containers/dashboard-app/json`). Verified complete parsing of existing env dict, `HostConfig` (Binds, PortBindings), and `NetworkSettings.Networks`.
  - Confirmed image tag logic and "stop → remove → create → start" sequence preserved.

### 2026-08-11 - CI/CD Pipeline Rewrite (deploy.yml, no version bump)
- **Summary**: Rewrote `.github/workflows/deploy.yml` to fix chronic silent build hangs. Root cause was a single-runner multi-arch buildx step (`linux/amd64,linux/arm64`) that used QEMU emulation for arm64 and would stall 30-90 minutes on registry cache round-trips with no timeout, no fail-fast, and no post-deploy verification. Silent hangs meant the live site would stay on the old version for hours or days with no signal.
- **New pipeline shape**:
  - `build-amd64` job on native `ubuntu-latest` (x64) — no QEMU
  - `build-arm64` job on native `ubuntu-24.04-arm` (free for public repos)
  - `manifest` job combines both per-arch images into multi-arch manifests for `:${sha}`, `:v${version}`, `:latest`
  - `deploy` job runs `update_portainer.py` (self-gates by branch: `main` → MTCD, `abraham-prod` → Abraham), then **polls the live login page for the expected version**; workflow FAILS after 10 min of mismatch instead of silently succeeding.
  - Concurrency group per branch: superseded pushes auto-cancel.
  - Timeouts: 25 min per build job, 15 min on deploy job, 10 min on manifest job.
- **Result**: First run on the new pipeline (SHA 1d40178) completed in ~8 minutes end-to-end on both branches; previously-hung v1.11.0 build (previous SHA d7360e3) had been in_progress for 2+ hours. Both `home.server.mtcd.org` and `home.abraham16.com` now serve v1.11.0.
- **abraham-prod branch**: fast-forwarded from stale 41587d4 (July 22, v1.8.0) to 1d40178 (v1.11.0 + new deploy). No commits lost (ahead=0, behind=17 before ff).
- **Files modified**:
  - [.github/workflows/deploy.yml](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/.github/workflows/deploy.yml) — full rewrite
- **Deploy contract (canonical, going forward)**:
  - Any push to `main` deploys to Church Synology (home.server.mtcd.org)
  - Any push to `abraham-prod` deploys to Abraham Mac Mini (home.abraham16.com)
  - Both build the SAME multi-arch image tagged by SHA — arch mismatches at runtime are impossible
  - If the live footer version doesn't match `package.json` within 10 min post-deploy, the workflow FAILS red — no more silent v-mismatches
- **Fork status**: `benny2168/home-dashboard` (has no CI, never actually deployed anything) marked for archive. Abraham deploys exclusively via `mtcdtech/home-dashboard abraham-prod` branch now.

### 2026-07-25 - IAM Spec API & Key Manager UI Modal (v1.9.0)
- **Summary**: Implemented exact IAM portal roles specification (`GET /api/iam/roles`) returning `{ roles: [{ id: "admin", name: "Administrator", description: "..." }, ...] }`. Created DB-backed API key management in `GlobalSettings.iamApiKey`, and added an IAM Portal API section in the **Admin & IAM Settings** modal (`UserBoard.tsx`) exposing the Roles API URL, API Key viewer/copy controls, and a **Regenerate Key** button.
- **Files Created/Modified**:
  - [prisma/schema.prisma](file:///Users/benny2168/Antigravity/home-dashboard/prisma/schema.prisma) (added `iamApiKey` to `GlobalSettings`)
  - [prisma/migrations/20260725000000_iam_integration_add_mtcd_person_id/migration.sql](file:///Users/benny2168/Antigravity/home-dashboard/prisma/migrations/20260725000000_iam_integration_add_mtcd_person_id/migration.sql) (added `iamApiKey` column addition)
  - [src/lib/iam.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/lib/iam.ts) (added `getIamApiKey` and `validateIamApiKey` helpers)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/roles/route.ts) (returns exact spec shape)
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/users/route.ts) (uses `validateIamApiKey`)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (added `getIamApiDetails` and `regenerateIamApiKey` server actions)
  - [src/app/admin/users/UserBoard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/users/UserBoard.tsx) (IAM API URL display, API Key visibility toggle, copy buttons, and Regenerate Key button in Modal)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
- **Validation**:
  - `npx prisma generate` generated updated client.
  - `npm run build` compiled `/api/iam/roles` and `/api/iam/users` successfully.

### 2026-08-02 - Authentik Login Integration & Simplified Roles (v1.10.0)
- **Summary**: Implemented Authentik SSO login button rename to "Log in Securely". Simplified the exposed user roles schema to just `admin` and `standard`. Mapped Authentik group `app_homedashboard_admin` to grant admin rights in NextAuth `signIn` callback. Disabled webapp local admin edits and made user management view read-only with a notice redirecting admin role changes to the MTCD Admin Portal. Completed one-time reverse pull of active webapp admins to the Admin Portal and Authentik groups.
- **Files Created/Modified**:
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard/package.json) (bumped version to 1.10.0)
  - [src/app/login/LoginForm.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/login/LoginForm.tsx) (SSO button renamed)
  - [src/app/api/iam/roles/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/roles/route.ts) (roles reduced to `admin` / `standard`)
  - [src/app/api/iam/users/route.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/api/iam/users/route.ts) (user role mapping and version update)
  - [src/auth.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/auth.ts) (mapped Authentik group to `isAdmin`)
  - [src/app/admin/actions.ts](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/actions.ts) (disabled toggleUserAdmin)
  - [src/app/admin/users/UserBoard.tsx](file:///Users/benny2168/Antigravity/home-dashboard/src/app/admin/users/UserBoard.tsx) (static admin badge and warning note added)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard/notes-next-session.md)
- **Validation**:
  - Executed Portainer Exec sync script inside `admin-portal` container to perform reverse pull sync.
  - Run Next.js build compilation locally with `DATABASE_URL` check. Build compiled successfully.

### 2026-08-11 - Performance Optimization Runbook (v1.11.0)
- **Summary**: Implemented end-to-end performance optimizations from `perf-runbook.md`. Enabled SSR HTML rendering on Dashboard component, un-blocked TTFB by converting avatarColor database updates to async background tasks, slimmed Prisma group/department queries with distinct filtering, and integrated `@next/bundle-analyzer`.
- **Files Created/Modified**:
  - [src/components/Dashboard.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/components/Dashboard.tsx) (removed SSR-killer `if (!mounted) return null` gate and gated theme toggle icon)
  - [src/app/page.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/page.tsx) (converted `prisma.user.update` for `avatarColor` to fire-and-forget `.catch(...)`)
  - [src/app/admin/sync/page.tsx](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/src/app/admin/sync/page.tsx) (slimmed Prisma `dashboardGroup` query with `distinct` and `where: { not: null }`)
  - [next.config.ts](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/next.config.ts) (wrapped config with `@next/bundle-analyzer`)
  - [.gitignore](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/.gitignore) (added `perf-reports/`)
  - [package.json](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/package.json) (bumped version to `1.11.0` and added `@next/bundle-analyzer` devDependency)
  - [perf-reports/bundle-2026-08-11.html](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/perf-reports/bundle-2026-08-11.html) (saved client bundle analyzer report)
  - [current-state.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/current-state.md)
  - [change-tracker.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/change-tracker.md)
  - [notes-next-session.md](file:///Users/benny2168/Antigravity/home-dashboard-mtcd/notes-next-session.md)
- **Validation**:
  - `ANALYZE=true npx next build --webpack` completed successfully.
  - Generated client bundle analysis report at `perf-reports/bundle-2026-08-11.html`.


