/**
 * Google Drive URL Validator
 * Strictly validates that a URL is an HTTPS link pointing to genuine Google Drive,
 * Docs, Sheets, or Slides resources.
 *
 * Rejects:
 * - Non-HTTPS protocols (http:, javascript:, data:, file:, etc.)
 * - Malformed URLs
 * - Lookalike domains (e.g. drive.google.com.attacker.com, google-drive.com, etc.)
 * - Unsupported paths
 */

const ALLOWED_GOOGLE_HOSTNAMES = new Set([
  "drive.google.com",
  "docs.google.com",
  "sheets.google.com",
  "slides.google.com",
]);

/**
 * Validates a single Google Drive URL.
 * @param {string} rawUrl
 * @returns {{ valid: boolean, error?: string, cleanUrl?: string }}
 */
export function validateGoogleDriveUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "Please enter a valid Google Drive link." };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter a valid Google Drive link." };
  }

  try {
    const parsed = new URL(trimmed);

    // 1. Enforce HTTPS only
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "Google Drive links must use secure HTTPS protocol." };
    }

    // 2. Strict Hostname Validation (Exact match against trusted set)
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_GOOGLE_HOSTNAMES.has(hostname)) {
      return { valid: false, error: "Please enter a valid Google Drive link." };
    }

    // 3. Path Validation
    const pathname = parsed.pathname;

    if (hostname === "drive.google.com") {
      // Allowed paths: /file/d/..., /drive/folders/..., /drive/u/.../folders/..., /open?...
      const isDrivePath =
        pathname.startsWith("/file/d/") ||
        pathname.startsWith("/drive/folders/") ||
        pathname.startsWith("/drive/u/") ||
        pathname.startsWith("/open") ||
        pathname.startsWith("/uc");

      if (!isDrivePath) {
        return { valid: false, error: "Please enter a valid Google Drive sharing link." };
      }
    } else if (hostname === "docs.google.com") {
      // Allowed paths: /document/d/..., /spreadsheets/d/..., /presentation/d/..., /forms/d/...
      const isDocPath =
        pathname.startsWith("/document/d/") ||
        pathname.startsWith("/spreadsheets/d/") ||
        pathname.startsWith("/presentation/d/") ||
        pathname.startsWith("/forms/d/");

      if (!isDocPath) {
        return { valid: false, error: "Please enter a valid Google Docs, Sheets, or Slides link." };
      }
    }

    return { valid: true, cleanUrl: trimmed };
  } catch (err) {
    return { valid: false, error: "Please enter a valid Google Drive link." };
  }
}

/**
 * Validates an array of resource or submission links.
 * Each item must be: { title?: string, url: string }
 * @param {Array<{ title?: string, url: string }>} links
 * @returns {{ valid: boolean, error?: string, sanitizedLinks?: Array<{ title: string, url: string }> }}
 */
export function validateGoogleDriveLinks(links) {
  if (!Array.isArray(links)) {
    return { valid: false, error: "Links must be an array." };
  }

  const sanitized = [];
  for (let i = 0; i < links.length; i++) {
    const item = links[i];
    if (!item || typeof item !== "object") {
      return { valid: false, error: `Link #${i + 1} is invalid.` };
    }

    const title = String(item.title || "").trim();
    const urlValidation = validateGoogleDriveUrl(item.url);
    if (!urlValidation.valid) {
      return { valid: false, error: `Link #${i + 1}: ${urlValidation.error}` };
    }

    sanitized.push({
      title: title || `Resource ${i + 1}`,
      url: urlValidation.cleanUrl,
    });
  }

  return { valid: true, sanitizedLinks: sanitized };
}
