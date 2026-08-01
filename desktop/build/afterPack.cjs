/**
 * Ad-hoc-signerar macOS-appen efter paketering.
 *
 * Utan någon signatur alls vägrar macOS på Apple-kisel att starta appen och
 * rapporterar den som "skadad" — vilket låter som ett trasigt bygge men bara
 * betyder osignerad. En ad-hoc-signatur (`--sign -`) kostar inget utvecklarkonto
 * och gör att appen går att köra; den ersätter inte notarisering, så en nedladdad
 * kopia måste fortfarande befrias från karantänflaggan (se README).
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  // Misslyckas hellre här än att skicka ut ett paket som inte startar.
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
    stdio: "inherit",
  });
  console.log(`  • ad-hoc-signerade ${path.basename(appPath)}`);
};
