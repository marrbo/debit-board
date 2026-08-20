// lib/wiki-utils.ts
import fs from 'fs';
import path from 'path';

export function getWikiTree(dir: string): any[] {
  // 🛡️ Verifica se a pasta existe antes de tentar ler
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const tree = files.map((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return {
        name: file,
        type: 'folder',
        path: fullPath,
        children: getWikiTree(fullPath),
      };
    } else if (file.endsWith('.md')) {
      return {
        name: file.replace('.md', ''),
        type: 'file',
        path: fullPath,
        url: `/wiki/${fullPath.replace(path.join(process.cwd(), 'content', 'wiki') + '/', '').replace('.md', '')}`,
      };
    }
    return null;
  }).filter(Boolean);

  return tree;
}