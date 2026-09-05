// components/ProjectDrawer.tsx
'use client';

import { X, ExternalLink, Database, FolderGit2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { IProject } from '@/types/IProject';

interface ProjectDrawerProps {
  project: IProject | null;
  onClose: () => void;
}

export default function ProjectDrawer({ project, onClose }: ProjectDrawerProps) {
  if (!project) return null;

  const {
    _id,
    azureProjectId,
    lastUpdateTime,
    description,
    name,
    repositoryCount,
    defaultTeamImageUrl,
    url,
    syncDate
  } = project;

  // Fallback da imagem: avatar com a inicial se não houver imagem do Azure
  const projectImage = defaultTeamImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&length=3&background=0D8ABC&color=fff&width=48&height=48`;

  return (
    <div className="fixed inset-0 -top-6 z-[9999] flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 -top-6 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#1C1C1E] shadow-2xl h-screen overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-apple-border-light dark:border-apple-border-dark pb-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Substituído Image por img para evitar erro de width/height e configuração de domínio */}
            <Image 
              src={projectImage} 
              alt={name} 
              className="w-12 h-12 rounded-full object-cover" 
              width={48}
              height={48}
            />
            <div>
              <h3 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">
                {name}
              </h3>
              <p className="text-[12px] text-apple-tertiary-light mt-1 font-mono text-ellipsis text-wrap">{url}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-0 text-apple-tertiary-light hover:text-apple-red transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="mt-4 space-y-4">
          {/* Identificação */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Identificação</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">ID do Azure</span>
                <p className="text-sm font-mono">{azureProjectId}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Criado em</span>
                <p className="text-sm font-mono">{new Date(lastUpdateTime).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Última Sincronização</span>
                <p className="text-sm font-mono">{syncDate ? new Date(syncDate).toLocaleDateString() : 'Nunca'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Repositórios</span>
                <p className="text-sm font-mono">{repositoryCount}</p>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Descrição</h4>
            <p className="text-sm text-apple-secondary-light dark:text-apple-secondary-dark">
              {description || 'Sem descrição.'}
            </p>
          </div>

          {/* Origem */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Origem</h4>
            <div className="flex items-center gap-2 text-sm text-apple-tertiary-light">
              <Database className="w-4 h-4" />
              <span>Azure DevOps</span>
            </div>
            <div className="mt-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-apple-blue hover:underline">
                <ExternalLink className="w-3 h-3" />
                Abrir no Azure DevOps
              </a>
            </div>
          </div>

          {/* Ações */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Ações</h4>
            <Link
              href={`/settings/repositories?projectId=${_id}`}
              className="inline-flex items-center gap-2 bg-apple-bg-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark text-apple-label-light dark:text-apple-label-dark hover:bg-apple-tertiary-light/10 px-3 py-1.5 rounded-2xl text-xs font-medium transition-colors"
            >
              <FolderGit2 className="w-4 h-4" />
              Ver Repositórios
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}