import { Action, ActionPanel, Color, Icon, List, openExtensionPreferences } from "@raycast/api";
import { ReactNode, useState } from "react";
import { KEITO_API_KEYS_DOCS_URL, KEITO_WEB_URL } from "../services/keito/config";
import { errorMessage, errorTitle, isKeitoError } from "../services/keito/errors";
import { ResolvedSession } from "../services/keito/session";
import { useKeitoSession } from "../services/useKeito";

export function SetupActions({ onRetry }: { onRetry?: () => void }) {
  return (
    <>
      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
      {onRetry && (
        <Action
          title="Verify Connection Again"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={onRetry}
        />
      )}
      <Action.OpenInBrowser title="Open Keito Setup Guide" url={KEITO_API_KEYS_DOCS_URL} />
      <Action.OpenInBrowser title="Open Keito" url={KEITO_WEB_URL} shortcut={{ modifiers: ["cmd"], key: "o" }} />
    </>
  );
}

export function ConnectionErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const setup = isKeitoError(error) && error.isSetupProblem;
  return (
    <List>
      <List.EmptyView
        icon={{ source: setup ? Icon.Key : Icon.ExclamationMark, tintColor: setup ? Color.Orange : Color.Red }}
        title={errorTitle(error)}
        description={errorMessage(error)}
        actions={
          <ActionPanel>
            <SetupActions onRetry={onRetry} />
          </ActionPanel>
        }
      />
    </List>
  );
}

/**
 * Verifies preferences and identity before rendering a command. Every view command goes through
 * this, so missing, malformed, rejected, read-only, or mismatched credentials show setup guidance
 * instead of a broken view.
 */
export function KeitoGate({ children }: { children: (session: ResolvedSession) => ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const { data: session, error, isLoading } = useKeitoSession(attempt);

  if (isLoading) return <List isLoading searchBarPlaceholder="Connecting to Keito…" />;
  if (error || !session) return <ConnectionErrorView error={error} onRetry={() => setAttempt((n) => n + 1)} />;
  return <>{children(session)}</>;
}
