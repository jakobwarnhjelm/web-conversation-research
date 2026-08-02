/**
 * Gemensamma inställningar för allt främmande webbinnehåll (avsnitt 9).
 *
 * Fångade sidor kör i en egen persistent session, skild från appens egen. Det
 * håller deras cookies borta från renderaren och gör att en inloggning i ett
 * sidblock överlever omstart utan att appen själv får något sessionstillstånd.
 */
import { app, session, type Session } from "electron";

export const GUEST_PARTITION = "persist:tabflow-guest";

export function guestSession(): Session {
  return session.fromPartition(GUEST_PARTITION);
}

/**
 * Utan behörighetshanterare beviljar Electron det mesta som en sida ber om. En
 * anteckningsbok behöver varken kamera, mikrofon, position, notiser eller urklipp,
 * och en inbäddad sida kan be om dem i en vy användaren inte ens tittar på — eller
 * i det dolda fönster som fångsten använder. Därför nekas allt.
 */
export function hardenGuestSession(): void {
  const s = guestSession();
  s.setUserAgent(GUEST_USER_AGENT);
  s.setPermissionRequestHandler((_wc, permission, callback) => {
    console.log(`[tabflow] nekade behörighet: ${permission}`);
    callback(false);
  });
  s.setPermissionCheckHandler(() => false);
}

/** Rensar allt sessionstillstånd — kakor, lagring, cache. Loggar ut från allt. */
export async function clearGuestSession(): Promise<void> {
  const s = guestSession();
  await s.clearStorageData();
  await s.clearCache();
  await s.clearAuthCache();
}

/**
 * Sidor serveras annorlunda — ibland som "webbläsaren stöds inte" — när UA:n
 * innehåller "Electron". Vi presenterar oss som den Chrome vi faktiskt är.
 */
export const GUEST_USER_AGENT = buildUserAgent();

function buildUserAgent(): string {
  const chrome = process.versions.chrome ?? "124.0.0.0";
  const base = app.userAgentFallback ?? "";
  const cleaned = base
    .replace(/ Electron\/[\d.]+/, "")
    .replace(new RegExp(` ${app.getName()}\\/[\\d.]+`), "");
  return cleaned || `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`;
}
