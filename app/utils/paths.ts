// ---------------------------------------------------------------------------
// Cross-platform path utilities
// ---------------------------------------------------------------------------

/**
 * Check if a path is absolute.
 * Windows: C:\, D:\, \\server\share
 * Linux/macOS: /usr/local
 */
export function isAbsolute(p: string): boolean {
  if (!p) return false;
  // Windows: drive letter + colon (C:\, D:\)
  if (/^[A-Za-z]:[/\\]/.test(p)) return true;
  // Windows: UNC path (\\server\share)
  if (p.startsWith("\\\\")) return true;
  // POSIX
  if (p.startsWith("/")) return true;
  return false;
}

/**
 * Normalize path separators to forward slashes.
 * Handles mixed separators like "D:\\code/foo\\bar".
 */
export function normalize(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Check if a path looks like it came from the browser's File System Access API
 * (i.e. just a directory name without any separators).
 */
export function isBareName(p: string): boolean {
  if (!p) return false;
  return !p.includes("/") && !p.includes("\\");
}

/**
 * Format a path for the OpenCode Server.
 * Returns undefined if the path is not usable as a server directory parameter.
 */
export function toServerDirectory(p: string | undefined): string | undefined {
  if (!p || !p.trim()) return undefined;
  const trimmed = p.trim();
  if (!isAbsolute(trimmed)) return undefined;
  return trimmed;
}
