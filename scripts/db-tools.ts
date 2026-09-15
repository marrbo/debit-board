// scripts/db-tools.ts
import { dumpDatabase, restoreDatabase } from "@/lib/db-tools";
import path from "node:path";

// ============================================================
// Parser de argumentos — zero dependências
// ============================================================
interface Args {
  command: "dump" | "restore" | null;
  uri?: string;
  dir?: string;
  dbName?: string;
  append?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: null };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    switch (token) {
      case "--dump":
        args.command = "dump";
        break;
      case "--restore":
        args.command = "restore";
        break;
      case "--uri":
        args.uri = argv[++i];
        break;
      case "--dir":
      case "--output":
      case "--input":
        args.dir = argv[++i];
        break;
      case "--db":
        args.dbName = argv[++i];
        break;
      case "--append":
        args.append = true;
        break;
    }
  }

  return args;
}

function printUsage(): void {
  console.log(`
Uso:
  tsx scripts/db-tools.ts --dump    --uri <mongo-uri> --dir <output>  [--db <name>]
  tsx scripts/db-tools.ts --restore --uri <mongo-uri> --dir <input>   [--db <name>] [--append]

Variáveis de ambiente (fallback quando --uri/--dir não são passados):
  MONGODB_URI           (Container) URI de origem/destino (Atlas, local, etc.)
  MONGODB_URI_LOCAL     (Local)     URI de origem/destino (Atlas, local, etc.)
  DB_DUMPS_DIR          Diretório padrão de dumps (default: ./dumps)

Exemplos:
  # Dump do Atlas para ./dumps/atlas-2026-09-13
  tsx scripts/db-tools.ts --dump \\
    --uri "$ATLAS_URI" \\
    --dir ./dumps/atlas-2026-09-13

  # Restore no Mongo local
  tsx scripts/db-tools.ts --restore \\
    --uri "mongodb://localhost:27017/debit-board" \\
    --dir ./dumps/atlas-2026-09-13
`);
}

// ============================================================
// Entry point
// ============================================================
async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command) {
    printUsage();
    process.exit(1);
  }

  const uri = args.uri ?? process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ URI do MongoDB não informada. Use --uri ou MONGODB_URI.");
    process.exit(1);
  }

  const defaultDir =
    args.command === "dump"
      ? path.join(process.env.DB_DUMPS_DIR ?? "./dumps", new Date().toISOString().replace(/[:.]/g, "-"))
      : process.env.DB_DUMPS_DIR ?? "./dumps";

  const dir = args.dir ?? defaultDir;

  const onProgress = (event: { type: string; [k: string]: unknown }) => {
    switch (event.type) {
      case "start":
        console.log(`▶ ${args.command} — db:${event.dbName} — ${event.totalCollections} coleções`);
        break;
      case "collection-start":
        process.stdout.write(`  [${event.index}] ${event.collection}...`);
        break;
      case "collection-done":
        console.log(` ${event.count} docs`);
        break;
      case "done":
        console.log(`✅ Concluído. ${event.totalDocuments} documentos.`);
        break;
    }
  };

  try {
    if (args.command === "dump") {
      const manifest = await dumpDatabase({ uri, outputDir: dir, dbName: args.dbName, onProgress });
      console.log(`Manifest: ${path.join(dir, "manifest.json")}`);
      console.log(`Coleções: ${manifest.collections.length}`);
    } else {
      const result = await restoreDatabase({
        uri,
        inputDir: dir,
        dbName: args.dbName,
        dropExisting: !args.append,
        onProgress,
      });
      console.log(`Coleções restauradas: ${result.collections.length}`);
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Falhou:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

run();