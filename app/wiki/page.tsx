import fs from "fs";
import path from "path";
import { redirect } from "next/navigation";

export default function WikiRootPage() {
  const indexPath = path.join(process.cwd(), "content", "wiki", "index.md");
  if (fs.existsSync(indexPath)) redirect("/wiki/index");

  return (
    <div className="p-8 text-center text-muted">
      <h1 className="text-2xl font-bold mb-4">Wiki não inicializada</h1>
      <p>
        Crie <code>content/wiki/index.md</code> para começar.
      </p>
    </div>
  );
}
