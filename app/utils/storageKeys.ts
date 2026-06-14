// ---------------------------------------------------------------------------
// localStorage key helpers
// ---------------------------------------------------------------------------

const PREFIX = "openspec:";

export const StorageKeys = {
  auth: {
    opencodeBaseUrl: `${PREFIX}opencode:baseUrl`,
    opencodeAuthorization: `${PREFIX}opencode:authorization`,
    zeroBaseUrl: `${PREFIX}zero:baseUrl`,
    zeroAuthorization: `${PREFIX}zero:authorization`,
    cliBridgeUrl: `${PREFIX}cli-bridge:url`,
    activeBackend: `${PREFIX}active:backend`,
  },
  ui: {
    locale: `${PREFIX}ui:locale`,
    sidebarWidth: `${PREFIX}ui:sidebarWidth`,
    theme: `${PREFIX}ui:theme`,
  },
} as const;

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota errors
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
