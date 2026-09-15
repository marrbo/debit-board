'use client';

import { useState } from 'react';
import { X, ExternalLink, Database, Shield, LinkIcon } from 'lucide-react';
// import { format } from 'date-fns';
// import { ptBR } from 'date-fns/locale';
import AssigneeSelect from './AssigneeSelect';
import MarkdownRenderer from './MarkdownRenderer';
import ScoreGauge from './ScoreGauge';
import type { IObservation } from '@/types/IObservation';
import type { IAzureSettings } from '@/types/IAzureSettings';
import type { IUser } from '@/types/IUser';

export interface ObservationDrawerProps {
  observation: IObservation | null;
  users: IUser[];
  azureSettings: IAzureSettings | null;
  onClose: () => void;
  onUpdateAssignee: (issueId: string, assignedTo: string | null) => void;
}

// function formatDate(date?: string | Date): string {
//   if (!date) return '—';
//   return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: ptBR });
// }

export default function ObservationDrawer({
  observation,
  users,
  azureSettings,
  onClose,
  onUpdateAssignee,
}: ObservationDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'security'>('overview');
  const isOpen = Boolean(observation);

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
    hitCount,
    assignedTo,
    _id,
    pattern,
    // firstSeen,
    // lastSeen,
  } = observation;

  const affectedBy = pattern?.name || '—';
  // const detectedAt = firstSeen ? formatDate(firstSeen) : '—';
  // const lastSeenAt = lastSeen ? formatDate(lastSeen) : null;
  // const showLastSeen = lastSeen && firstSeen && new Date(lastSeen).getTime() !== new Date(firstSeen).getTime();

  const score = pattern?.score ?? 95;
  const description = pattern?.description || 'Sem descrição fornecida.';
  const recommendation = pattern?.recommendation || 'Sem recomendação fornecida.';

  // IDs e links externos
  const externalId = `DB-${_id.toString().slice(-6).toUpperCase()}`;
  // const patternExternalId = pattern?._id ? `DB-PAT-${pattern._id.toString().slice(-8).toUpperCase()}` : '';
  const externalOWASPId = pattern?.externalId || '';
  const externalOWASPLink = pattern?.externalLink || '';
  const externalCWEId = pattern?.externalIdCWE || '';
  const externalCWELink = pattern?.externalLinkCWE || '';

  const buildAzureLink = () => {
    if (!azureSettings || !project || !repository) return null;
    const { instanceUrl, azureCollection = 'DefaultCollection' } = azureSettings;
    return `${instanceUrl}/tfs/${azureCollection}/${project}/_git/${repository}?path=${encodeURIComponent(filePath)}&version=GB${branch}&_a=contents`;
  };
  const externalLink = buildAzureLink();

  return (
    <div className={`fixed inset-0 -top-6 z-[9999] flex justify-end ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 -top-6 bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-2xl bg-[#0d1117] shadow-2xl h-screen overflow-y-auto border-l border-gray-800 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header com gauge à direita */}
        <div className="p-10 pb-4 border-b border-gray-800">
          <div className="flex items-start">

            <div className="flex-1 min-w-0 gap-5">
              <button
                onClick={onClose}
                className="p-1 fixed left-4 top-5 text-gray-400 hover:text-red-500 transition-colors ml-4"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
              <div className='min-w-10 h-5'></div>

              <div className="flex items-start justify-between pb-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold text-white truncate pb-0.5">{fileName}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono max-w-sm italic">{filePath}</p>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="grid grid-cols-4 gap-2">
                  <span className="text-gray-500">Afetado por:</span>
                  <span className="text-gray-200 col-span-3">{affectedBy}</span>
                </div>
                {/* <div className="flex gap-2">
                  <span className="text-gray-500">Detectado em:</span>
                  <span className="text-gray-200">{detectedAt}</span>
                </div>
                {showLastSeen && (
                  <div className="flex gap-2">
                    <span className="text-gray-500">Visto recente:</span>
                    <span className="text-gray-200">{lastSeenAt}</span>
                  </div>
                )} */}
                <div className="grid grid-cols-4 gap-2">
                  <span className="text-gray-500 flex-0">Status:</span>
                  <span className="text-gray-200 col-span-3 capitalize">{status}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-gray-500">Origem:</span>
                  <span className="text-gray-200 col-span-3 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" /> Azure DevOps Search Code
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-gray-500">Detalhes:</span>
                  <span className="text-gray-200 col-span-3 flex items-center gap-1">
                    <a href={`/observations/${_id}`} target="_self" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Mais detalhes
                    </a>
                  </span>
                </div>
              </div>

            </div>
            <div className="shrink-0 pt-28 pr-5">
              <ScoreGauge score={score * 10.0} size={90} />
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-800 px-10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Shield className="w-4 h-4" /> Security
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-10 space-y-6">
          {activeTab === 'overview' ? (
            <>
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Identificação</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">Projeto</span>
                    <p className="text-sm text-white">{project || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">Repositório</span>
                    <p className="text-sm text-white">{repository || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">Branch</span>
                    <p className="text-sm text-white">{branch || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">ID</span>
                    <p className="text-sm text-white font-mono">{externalId}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Detalhes do Problema</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">Categoria</span>
                    <p className="text-sm text-white">{category || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">Severidade</span>
                    <p className="text-sm text-white capitalize">{severity || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-gray-500">Hits</span>
                    <p className="text-sm text-white">{hitCount}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Origem</h4>
                <a href={externalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Ver no Azure DevOps
                </a>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Responsável</h4>
                <AssigneeSelect users={users} value={assignedTo} onChange={(value) => onUpdateAssignee(_id.toString(), value)} />
              </div>
            </>
          ) : (
            <>
              {/* Dados do Problema */}
              <div className="bg-[#161b22] p-4 rounded-xl border border-gray-800">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Referência:</h4>
                
                {/* Links OWASP / CWE */}
                {(externalOWASPId || externalCWEId) && (
                  <div className="mt-4 space-y-2">
                    {externalOWASPId && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-gray-500">OWASP:</span>
                        <a href={externalOWASPLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> {externalOWASPId}
                        </a>
                      </div>
                    )}
                    {externalCWEId && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-gray-500">CWE:</span>
                        <a href={externalCWELink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" /> {externalCWEId}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Por que isso é um problema? */}
              <div className="border-t border-gray-600 pt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Por que isso é um problema?</h4>
                <div className="p-4 rounded-lg text-sm ">
                  <MarkdownRenderer content={description} />
                </div>
              </div>

              {/* Como corrigir? */}
              <div className="border-t border-gray-600 pt-4">
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-3">Como corrigir?</h4>
                <div className="p-4 rounded-lg text-sm ">
                  <MarkdownRenderer content={recommendation} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}