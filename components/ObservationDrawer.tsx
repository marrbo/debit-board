'use client';

import { X, ExternalLink, Database } from 'lucide-react';
import AssigneeSelect from './AssigneeSelect';
import type { IObservation } from '@/models/Observation';
import type { IUser } from '@/models/User';

interface ObservationDrawerProps {
  observation: IObservation | null;
  users: IUser[];
  onClose: () => void;
  onUpdateAssignee: (issueId: string, assignedTo: string | null) => void;
}

function getDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'Broken Access Control': 'A aplicação não restringe adequadamente o acesso a recursos, permitindo que usuários não autorizados acessem dados ou executem ações privilegiadas.',
    'SQL Injection': 'Entradas não sanitizadas são concatenadas em consultas SQL, permitindo manipulação da consulta e acesso a dados.',
    'Hardcoded Secret': 'Credenciais ou chaves de API estão embutidas no código, expondo informações sensíveis.',
  };
  return descriptions[category] || 'Vulnerabilidade de segurança identificada no código.';
}

function getRecommendation(severity: string): string {
  const recommendations: Record<string, string> = {
    critical: 'Corrigir imediatamente. Aplicar controle de acesso e validar entradas.',
    high: 'Corrigir com prioridade alta. Revisar permissões e sanitizar dados.',
    medium: 'Corrigir em breve. Implementar validações adicionais.',
    low: 'Corrigir quando possível. Reforçar boas práticas.',
  };
  return recommendations[severity] || 'Revisar código e aplicar práticas seguras.';
}

export default function ObservationDrawer({
  observation,
  users,
  onClose,
  onUpdateAssignee,
}: ObservationDrawerProps) {
  if (!observation) return null;

  const {
    fileName,
    filePath,
    project,
    repository,
    branch,
    category,
    severity,
    status,
    slaDueAt,
    hitCount,
    assignedTo,
    _id,
  } = observation;

  const description = getDescription(category);
  const recommendation = getRecommendation(severity);
  const externalId = `DB-${_id.toString().slice(-6).toUpperCase()}`;
  const externalLink = `https://dev.azure.com/${project}/${repository}/_search?text=${encodeURIComponent(fileName)}`;

  return (
    <div className="fixed inset-0 -top-6 z-[9999] flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 -top-6 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer - altura total, sem espaço no topo */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#1C1C1E] shadow-2xl h-screen overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-apple-border-light dark:border-apple-border-dark pb-4 mb-10">
          <div className="max-w-10">
            <h3 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">
              {fileName}
            </h3>
            <p className="text-[12px] text-apple-tertiary-light mt-1 font-mono text-ellipsis text-wrap">{filePath}</p>
          </div>
          <button onClick={onClose} className="p-0 text-apple-tertiary-light hover:text-apple-red transition-colors" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo compacto */}
        <div className="mt-4 space-y-4">
          {/* Identificação */}
          <div>
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Identificação</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Projeto</span>
                <p className="text-sm font-medium">{project || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Repositório</span>
                <p className="text-sm font-medium">{repository || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Branch</span>
                <p className="text-sm">{branch || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">ID</span>
                <p className="text-sm font-mono">{externalId}</p>
              </div>
            </div>
          </div>

          {/* Detalhes do Problema */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Detalhes do Problema</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Categoria</span>
                <p className="text-sm">{category || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Severidade</span>
                <p className="text-sm capitalize">{severity || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Status</span>
                <p className="text-sm">{status || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">SLA</span>
                <p className="text-sm">{slaDueAt ? new Date(slaDueAt).toLocaleDateString('pt-BR') : '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase text-apple-tertiary-light">Hits</span>
                <p className="text-sm">{hitCount}</p>
              </div>
            </div>
          </div>

          {/* Descrição e Recomendação */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-6">Por que isso é um problema?</h4>
            <p className="text-sm text-apple-secondary-light dark:text-apple-secondary-dark mb-10">{description}</p>
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mt-4 mb-6">Como corrigir?</h4>
            <p className="text-sm text-apple-secondary-light dark:text-apple-secondary-dark">{recommendation}</p>
          </div>

          {/* Origem */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-6">Origem</h4>
            <div className="flex items-center gap-2 text-sm text-apple-tertiary-light">
              <Database className="w-4 h-4" />
              <span>Azure DevOps Search Code</span>
            </div>
            <div className="mt-2">
              <a href={externalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-apple-blue hover:underline">
                <ExternalLink className="w-3 h-3" />
                Ver no Azure DevOps
              </a>
            </div>
          </div>

          {/* Responsável */}
          <div className="border-t border-apple-border-light dark:border-apple-border-dark pt-4">
            <h4 className="text-xs font-semibold uppercase text-apple-tertiary-light mb-2">Responsável</h4>
            <AssigneeSelect users={users} value={assignedTo} onChange={(value) => onUpdateAssignee(_id.toString(), value)} />
          </div>
        </div>
      </div>
    </div>
  );
}