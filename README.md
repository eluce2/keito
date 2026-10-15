# Keito Raycast starter

This is a separate copy of your local Harvest extension, prepared for a Keito port on October 15, 2026. The API adapter is unfinished, so requests are disabled with an explicit error. The original Harvest extension remains in place.

## Source

- Editable original: `/Users/ericluce/Documents/Code/raycast-extensions/harvest`
- Installed Harvest bundle: `/Users/ericluce/.config/raycast/extensions/harvest`
- This copy: `/Users/ericluce/Documents/Code/raycast-extensions/keito`

The copy includes the original working tree's modified package.json. It excludes Git history, dependencies, generated Raycast types, and build output. Existing author and contributor attribution remains. HARVEST-README.md and CHANGELOG.md describe the inherited extension.

## What is ready

The extension has its own `keito` identity and command launch targets. Preferences request a Keito integration key and Company ID. The HTTP client targets `https://app.keito.ai/api/v2` with `Authorization: Bearer …` and `Keito-Account-Id` headers.

Inherited UI covers new entries, daily timesheets, favorites, stop/toggle commands, and a running-timer menu bar. Harvest icons, types, service filenames, and some app links still need conversion.

## Port the API adapter

1. Replace the Harvest project-assignment endpoint with Keito project discovery and project-specific tasks: `GET /projects?is_active=true` and `GET /tasks?project_id=…&is_active=true`. Adapt these responses to the form's project/task choices.
2. Resolve the user and company through `GET /users/me`. Verify company settings needed for time formatting and timestamp entry instead of assuming Harvest's `/company` endpoint exists.
3. Replace numeric ID assumptions with Keito string IDs. Verify entry response fields against the UI and handle `approval_status` and locked entries.
4. Follow `links.next` pagination, including relative URLs. The inherited adapter expects `next_page` to be an absolute URL. Keep pagination requests on the configured API origin.
5. Send `is_running: true` and omit `hours` to start a timer. Handle `409 running_timer_conflict`; use `replace_running: true` only for an intentional switch. Stop and restart use `PATCH /time_entries/:id/stop` and `/restart`.
6. Use documented date and time formats: `YYYY-MM-DD` for entry dates and `HH:mm` in the workspace timezone for start/end times. Verify error and rate-limit responses.
7. Replace inherited Harvest web/native-app links and branding. Review the optional status-file output and favorites for Keito data.
8. Remove the blocking request interceptor in `src/services/harvest.ts` after implementing and verifying the adapter.

An Administrator must create a separate full-access integration key bound to the person whose time this extension tracks. A personal read-only sync key cannot control timers or discover tasks. Enter credentials through Raycast preferences; keep them out of source files.

## Local checks

```sh
npm ci
npm run test:run
npm run build
```

The inherited tests cover duration parsing. A successful build does not verify Keito integration. After the adapter is ready, use `npm run dev` to register the extension in Raycast and verify project/task discovery, list pagination, create/edit, start/stop/restart, conflicts, favorites, and menu bar refresh with a test workspace.

## API sources

Reviewed October 15, 2026:

- [Integrations](https://keito.ai/docs/integrations/)
- [API quickstart](https://keito.ai/docs/developer/quickstart)
- [Time entries](https://keito.ai/docs/api-reference/time-entries)
- [API keys](https://keito.ai/docs/auth/api-keys)
