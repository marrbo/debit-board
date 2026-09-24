import fs from "fs";
import path from "path";

export interface WikiNode {
  type: "folder" | "file";
  name: string;
  url?: string;
  children?: WikiNode[];
}

export interface GetWikiTreeOptions {
  includeDev?: boolean;
  includeAdmin?: boolean;
}

const HIDDEN = new Set(["node_modules", ".git", ".next", ".turbo"]);

export function getWikiTree(
  root: string,
  opts: GetWikiTreeOptions = {},
): WikiNode[] {
  const { includeDev = false, includeAdmin = false } = opts;

  function walk(dir: string, relPath: string): WikiNode[] {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const folders: WikiNode[] = [];
    const files: WikiNode[] = [];

    for (const entry of entries) {
      const { name } = entry;
      if (name.startsWith(".") || HIDDEN.has(name)) continue;

      const entryRel = relPath ? `${relPath}/${name}` : name;

      if (entry.isDirectory()) {
        if (name === "_dev" && !includeDev) continue;
        if (name === "admin" && !includeAdmin) continue;

        const children = walk(path.join(dir, name), entryRel);
        if (children.length === 0) continue;

        folders.push({ type: "folder", name, children });
      } else if (entry.isFile() && name.endsWith(".md")) {
        files.push({
          type: "file",
          name: name.replace(/\.md$/, ""),
          url: `/wiki/${entryRel.replace(/\.md$/, "")}`,
        });
      }
    }

    files.sort((a, b) => {
      if (a.name === "index") return -1;
      if (b.name === "index") return 1;
      const an = a.name.match(/^(\d+)\./);
      const bn = b.name.match(/^(\d+)\./);
      if (an && bn) return Number(an[1]) - Number(bn[1]);
      if (an) return -1;
      if (bn) return 1;
      return a.name.localeCompare(b.name);
    });

    folders.sort((a, b) => a.name.localeCompare(b.name));

    return [...folders, ...files];
  }

  return walk(root, "");
}
