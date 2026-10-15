import {
  Alert,
  confirmAlert,
  environment,
  getPreferenceValues,
  Icon,
  launchCommand,
  LaunchType,
  LocalStorage,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise, usePromise } from "@raycast/utils";
import dayjs from "dayjs";
import { useMemo } from "react";
import { KeitoApi } from "./keito/api";
import { validateCredentials } from "./keito/config";
import { errorMessage, errorTitle, isKeitoError } from "./keito/errors";
import { formatHours as formatHoursValue, TimeFormat } from "./keito/normalize";
import { invalidateSessionOnSetupError, KeyValueStore, resolveSession, ResolvedSession } from "./keito/session";
import { Project, TimeEntry } from "./keito/types";
import { EntryMode, WorkflowContext } from "./keito/workflows";

export interface KeitoPreferences {
  token: string;
  accountID: string;
  timeFormat?: TimeFormat;
  entryMode?: EntryMode;
  titleDisplay?: "project" | "task";
  showClient?: boolean;
  showClientInProject?: boolean;
}

export function getKeitoPreferences(): KeitoPreferences {
  return getPreferenceValues<KeitoPreferences>();
}

export const store: KeyValueStore = LocalStorage;

let cachedApi: { key: string; api: KeitoApi } | undefined;

/** Build the API client from preferences. Throws a setup KeitoError when preferences are invalid. */
export function getApi(): KeitoApi {
  const credentials = validateCredentials(getKeitoPreferences());
  const key = `${credentials.accountId}\n${credentials.token}`;
  if (cachedApi?.key === key) return cachedApi.api;
  const api = new KeitoApi({
    ...credentials,
    onRateLimited: (seconds) => {
      if (environment.launchType === LaunchType.UserInitiated) {
        showToast({
          style: Toast.Style.Animated,
          title: "Keito is rate limiting requests",
          message: `Retrying in ${seconds}s…`,
        });
      }
    },
  });
  cachedApi = { key, api };
  return api;
}

export async function getSession(options: { force?: boolean } = {}): Promise<ResolvedSession> {
  const credentials = validateCredentials(getKeitoPreferences());
  const api = getApi();
  try {
    return await resolveSession(credentials, () => api.getIdentity(), store, options);
  } catch (error) {
    await invalidateSessionOnSetupError(error, store);
    throw error;
  }
}

export async function getWorkflowContext(
  options: { interactive?: boolean } = {}
): Promise<WorkflowContext & { session: ResolvedSession }> {
  const session = await getSession();
  return {
    api: getApi(),
    userId: session.identity.userId,
    session,
    confirmReplace: options.interactive ? confirmReplaceRunning : undefined,
  };
}

export function todayString(): string {
  return dayjs().format("YYYY-MM-DD");
}

export function formatHours(hours: number | undefined): string {
  return formatHoursValue(hours, getKeitoPreferences().timeFormat ?? "hours_minutes");
}

export function describeEntry(entry: Pick<TimeEntry, "projectName" | "taskName">): string {
  return `${entry.projectName} – ${entry.taskName}`;
}

export async function confirmReplaceRunning(running: TimeEntry | undefined): Promise<boolean> {
  return confirmAlert({
    icon: Icon.Clock,
    title: "Switch Timers?",
    message: running
      ? `A timer is already running for ${describeEntry(running)}${
          running.notes ? ` (“${running.notes}”)` : ""
        }. Stop it and start this one?`
      : "Another timer is already running in Keito. Stop it and start this one?",
    primaryAction: { title: "Stop and Switch", style: Alert.ActionStyle.Destructive },
  });
}

/** Show a failure toast. Setup problems also clear the stored identity and offer a link to preferences. */
export async function showKeitoError(error: unknown, fallbackTitle = "Keito request failed") {
  await invalidateSessionOnSetupError(error, store);
  // Log only the classification; error objects never include request headers.
  console.error(isKeitoError(error) ? `Keito error: ${error.kind} (${error.status ?? "no status"})` : error);
  const setup = isKeitoError(error) && error.isSetupProblem;
  await showToast({
    style: Toast.Style.Failure,
    title: isKeitoError(error) ? errorTitle(error) : fallbackTitle,
    message: errorMessage(error),
    primaryAction: setup
      ? { title: "Open Extension Preferences", onAction: () => openExtensionPreferences() }
      : undefined,
  });
}

export async function refreshMenuBar() {
  try {
    await launchCommand({ name: "menu-bar", type: LaunchType.Background });
  } catch {
    // The menu bar command is disabled by default; nothing to refresh.
  }
}

/** `attempt` > 0 forces a fresh GET /users/me check. Errors are rendered by KeitoGate, not toasts. */
export function useKeitoSession(attempt = 0) {
  return usePromise((n: number) => getSession({ force: n > 0 }), [attempt], { onError: () => undefined });
}

/** Active projects, cached per company/identity scope. */
export function useProjects(scope: string | undefined) {
  // The scope argument keeps cached projects separate for each company and identity.
  const result = useCachedPromise(
    (key: string) => (key ? getApi().listProjects() : Promise.resolve([])),
    [scope ?? ""],
    {
      execute: !!scope,
      keepPreviousData: false,
      onError: (error) => showKeitoError(error, "Could not load projects"),
    }
  );
  const byId = useMemo(() => new Map<string, Project>((result.data ?? []).map((p) => [p.id, p])), [result.data]);
  return { ...result, data: result.data ?? [], byId };
}

/** Tasks assigned to one project, cached per scope and project. */
export function useProjectTasks(scope: string | undefined, projectId: string | null | undefined) {
  const result = useCachedPromise(
    (key: string, id: string) => (key && id ? getApi().listProjectTasks(id) : Promise.resolve([])),
    [scope ?? "", projectId ?? ""],
    {
      execute: !!scope && !!projectId,
      keepPreviousData: false,
      onError: (error) => showKeitoError(error, "Could not load tasks"),
    }
  );
  return { ...result, data: projectId ? result.data ?? [] : [] };
}

export function useTimeEntries(session: ResolvedSession | undefined, date: string) {
  const result = useCachedPromise(
    (key: string, userId: string, day: string) =>
      key ? getApi().listTimeEntries({ userId, from: day, to: day }) : Promise.resolve([]),
    [session?.scope ?? "", session?.identity.userId ?? "", date],
    {
      execute: !!session,
      keepPreviousData: true,
      onError: (error) => showKeitoError(error, "Could not load time entries"),
    }
  );
  return { ...result, data: result.data ?? [] };
}
