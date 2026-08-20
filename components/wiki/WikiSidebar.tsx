'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Folder, FileText } from 'lucide-react';

// Agora esse componente é apenas um Presentational Component.
// Ele recebe os dados por props e NÃO importa fs ou path.
export function WikiSidebar({ items, depth = 0 }: { items: any[], depth?: number }) {
  const pathname = usePathname();

  return (
    <div className="space-y-1 text-sm">
      {items.map((item, i) => (
        <div key={i}>
          {item.type === 'folder' ? (
            <div style={{ paddingLeft: `${depth * 12}px` }} className="flex items-center gap-2 py-1 text-muted-foreground hover:text-foreground cursor-pointer font-medium">
              <Folder size={16} className="text-muted-foreground" />
              <span>{item.name}</span>
            </div>
          ) : (
            <Link
              href={item.url}
              className={`block py-1 hover:text-primary transition-colors ${pathname === item.url ? 'text-primary font-semibold bg-secondary/50 rounded-r-md' : 'text-muted-foreground'}`}
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} />
                {item.name === 'index' ? 'Home' : item.name}
              </div>
            </Link>
          )}
          {item.children && <WikiSidebar items={item.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}