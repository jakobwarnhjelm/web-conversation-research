/**
 * Gemensamma inställningar för allt främmande webbinnehåll (avsnitt 9).
 *
 * Fångade sidor kör i en egen persistent session, skild från appens egen. Det
 * håller deras cookies borta från renderaren och gör att en inloggning i ett
 * sidblock överlever omstart utan att appen själv får något sessionstillstånd.
 */
import { app } from "electron";

export const GUEST_PARTITION = "persist:tabflow-guest";

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
