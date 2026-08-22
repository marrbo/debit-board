// app/observations/page.tsx
'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Binoculars,
  Info
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useReactToPrint } from 'react-to-print';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DBQLAdvancedSearch from '@/components/dbql/DBQLAdvancedSearch';
import PageHeader from '@/components/PageHeader';
import AssigneeSelect from '@/components/AssigneeSelect';
import { IIssue } from '@/models/Issue';
import React from 'react';

/**
 * Renderiza o Avatar do usuário de forma padronizada.
 */
function UserAvatar({ name, sub, className = "" }: { name?: string; sub?: string; className?: string }) {
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
const IssuesReport = ({ issues, usersMap }: { issues: IIssue[]; usersMap: Record<string, string> }) => {
  if (!issues.length) return null;

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sortedIssues = [...issues].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if ((a.project || '') !== (b.project || '')) return (a.project || '').localeCompare(b.project || '');
    if ((a.repository || '') !== (b.repository || '')) return (a.repository || '').localeCompare(b.repository || '');
    const diff = (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9);
    if (diff !== 0) return diff;
    return a.fileName.localeCompare(b.fileName);
  });

  const groupBy = (arr: IIssue[], key: keyof IIssue) => {
    return arr.reduce((acc, item) => {
      const groupKey = String(item[key] || 'Sem ' + key);
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, IIssue[]>);
  };

  const categoryGroups = groupBy(sortedIssues, 'category');

  const totalIssues = issues.length;
  const totalOpen = issues.filter(i => i.status === 'open' || i.status === 'recurring').length;
  const totalFixed = issues.filter(i => i.status === 'resolved').length;
  const totalWontFix = issues.filter(i => i.status === 'wont_fix').length;
  const categoryTotals = issues.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const severityTotals = issues.reduce((acc, i) => {
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
          <p className="text-xl font-bold text-gray-900">{totalIssues}</p>
        </div>
        <div className="border border-gray-200 bg-red-50 p-3 rounded">
          <p className="text-xs text-red-700 uppercase font-bold">Em aberto</p>
          <p className="text-xl font-bold text-red-600">{totalOpen}</p>
        </div>
        <div className="border border-gray-200 bg-emerald-50 p-3 rounded">
          <p className="text-xs text-emerald-700 uppercase font-bold">Corrigidas</p>
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

/**
 * Página principal de exibição de Vulnerabilidades (Observations Feed).
 */
export default function IssuesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [issues, setIssues] = useState<IIssue[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');

  const [sortBy, setSortBy] = useState<string>('firstSeen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const componentRef = useRef<HTMLDivElement>(null);
  const [reportIssues, setReportIssues] = useState<IIssue[]>([]);
  const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: 'Relatorio_Issues' });

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    const fetchBaseData = async () => {
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) setUsers(await usersRes.json());
    };
    fetchBaseData();
  }, [session, status]);

  const fetchIssues = useCallback(async (pageNum: number, searchStr: string = searchQuery) => {
    if (status !== 'authenticated' || !session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (searchStr) {
        params.set('search', searchStr);
      }
      
      params.set('page', pageNum.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/observations?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar Observations');
      const data = await res.json();
      setIssues(data.issues);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  }, [searchQuery, session, status]);

  useEffect(() => {
    fetchIssues(page);
  }, [fetchIssues, page]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const usersMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => { map[u.sub] = u.name || u.email; });
    return map;
  }, [users]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    const items = [...issues];
    return items.sort((a, b) => {
      let valA: any = a[sortBy as keyof IIssue] || '';
      let valB: any = b[sortBy as keyof IIssue] || '';
      if (sortBy === 'firstSeen' || sortBy === 'lastSeen' || sortBy === 'slaDueAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else {
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [issues, sortBy, sortOrder]);

  const updateIssue = async (issueId: string, value: string | null) => {
    try {
      const res = await fetch('/api/observations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, assignedTo: value || null }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar');
      fetchIssues(page);
    } catch (err: any) { alert(err.message); }
  };

  const fetchAllFilteredIssues = async () => {
    const params = new URLSearchParams();
    if (searchQuery) {
      params.set('search', searchQuery);
    }
    params.set('all', 'true');
    const res = await fetch(`/api/observations?${params}`);
    if (!res.ok) throw new Error('Erro ao buscar dados completos');
    const data = await res.json();
    return data.issues as IIssue[];
  };

  const handleExportExcel = async () => {
    if (!confirm('Exportar todos os resultados atuais para Excel?')) return;
    try {
      const fullIssues = await fetchAllFilteredIssues();
      if (!fullIssues || fullIssues.length === 0) return alert('Nenhuma issue para exportar');
      
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Issues');

      ws.spliceRows(1, 4);

      ws.columns = [
        { header: 'Projeto', key: 'project', width: 20 },
        { header: 'Repositório', key: 'repository', width: 25 },
        { header: 'Branch', key: 'branch', width: 15 },
        { header: 'Arquivo', key: 'filePath', width: 45 },
        { header: 'Categoria', key: 'category', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Atribuído a', key: 'assignedTo', width: 20 },
        { header: 'Severidade', key: 'severity', width: 15 },
        { header: 'SLA (Horas)', key: 'slaHours', width: 15 },
        { header: 'Hits', key: 'hitCount', width: 10 },
      ];

      const logoSvg = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQBAMAAAB8P++eAAAAMFBMVEUAAAAAff8Aev8Ae/8Aev9hrf9utP+UyP+52v/o9P8cHB5ISElISEqXl5je3t7////qY+UUAAAACnRSTlMAM2aZzN3f5+/50JrR+gAAAURJREFUSMftVDFSwzAQVOIPeBI/wDF+QJzoA9jHMPQ0/ICOhp6OlibU6R34QJ5AQ0/DE9IFMgMcd5JsS8qAoUqj7fa0vj2d7ixEQEBAwAExGM1lNUutwJGs5tmebixBoVWONYeJp6PQ5XJ32yqHDYfM110g4R5K7SsllplQmOgpKlzDMUeSjtvKnNiNPngDiNWXHTcmuh44Qfxcr14Rz2EqRGTzLiUnPMOvp7p+2OCCE+Q2B10NgbtwhR814Rm35D10uarGOMMdvvDBI74DTCOXA1djnGGJaz5Y4Y6ccpc33kqIWCsgAlTS5RRRQtkv1A1KfOsy8a21MOq/TNo+oNOOdOC3x/Qx6Wt4+d8n/PNQqJS/jFksHKUZ1Co2Ju3gFvaIZz+vQuEuzcjsUmGb8OMVe3uY8bra5fC6TuLwIwsICDgkvgFF8FxdZN3g9gAAAABJRU5ErkJggg==`;
      const logoBase64 = logoSvg.replace(/^data:image\/\w+;base64,/, '');
      const imageId = workbook.addImage({ base64: logoBase64, extension: 'png' });

      ws.addImage(imageId, {
        tl: { col: 0.1, row: 0.2 },
        ext: { width: 45, height: 45 },
        editAs: 'oneCell'
      });
      
      ws.mergeCells('B1:H1');
      const titleCell = ws.getCell('B1');
      titleCell.value = 'Debit Board - Executive Report (Issues)';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: '003366' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(1).height = 30;

      ws.mergeCells('B2:H2');
      const subtitleCell = ws.getCell('B2');
      subtitleCell.value = 'Relatório Geral de Vulnerabilidades de Projetos';
      subtitleCell.font = { name: 'Arial', size: 12, italic: true, color: { argb: '666666' } };
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(2).height = 20;

      ws.mergeCells('B3:H3');
      const timestampCell = ws.getCell('B3');
      timestampCell.value = `Exportado por DebitBoard em ${new Date().toLocaleString()}`;
      timestampCell.font = { name: 'Arial', size: 10, color: { argb: '999999' } };
      timestampCell.alignment = { vertical: 'middle', horizontal: 'left' };

      const headerRow = ws.getRow(5);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.eachCell(cell => {
        cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      });

      fullIssues.forEach(issue => {
        const row = ws.addRow({
          project: issue.project || '',
          repository: issue.repository || '',
          branch: issue.branch,
          filePath: issue.filePath,
          category: issue.category,
          status: issue.status,
          assignedTo: usersMap[issue.assignedTo || ''] || '',
          severity: issue.severity,
          slaHours: issue.slaHours,
          hitCount: issue.hitCount
        });
        row.alignment = { vertical: 'middle' };
        row.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell('severity').alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell('hitCount').alignment = { horizontal: 'center', vertical: 'middle' };
        
        row.eachCell(cell => {
          cell.border = { top: {style:'thin', color:{argb:'E5E7EB'}}, left: {style:'thin', color:{argb:'E5E7EB'}}, bottom: {style:'thin', color:{argb:'E5E7EB'}}, right: {style:'thin', color:{argb:'E5E7EB'}} };
        });

        const statusCell = row.getCell('status');
        if (issue.status === 'new' || issue.status === 'open' || issue.status === 'recurring') {
          statusCell.font = { color: { argb: '991B1B' }, bold: true };
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
        } else if (issue.status === 'resolved') {
          statusCell.font = { color: { argb: '065F46' }, bold: true };
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
        }
        
        const sevCell = row.getCell('severity');
        if (issue.severity === 'critical') {
          sevCell.font = { color: { argb: '991B1B' }, bold: true };
          sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FECACA' } };
        } else if (issue.severity === 'high') {
          sevCell.font = { color: { argb: '9A3412' }, bold: true };
          sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDD5' } };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Observations_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Erro na exportação Excel: ' + err.message);
    }
  };

  const handleExportPDF = async () => {
    try {
      setLoading(true);
      const fullIssues = await fetchAllFilteredIssues();
      setReportIssues(fullIssues);
      setTimeout(() => {
        handlePrint();
        setTimeout(() => setReportIssues([]), 1000);
      }, 500);
    } catch (err: any) {
      alert('Erro na geração do PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    open: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    recurring: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    wont_fix: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20'
  };

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400',
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400'
  };

  const thClass = "px-3 py-2 border-r text-[11px] font-semibold text-apple-tertiary-light uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-apple-border-light/30 transition-colors";
  const borderColumnHeader = "flex items-center justify-center gap-1";

  if (status === 'loading' || !session) {
    return <div className="flex h-screen items-center justify-center bg-white dark:bg-[#1C1C1E]">
      <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F5F7] dark:bg-black">
      <div style={{ display: 'none' }}><div ref={componentRef}><IssuesReport issues={reportIssues} usersMap={usersMap} /></div></div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-6 space-y-6">
          <PageHeader 
            title="Observations Feed"
            subtitle="Central de monitoramento de vulnerabilidades. Identifique, analise e delegue."
            icon={<Binoculars className="w-6 h-6 text-apple-blue" />}
            actions={
              <div className="flex items-center gap-2">
                <button onClick={handleExportExcel} className="p-1.5 flex items-center gap-2 text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 rounded-md transition-colors" title="Exportar Excel">
                  <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                </button>
                <button onClick={handleExportPDF} className="p-1.5 flex items-center gap-2 text-apple-tertiary-light hover:text-apple-red hover:bg-apple-red/10 rounded-md transition-colors" title="Relatório Executivo PDF">
                  <FileText className="w-4 h-4" /> Exportar PDF
                </button>
              </div>
            }
          />

          <div className="w-full">
            <DBQLAdvancedSearch 
              onSearch={setSearchQuery} 
              userId={session.user.id || ''}
              context="issues" 
              placeholder="Buscar via DBQL (ex: severity:critical AND status:open)" 
            />
          </div>

          <div className="bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden flex flex-col w-full h-[600px]">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-apple-border-light/20 dark:bg-apple-border-dark/20 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className={`${thClass} w-[7%] pl-4`} onClick={() => handleSort('status')}>
                      <div className={borderColumnHeader}>Status {sortBy==='status' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[30%]`} onClick={() => handleSort('fileName')}>
                      <div className="inline-flex items-center">Arquivo / Observação {sortBy==='fileName' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[25%]`} onClick={() => handleSort('category')}>
                      <div className="inline-flex items-center">Categoria {sortBy==='category' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[8%]` } onClick={() => handleSort('branch')}>
                      <div className={borderColumnHeader}>Branch {sortBy==='branch' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[8%]`} onClick={() => handleSort('severity')}>
                      <div className={borderColumnHeader}>Severidade {sortBy==='severity' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[10%]`} onClick={() => handleSort('slaDueAt')}>
                      <div className={borderColumnHeader}>Previsão (SLA) {sortBy==='slaDueAt' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[6%]`} onClick={() => handleSort('assignedTo')}>
                      <div className={borderColumnHeader}>Responsável {sortBy==='assignedTo' && (sortOrder==='asc' ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>)}</div>
                    </th>
                    <th className={`${thClass} w-[5%] text-right pr-4`}>Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-apple-border-light dark:divide-apple-border-dark">
                  {loading && issues.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-apple-blue border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-apple-tertiary-light">Carregando observations...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-apple-red text-sm">{error}</td>
                    </tr>
                  ) : sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-apple-tertiary-light text-sm">Nenhuma vulnerabilidade encontrada.</td>
                    </tr>
                  ) : (
                    sortedItems.map((issue) => {
                      const isPastDue = issue.slaDueAt && new Date(issue.slaDueAt) < new Date();
                      
                      return (
                        <tr key={issue._id.toString()} className="group hover:bg-apple-border-light/10 dark:hover:bg-apple-border-dark/10 transition-colors">
                          <td className="px-3 py-3 pl-4 align-middle">
                            <span className={`flex items-center justify-around px-2 py-0.5 text-[9px] font-bold ${statusColors[issue.status]}`}>
                              {issue.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle min-w-0">
                            <div className="flex flex-col gap-0.5 align-middle">
                              <span className="text-xs font-semibold align-middle text-apple-label-light dark:text-apple-label-dark truncate" title={issue.fileName}>
                                {issue.fileName}
                              </span>
                              <span className="text-[10px] align-middle font-mono text-apple-tertiary-light truncate" title={issue.filePath}>
                                {issue.filePath}
                              </span>
                              <span className="text-[10px] align-middle font-medium text-apple-tertiary-light w-fit">
                                {issue.hitCount} {issue.hitCount === 1 ? 'hit' : 'hits'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span className="text-xs text-wrap-ellipsis text-apple-label-light dark:text-apple-label-dark leading-relaxed block" title={issue.category}>
                              {issue.category}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span className="text-xs flex items-center justify-center font-mono bg-apple-border-light/30 dark:bg-[#2C2C2E] px-1.5 py-0.5 rounded text-apple-tertiary-light whitespace-nowrap">
                              {issue.branch}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span className={`flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${severityColors[issue.severity]}`}>
                              {issue.severity}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-middle">
                            {issue.slaDueAt ? (
                              <div className="flex flex-col gap-0.5 items-center">
                                <span className={`text-[10px] from-neutral-50 font-mono ${isPastDue && (issue.status === 'open' || issue.status === 'recurring') ? 'text-apple-red' : 'text-apple-label-light dark:text-apple-label-dark'}`}>
                                  {new Date(issue.slaDueAt).toLocaleDateString('pt-BR')}
                                </span>
                                {(issue.status === 'open' || issue.status === 'recurring') && (
                                  <span className={`text-[10px] ${isPastDue ? 'text-apple-red font-bold' : 'text-apple-tertiary-light'}`}>
                                    {isPastDue ? `Vencido há ${formatDistanceToNow(new Date(issue.slaDueAt), { locale: ptBR, addSuffix: false  })}` : formatDistanceToNow(new Date(issue.slaDueAt), { addSuffix: false, locale: ptBR })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-apple-tertiary-light">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 flex items-center justify-center align-middle">
                            <AssigneeSelect 
                              users={users} 
                              className="mt-2.5 flex items-center justify-center align-middle"
                              value={issue.assignedTo} 
                              onChange={(v) => updateIssue(issue._id.toString(), v)} 
                            />
                          </td>
                          <td className="px-3 py-3 pr-4 align-middle text-right">
                            <Link 
                              href={`/observations/${issue._id}`}
                              title="Ver Detalhes"
                              className="inline-flex p-2 rounded-full hover:text-apple-blue border hover:border-blue-500 bg-apple-border-light/30 items-center justify-center text-apple-tertiary-light dark:text-apple-label-dark transition-colors"
                            >
                              <Info className="w-4 h-4 font-extralight" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-apple-border-light dark:border-apple-border-dark bg-white dark:bg-[#1C1C1E]">
                <span className="text-xs text-apple-tertiary-light">
                  Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-apple-border-light dark:border-apple-border-dark text-apple-tertiary-light hover:text-apple-label-light disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-apple-border-light dark:border-apple-border-dark text-apple-tertiary-light hover:text-apple-label-light disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}