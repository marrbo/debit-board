// app/observations/components.tsx
import React from 'react';
import { IObservation } from '@/models/Observation';

/**
 * Renderiza o Avatar do usuário de forma padronizada.
 */
export function UserAvatar({ name, sub, className = "" }: { name?: string; sub?: string; className?: string }) {
  const initial = (name || sub || 'U').charAt(0).toUpperCase();
  const colors = ['bg-blue-600', 'bg-red-600', 'bg-emerald-600', 'bg-purple-600', 'bg-amber-600', 'bg-pink-600'];
  const colorIndex = (sub || name || '').length % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${colors[colorIndex]} ${className}`}>
      {initial}
    </div>
  );
}

/**
 * Componente do Relatório PDF com agrupamentos e timbrado executivo.
 */
export const ObservationsReport = ({ observations, usersMap }: { observations: IObservation[]; usersMap: Record<string, string> }) => {
  if (!observations.length) return null;

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sortedObservations = [...observations].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if ((a.project || '') !== (b.project || '')) return (a.project || '').localeCompare(b.project || '');
    if ((a.repository || '') !== (b.repository || '')) return (a.repository || '').localeCompare(b.repository || '');
    const diff = (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9);
    if (diff !== 0) return diff;
    return a.fileName.localeCompare(b.fileName);
  });

  const groupBy = (arr: IObservation[], key: keyof IObservation) => {
    return arr.reduce((acc, item) => {
      const groupKey = String(item[key] || 'Sem ' + key);
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, IObservation[]>);
  };

  const categoryGroups = groupBy(sortedObservations, 'category');

  const totalObservations = observations.length;
  const totalOpen = observations.filter(i => i.status === 'open' || i.status === 'recurring').length;
  const totalFixed = observations.filter(i => i.status === 'resolved').length;
  const totalWontFix = observations.filter(i => i.status === 'wont_fix').length;
  const categoryTotals = observations.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const severityTotals = observations.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white text-black print:p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
      <style>
        {`
          @page { size: A4 landscape; margin: 1cm; }
          @media print { body { margin: 0; padding: 0; } }
          .row-item { page-break-inside: avoid; }
        `}
      </style>

      <div className="flex items-center gap-4 mb-6 border-b-2 border-gray-300 pb-4">
        <div className="p-2 bg-blue-600 rounded-lg text-white shrink-0">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
            <path d="M12 26 C4 26 2 20 2 20 C2 20 4 14 12 14 C18 14 20 20 20 20 C20 20 18 26 12 26 Z" fill="#ffffff" opacity="0.8"/>
            <path d="M28 26 C36 26 38 20 38 20 C38 20 36 14 28 14 C22 14 20 20 20 20 C20 20 22 26 28 26 Z" fill="#ffffff" opacity="0.8"/>
            <circle cx="12" cy="20" r="4" fill="#1e293b" stroke="#fff" strokeWidth="2"/>
            <circle cx="28" cy="20" r="4" fill="#1e293b" stroke="#fff" strokeWidth="2"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-700">Debit Board</h1>
          <p className="text-gray-500 text-sm">Relatório Executivo de Segurança</p>
          <p className="text-xs text-gray-400 mt-1">Gerado em: {new Date().toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
        <div className="border border-gray-200 bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-500 uppercase font-bold">Total</p>
          <p className="text-xl font-bold text-gray-900">{totalObservations}</p>
        </div>
        <div className="border border-gray-200 bg-red-50 p-3 rounded">
          <p className="text-xs text-red-700 uppercase font-bold">Em aberto</p>
          <p className="text-xl font-bold text-red-600">{totalOpen}</p>
        </div>
        <div className="border border-gray-200 bg-emerald-50 p-3 rounded">
          <p className="text-xs text-emerald-700 uppercase font-bold">Resolvidas</p>
          <p className="text-xl font-bold text-emerald-600">{totalFixed}</p>
        </div>
        <div className="border border-gray-200 bg-gray-50 p-3 rounded">
          <p className="text-xs text-gray-500 uppercase font-bold">Não corrigir</p>
          <p className="text-xl font-bold text-gray-900">{totalWontFix}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 mb-6 text-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Top Categorias</p>
          <div className="flex flex-wrap gap-2">
            {topCategories.map(([cat, count]) => (
              <span key={cat} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{cat} ({count})</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Severidade</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(severityTotals).map(([sev, count]) => (
              <span key={sev} className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                sev === 'critical' ? 'bg-red-100 text-red-800' :
                sev === 'high' ? 'bg-orange-100 text-orange-800' :
                sev === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>{sev} ({count})</span>
            ))}
          </div>
        </div>
      </div>

      <table className="w-full text-xs border-collapse border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-200 p-2 text-left font-bold w-[30%]">Arquivo / Observação</th>
            <th className="border border-gray-200 p-2 text-left font-bold w-[12%]">Branch</th>
            <th className="border border-gray-200 p-2 text-left font-bold w-[12%]">Status</th>
            <th className="border border-gray-200 p-2 text-left font-bold w-[15%]">Atribuído a</th>
            <th className="border border-gray-200 p-2 text-left font-bold w-[10%]">Severidade</th>
            <th className="border border-gray-200 p-2 text-left font-bold w-[8%]">SLA</th>
            <th className="border border-gray-200 p-2 text-center font-bold w-[8%]">Hits</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(categoryGroups).sort().map((cat) => {
            const projectGroups = groupBy(categoryGroups[cat], 'project');
            return (
              <React.Fragment key={cat}>
                <tr className="bg-gray-200/80 border-b border-gray-300">
                  <td colSpan={7} className="p-2 pl-4 font-bold text-gray-800 text-sm border-r border-gray-300">
                    📁 Categoria: {cat}
                  </td>
                </tr>
                {Object.keys(projectGroups).sort().map((proj) => {
                  const repoGroups = groupBy(projectGroups[proj], 'repository');
                  return (
                    <React.Fragment key={proj}>
                      <tr className="bg-gray-100/70">
                        <td colSpan={7} className="p-2 pl-8 font-semibold text-gray-700 text-xs border-r border-gray-300">
                          📂 Projeto: {proj || 'Sem Projeto'}
                        </td>
                      </tr>
                      {Object.keys(repoGroups).sort().map((repo) => {
                        const severityGroups = groupBy(repoGroups[repo], 'severity');
                        return (
                          <React.Fragment key={repo}>
                            <tr className="bg-gray-50/60">
                              <td colSpan={7} className="p-2 pl-12 font-medium text-gray-600 text-xs border-r border-gray-300">
                                📦 Repositório: {repo || 'Sem Repositório'}
                              </td>
                            </tr>
                            {Object.keys(severityGroups).sort((a, b) => (severityOrder[a] || 9) - (severityOrder[b] || 9)).map((sev) => {
                              const items = severityGroups[sev];
                              return (
                                <React.Fragment key={sev}>
                                  <tr>
                                    <td colSpan={7} className="p-2 pl-16 font-medium text-gray-500 text-[10px] border-r border-gray-300">
                                      <span className={`px-2 py-0.5 rounded ${
                                        sev === 'critical' ? 'bg-red-200 text-red-800' :
                                        sev === 'high' ? 'bg-orange-200 text-orange-800' :
                                        sev === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                        'bg-blue-200 text-blue-800'
                                      }`}>
                                        ⚠️ Severidade: {sev.toUpperCase()}
                                      </span>
                                    </td>
                                  </tr>
                                  {items.map((issue) => (
                                    <tr key={issue._id.toString()} className="border-b border-gray-100 hover:bg-gray-50 row-item">
                                      <td className="border border-gray-200 p-2 pl-20 align-top">
                                        <div className="font-bold text-[11px]">{issue.fileName}</div>
                                        <div className="text-[9px] text-gray-500 mt-0.5">{issue.filePath}</div>
                                      </td>
                                      <td className="border border-gray-200 p-2 align-middle">{issue.branch}</td>
                                      <td className="border border-gray-200 p-2 align-middle">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                          issue.status === 'open' || issue.status === 'recurring' ? 'bg-red-100 text-red-800' :
                                          issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {issue.status}
                                        </span>
                                      </td>
                                      <td className="border border-gray-200 p-2 align-middle">{usersMap[issue.assignedTo || ''] || '—'}</td>
                                      <td className="border border-gray-200 p-2 align-middle">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          issue.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                          issue.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                                          issue.severity === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                          'bg-blue-200 text-blue-800'
                                        }`}>
                                          {issue.severity}
                                        </span>
                                      </td>
                                      <td className="border border-gray-200 p-2 align-middle">{issue.slaHours}h</td>
                                      <td className="border border-gray-200 p-2 text-center align-middle font-bold">{issue.hitCount}</td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-4 text-center">Relatório gerado automaticamente.</p>
    </div>
  );
};