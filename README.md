# Keito for Raycast

Track time in [Keito](https://keito.ai) from Raycast. Start, stop, and switch timers, log and edit entries, keep favorites, and see your running timer in the menu bar.

This extension is a port of the Harvest Raycast extension by eluce2 (contributors: bchopson, mrpunkin). It talks to the Keito API v2 at `https://app.keito.ai/api/v2`. [HARVEST-README.md](HARVEST-README.md) and the older entries in [CHANGELOG.md](CHANGELOG.md) describe the original extension.

## Setup

You need two values from Keito, entered in the extension preferences. Raycast asks for them the first time you open a command.

| Preference | Where to find it |
| --- | --- |
| **Keito Integration API Key** | A **full-access integration key** (`kto_…`). A workspace Administrator creates it under **Settings → API & Developers → Integration keys**, selects *you* as the identity, and chooses **All permitted operations**. |
| **Keito Company ID** | **Settings → API & Developers → Company ID** |

Use a key bound to the person whose time you track. Keito keys act as their bound identity, with that identity's current permissions and project assignments. A key an Administrator creates under *My account* would log time as the Administrator.

A **personal read-only sync key does not work**. It cannot list tasks or start, stop, create, edit, or delete time, and no setting upgrades it. The extension detects this key type and asks for a full-access key. OAuth and partner tokens are not supported.

After entering the values, run **Keito Connection**. It checks, in order:

1. The preferences are present and look like a Keito key and Company ID.
2. `GET /users/me` accepts the key, and the company it resolves to matches the Company ID.
3. You can see at least one active project.
4. You can read tasks for a project. This confirms a full-access key.

Every other command runs the same identity check first. If the key is missing, malformed, revoked, read-only, or for another company, the command shows the reason and a shortcut to the preferences instead of a broken view.

Credentials stay in Raycast's preferences. They are sent only to `https://app.keito.ai/api/v2`, only in the `Authorization` and `Keito-Account-Id` headers. They never appear in URLs, logs, toasts, or the status file. Pagination links are followed only on that origin and path.

## Commands

| Command | What it does |
| --- | --- |
| **Keito Connection** | Setup checks, the identity and company in use, Keito feature flags, and clearing cached data |
| **New Time Entry** | Start a timer (leave the duration blank) or log completed time |
| **Today's Timesheet** | Your entries for a day. Use ⌘← / ⌘→ to change days. Stop, restart, edit, duplicate, delete, or start a past entry again today |
| **Favorites** | Saved project/task/notes combinations that start a timer or log a fixed duration |
| **Stop Timer** | Stop your running timer |
| **Toggle Timer** | Stop the running timer, or restart today's most recently updated entry |
| **Running Timer** (menu bar, off by default) | The running timer and today's total, with stop, refresh, and shortcuts. Refreshes every minute and after changes made in the extension |
| **Reset Local Keito Data** | Clear cached projects, tasks, entries, and the verified identity. Favorites are kept |

### Timers

- Keito allows one running timer per person. Starting or restarting a timer never stops another timer silently. If one is running, Keito returns `409 running_timer_conflict`. The extension then shows which timer is running and asks before switching (`replace_running: true`).
- **Toggle Timer** and the menu bar never switch timers. If a timer started elsewhere in the meantime, they report the conflict.
- Timers stop through `PATCH /time_entries/:id/stop`, which calculates the duration on the server.

### Projects and tasks

Projects come from `GET /projects?is_active=true`. Tasks come from `GET /tasks?project_id=…&is_active=true` after you choose a project. Keito checks that the task is assigned to the project, and any rejection is shown with Keito's message. All IDs are strings.

### Approval and locked time

Each entry shows its approval status (Submitted, Approved, Rejected). Time approved in Keito reports `is_locked: true` while `is_closed` stays `false`, so the extension reads `approval_status` and `is_locked`. Approved, locked, and Harvest-closed entries have no edit, restart, or delete actions. Submitted time stays editable unless Keito rejects the change.

### Account separation

The verified identity is cached locally and re-checked every 6 hours and whenever the key or Company ID changes. The cache stores a truncated SHA-256 fingerprint of the credentials, never the key. Favorites, the last-used project, and cached lists are stored per Keito company and user, so switching keys never mixes data between accounts.

## Preferences

| Preference | Notes |
| --- | --- |
| Time Format | `1:30` or `1.50`. Keito's API exposes no company display settings, so this is a local choice. |
| Entry Fields | **Duration** (default), or **Start and End Times**. Times are `HH:mm` in the Keito workspace timezone. A new timer with a past start time requires Keito's *Past timer starts* company setting. |
| Title Field, client options | Inherited display options. |
| Sort By (Timesheet) | Updated or created time. |
| Status Folder (Menu bar) | See below. |

### Status folder

If you set **Status Folder** on the Running Timer command, the menu bar writes `currentTimer.json` to that folder while a timer runs and deletes it when no timer runs. Other tools, such as Keyboard Maestro or Hazel, can watch the file. The menu bar must be enabled for the file to update. Its format is stable and contains no credentials:

```json
{
  "schema": "keito-raycast/current-timer@1",
  "company_id": "…",
  "id": "…",
  "is_running": true,
  "spent_date": "2026-10-15",
  "hours": 1.25,
  "timer_started_at": "2026-10-15T09:00:00Z",
  "started_time": "09:00",
  "notes": "…",
  "project": { "id": "…", "name": "…", "code": "…" },
  "task": { "id": "…", "name": "…" },
  "client": { "id": "…", "name": "…" },
  "approval_status": "unsubmitted",
  "updated_at": "…"
}
```

## Limitations

- **"Today" uses your Mac's local date.** Keito interprets dates and `HH:mm` times in the workspace timezone. If the two differ, entries can land on a different day than you expect.
- Durations show the `hours` value Keito returns, which is refreshed on each load. The menu bar refreshes every minute.
- **Open Keito** opens `https://app.keito.ai`, or an installed app named "Keito" if one exists. Keito does not document deep links.
- The extension icon is a neutral placeholder, not Keito's official logo. The command icons are inherited generic glyphs.
- Rate limits: the extension honours `Retry-After` up to 30 seconds and retries at most twice. It retries server and network errors only for reads, so a create or start is never sent twice.
- Only time entries are supported. Expenses, approvals submission, and invoices are not.

## Why not the Keito SDK or CLI?

Both were evaluated on 2026-10-15:

- The published Node SDK (`@keito-ai/sdk` 0.1.0, March 2026) has no stop or restart methods and no `replace_running`. It also lacks `approval_status` on time entries and paginates by page number instead of following `links.next`. The documented package name, `@keito/sdk`, is not on npm.
- The Keito CLI is a separate Homebrew/Rust program. It has no edit, restart, or replace-running commands. It would add a process launch per action and a dependency Raycast extensions should not require.

The extension uses a small typed adapter instead ([`src/services/keito`](src/services/keito)).

## Development

```sh
npm ci
npm run test:run   # mocked-API unit and workflow tests
npm run build      # TypeScript check and Raycast build
npm run lint       # ESLint, Prettier, manifest validation
npm run dev        # register the extension in Raycast
```

The tests use scripted API responses. They cover onboarding errors (missing, malformed, revoked, read-only, and wrong-company credentials), credential changes, pagination with relative links and the origin guard, string IDs, task/project context, timer conflicts, approval and lock state, retries, the entry form logic, favorites, and the status file. **They do not prove the extension works against the live Keito API.**

## Live acceptance checklist

Run these with `npm run dev`, a full-access key bound to a test identity, and a test project. Steps marked ✎ change timesheet data.

1. **Keito Connection**: all four checks pass and show the expected name, company, and features. Then try a wrong Company ID, then a personal read-only sync key. Each should show its specific explanation.
2. **New Time Entry**: projects appear grouped by client. Changing the project reloads its tasks.
3. ✎ Start a timer with a blank duration. The menu bar shows it after a refresh.
4. ✎ Start a second timer. A switch prompt names the first one. **Cancel** keeps it; **Stop and Switch** replaces it.
5. ✎ Stop the timer from the menu bar, then use **Toggle Timer** twice (restart, then stop).
6. ✎ Log a completed entry with a duration, then edit its notes and duration, duplicate it, and delete the duplicate.
7. Optional: set **Entry Fields** to start/end times and log a completed entry with `HH:mm` times.
8. View yesterday's timesheet (⌘←). ✎ Use **Start on Today** on an entry.
9. ✎ Add a favorite with a duration and one without. Use both.
10. If the workspace has approved time: approved entries show an *Approved* tag and lock icon, with no edit or delete actions.
11. Pagination: if you have more than 100 projects or entries in a day, confirm all appear.
12. Set a status folder and confirm `currentTimer.json` appears while a timer runs and disappears after it stops.
