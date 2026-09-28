// docker/realm-exporter/index.mjs
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const execFileP = promisify(execFile);

const PORT = parseInt(process.env.PORT ?? "3099", 10);
const TOKEN = process.env.EXPORTER_TOKEN;
const KEYCLOAK_CONTAINER =
  process.env.KEYCLOAK_CONTAINER ?? "debitboard-keycloak";
const KEYCLOAK_IMAGE =
  process.env.KEYCLOAK_IMAGE ?? "quay.io/keycloak/keycloak:26.7.2";
const REALM = process.env.KEYCLOAK_REALM ?? "debit-board";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

if (!TOKEN) {
  console.error("[exporter] EXPORTER_TOKEN não definido — abortando.");
  process.exit(1);
}

/** Garante que dois exports não rodem em paralelo. */
let inFlight = false;

function log(...args) {
  if (LOG_LEVEL !== "silent") console.log("[exporter]", ...args);
}

async function stopKeycloak() {
  log(`parando ${KEYCLOAK_CONTAINER}…`);
  await execFileP("docker", ["stop", KEYCLOAK_CONTAINER]);
}

async function startKeycloak() {
  log(`iniciando ${KEYCLOAK_CONTAINER}…`);
  await execFileP("docker", ["start", KEYCLOAK_CONTAINER]);
}

async function exportRealm() {
  const tmpFile = join(tmpdir(), `realm-${randomUUID()}.json`);
  const containerTmp = "/tmp/export.json";

  try {
    log(`rodando export offline em ${KEYCLOAK_IMAGE}…`);
    await execFileP(
      "docker",
      [
        "run",
        "--rm",
        "-v",
        `${tmpFile}:${containerTmp}`,
        KEYCLOAK_IMAGE,
        "export",
        "--file",
        containerTmp,
        "--realm",
        REALM,
        "--users",
        "realm_file",
      ],
      { maxBuffer: 20 * 1024 * 1024 }, // 20MB de stdout/stderr
    );

    return await readFile(tmpFile, "utf8");
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

const server = createServer(async (req, res) => {
  // ---------- Health ----------
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, busy: inFlight }));
    return;
  }

  // ---------- Export ----------
  if (req.method !== "POST" || req.url !== "/export") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (inFlight) {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Export já em andamento" }));
    return;
  }

  inFlight = true;
  const startedAt = Date.now();

  try {
    await stopKeycloak();
    const json = await exportRealm();
    await startKeycloak();

    const tookMs = Date.now() - startedAt;
    log(`export concluído em ${tookMs}ms`);

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "X-Export-Duration-Ms": String(tookMs),
    });
    res.end(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`erro: ${message}`);

    // Sempre tenta subir o Keycloak de volta — mesmo em caso de erro.
    await startKeycloak().catch((e) =>
      log(`FALHA ao reiniciar Keycloak: ${e.message}`),
    );

    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  } finally {
    inFlight = false;
  }
});

server.listen(PORT, () => {
  log(`escutando em :${PORT}`);
  log(`keycloak container: ${KEYCLOAK_CONTAINER}`);
  log(`keycloak image: ${KEYCLOAK_IMAGE}`);
  log(`realm: ${REALM}`);
});

// Shutdown limpo
process.on("SIGTERM", () => {
  log("SIGTERM recebido, encerrando…");
  server.close(() => process.exit(0));
});
