// scripts/validate-navigation.ts
/**
 * Verificação de sanidade entre `NAVIGATION` e as rotas do App Router.
 *
 * Percorre `app/**\/page.tsx`, extrai o path normalizado e compara
 * com os `href` registrados. Rotas órfãs aparecem como aviso (não
 * falha o build), ajudando a manter o registry em dia.
 *
 * Adicione ao `package.json`:
 *   "scripts": {
 *     "validate:nav": "tsx scripts/validate-navigation.ts"
 *   }
 */

import fs from "node:fs";
import path from "node:path";
import { NAVIGATION } from "../lib/navigation";

const APP_DIR = path.join(process.cwd(), "app");

/** Converte `app/settings/projects/page.tsx` → `/settings/projects`. */
function pageFileToRoute(absPath: string): string {
  const rel = path.relative(APP_DIR, absPath).replace(/\\/g, "/");
  const noPage = rel.replace(/\/?page\.tsx$/, "").replace(/^page\.tsx$/, "");
  if (!noPage) return "/";
  // Remove route groups `(group)` e dynamic segments não resolvíveis
  const cleaned = noPage
    .split("/")
    .filter((seg) => seg && !seg.startsWith("(") && !seg.startsWith("["))
    .join("/");
  return cleaned ? `/${cleaned}` : "/";
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name === "page.tsx") acc.push(full);
  }
  return acc;
}

function main() {
  if (!fs.existsSync(APP_DIR)) {
    console.error(`✗ ${APP_DIR} não existe.`);
    process.exit(1);
  }

  const appRoutes = new Set(walk(APP_DIR).map(pageFileToRoute));
  const navRoutes = new Set(
    NAVIGATION.filter((n) => n.href !== "#").map((n) => n.href),
  );

  // Rotas no FS que não estão no registry → Header não terá metadados
  const missing = Array.from(appRoutes).filter(
    (r) =>
      !navRoutes.has(r) &&
      // Ignora rotas utilitárias
      !r.startsWith("/api") &&
      !r.includes("/login") &&
      !r.includes("/tv"),
  );

  // Rotas no registry que não existem no FS → link quebrado
  const orphans = Array.from(navRoutes).filter((r) => !appRoutes.has(r));

  console.log(`\n───────────  NAVIGATION ───────────`);
  console.log(`Rotas em app/:     ${appRoutes.size}`);
  console.log(`Registradas:       ${navRoutes.size}`);

  if (missing.length > 0) {
    console.log(`\n⚠ ${missing.length} rota(s) sem entrada em NAVIGATION:`);
    for (const r of missing) console.log(`   - ${r}`);
  }

  if (orphans.length > 0) {
    console.log(
      `\n✗ ${orphans.length} href(s) apontam para rotas inexistentes:`,
    );
    for (const r of orphans) console.log(`   - ${r}`);
    process.exit(1);
  }

  if (missing.length === 0 && orphans.length === 0) {
    console.log(`\n✓ NAVIGATION em sync com as rotas do App Router.\n`);
  }
}

main();
