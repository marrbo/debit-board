// app/observations/page.tsx
'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileSpreadsheet, FileText, Search, UserPlus, Check, User, 
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useReactToPrint } from 'react-to-print';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdvancedSearch from '@/components/AdvancedSearch';
import PageHeader from '@/components/PageHeader';
import ProjectSelect from '@/components/ProjectSelect';
import { IIssue } from '@/models/Issue';
import React from 'react';

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

// ============================================================
// 🔥 RELATÓRIO PDF COM TIMBRADO, AGRUPAMENTO E RESUMO EXECUTIVO
// ============================================================
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
  const totalFixed = issues.filter(i => i.status === 'fixed').length;
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
            <th className="border border-gray-200 p-2 text-left font-bold w-[30%]">Arquivo</th>
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
                                          issue.status === 'fixed' ? 'bg-emerald-100 text-emerald-800' :
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

// ============================================================
// PÁGINA PRINCIPAL DE ISSUES (TEMA APPLE APLICADO)
// ============================================================

export default function IssuesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [issues, setIssues] = useState<IIssue[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortBy, setSortBy] = useState<string>('firstSeen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [openAssignee, setOpenAssignee] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const componentRef = useRef<HTMLDivElement>(null);
  const [reportIssues, setReportIssues] = useState<IIssue[]>([]);
  const handlePrint = useReactToPrint({ contentRef: componentRef, documentTitle: 'Relatorio_Issues' });

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    const fetchBaseData = async () => {
      const [usersRes, projectsRes] = await Promise.all([
        fetch('/api/user'),
        fetch('/api/projects'),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
    };
    fetchBaseData();
  }, [session, status]);

  const fetchIssues = useCallback(async (pageNum: number, searchStr: string = searchQuery) => {
    if (status !== 'authenticated' || !session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      if (filterBranch) params.set('branch', filterBranch);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterProjectId !== 'all') params.set('projectId', filterProjectId);
      if (searchStr) params.set('search', searchStr);
      
      params.set('page', pageNum.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/observations?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar Observations');
      const data = await res.json();
      setIssues(data.issues);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }, [filterStatus, filterCategory, filterBranch, filterSeverity, filterProjectId, searchQuery, session, status]);

  useEffect(() => {
    fetchIssues(page);
  }, [fetchIssues, page]);

  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterCategory, filterBranch, filterSeverity, filterProjectId, searchQuery]);


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

  const updateIssue = async (issueId: string, value: string) => {
    try {
      const res = await fetch('/api/observations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId, assignedTo: value || null }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar');
      fetchIssues(page);
      setOpenAssignee(null);
    } catch (err: any) { alert(err.message); }
  };

  const fetchAllFilteredIssues = async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterCategory) params.set('category', filterCategory);
    if (filterBranch) params.set('branch', filterBranch);
    if (filterSeverity) params.set('severity', filterSeverity);
    if (searchQuery) params.set('search', searchQuery);
    if (filterProjectId !== 'all') params.set('projectId', filterProjectId);
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

      // ============================================================
      // 🍎 NOVO CABEÇALHO ESTILO APPLE E COLUNAS REORDENADAS
      // ============================================================
      // 1. Inserir 4 linhas vazias no topo para acomodar o cabeçalho
      ws.spliceRows(1, 4);

      // 2. Configurar Largura das Colunas (ORDEM INVERTIDA: Projeto, Repo, Branch, Arquivo...)
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

      // 3. Inserir o Logo (CORRIGIDO: Remove o prefixo "data:image/png;base64," e usa o nativo do navegador)
      // 👇 Copie o seu código base64 aqui. A string que você já tem serve perfeitamente.
      const logoSvg = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQBAMAAAB8P++eAAAAMFBMVEUAAAAAff8Aev8Ae/8Aev9hrf9utP+UyP+52v/o9P8cHB5ISElISEqXl5je3t7////qY+UUAAAACnRSTlMAM2aZzN3f5+/50JrR+gAAAURJREFUSMftVDFSwzAQVOIPeBI/wDF+QJzoA9jHMPQ0/ICOhp6OlibU6R34QJ5AQ0/DE9IFMgMcd5JsS8qAoUqj7fa0vj2d7ixEQEBAwAExGM1lNUutwJGs5tmebixBoVWONYeJp6PQ5XJ32yqHDYfM110g4R5K7SsbbplQmOgpKlzDMUeSjtvKnNiNPngDiNWXHTcmuh44Qfxcr14Rz2EqRGTzLiUnPMOvp7p+2OCCE+Q2B10NgbtwhR814Rm35D10uarGOMMdvvDBI74DTCOXA1djnGGJaz5Y4Y6ccpc33kqIWCsgAlTS5RRRQtkv1A1KfOsy8a21MOq/TNo+oNOOdOC3x/Qx6Wt4+d8n/PNQqJS/jFksHKUZ1Co2Ju3gFvaIZz+vQuEuzcjsUmGb8OMVe3uY8bra5fC6TuLwIwsICDgkvgFF8FxdZN3g9gAAAABJRU5ErkJggg==`;
      
      // 🔥 CORREÇÃO CRUCIAL: Extrair apenas a parte base64
      const logoBase64 = logoSvg.replace(/^data:image\/\w+;base64,/, '');
      const imageId = workbook.addImage({
        base64: logoBase64,
        extension: 'png'
      });
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 }, // Posição: A1
        ext: { width: 40, height: 40 } // Tamanho do logo
      });

      // 4. Preencher Título e Subtítulo (Mesclando as células da coluna B até J)
      ws.mergeCells('B1:J1');
      const titleCell = ws.getCell('B1');
      titleCell.value = 'Debit Board';
      titleCell.font = { name: 'Arial', size: 22, bold: true, color: { argb: 'FF007AFF' } }; // Azul Apple
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

      ws.mergeCells('B2:J2');
      const subCell = ws.getCell('B2');
      subCell.value = 'Relatório Executivo de Segurança';
      subCell.font = { name: 'Arial', size: 12, color: { argb: 'FF636366' } }; // Cinza Secundário Apple

      ws.mergeCells('B3:J3');
      const dateCell = ws.getCell('B3');
      dateCell.value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      dateCell.font = { name: 'Arial', size: 10, color: { argb: 'FF8E8E93' } }; // Cinza Terciário Apple

      // 5. Linha de Espaçamento
      ws.getRow(4).height = 20; 
      
      // ============================================================
      // 🧊 🍎 CONGELAMENTO DAS 5 PRIMEIRAS LINHAS
      // ============================================================
      ws.views = [{ state: 'frozen', ySplit: 5 }];

      // 6. Cabeçalho da Tabela (Linha 5 - Colorido e Fixo)
      const headerRow = ws.getRow(5);
      // 🔥 Ordem invertida aqui também
      headerRow.values = ['Projeto', 'Repositório', 'Branch', 'Arquivo', 'Categoria', 'Status', 'Atribuído a', 'Severidade', 'SLA (Horas)', 'Hits'];
      headerRow.font = { name: 'Arial', bold: true, size: 11, color: { argb: 'FF8E8E93' } }; // Cinza Apple
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E5EA' } }; // Cinza claro Apple para o cabeçalho

      // ============================================================
      // 📄 INSERÇÃO DOS DADOS (A partir da Linha 6)
      // ============================================================
      fullIssues.forEach((issue, index) => {
        const rowIndex = 6 + index;
        const row = ws.getRow(rowIndex);
        // 🔥 Dados reordenados para corresponder à nova ordem das colunas
        row.values = {
          project: issue.project || '',
          repository: issue.repository || '',
          branch: issue.branch,
          filePath: issue.filePath,
          category: issue.category,
          status: issue.status,
          assignedTo: usersMap[issue.assignedTo || ''] || '',
          severity: issue.severity,
          slaHours: issue.slaHours,
          hitCount: issue.hitCount,
        };

        // 🔥 Linhas com cores alternadas (sutis)
        if (index % 2 !== 0) {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F7' } }; // Cinza Muito Claro
        } else {
          row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Branco
        }
      });

      // 7. Ativar o Filtro Automático na nova linha de cabeçalho (Linha 5)
      // A coluna J continua sendo a 10ª (Hits), então A5:J5 continua perfeito.
      ws.autoFilter = `A5:J5`;

      // ============================================================
      // ⬇️ GERAR E BAIXAR O ARQUIVO
      // ============================================================
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `issues_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) { 
      console.error(err);
      alert('Erro ao exportar Excel: ' + err.message); 
    }
  };

  const handlePrintPDF = async () => {
    try {
      const fullIssues = await fetchAllFilteredIssues();
      if (!fullIssues || fullIssues.length === 0) return alert('Nenhuma issue para imprimir');
      setReportIssues(fullIssues);
      setTimeout(() => handlePrint(), 100);
    } catch (err: any) { alert(err.message); }
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 inline-block ml-1" /> : <ChevronDown className="w-3 h-3 inline-block ml-1" />;
  };

  if (status === 'loading') return <div className="py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando...</div>;
  if (!session) return null;

  return (
    <div className="w-full space-y-6">
      <div className="hidden">
        <div ref={componentRef}>
          <IssuesReport issues={reportIssues} usersMap={usersMap} />
        </div>
      </div>

      <PageHeader
        title="Feed"
        subtitle="Acompanhe as vulnerabilidades encontradas no seu código."
        filters={
          <div className="flex flex-wrap gap-2">
            <ProjectSelect projects={projects} selectedId={filterProjectId} onChange={setFilterProjectId} placeholder="All Projects (Global)" />
          </div>
        }
        searchBar={
          /* 🔽 AdvancedSearch agora com a classe correta para o Modo Claro */
          <div className="advanced-search-container">
            <AdvancedSearch onSearch={setSearchQuery} context="issues" placeholder="Search for issues, e.g. is:unresolved" />
          </div>
        }
      />

      {/* 🔽 Botões Estilo Apple */}
      <div className="flex flex-wrap gap-3 justify-end">
        <button onClick={handleExportExcel} className="flex items-center gap-2 bg-apple-green hover:bg-[#28A745] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm">
          <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
        </button>
        <button onClick={handlePrintPDF} className="flex items-center gap-2 bg-[#F2F2F7] dark:bg-[#38383A] hover:bg-[#E5E5EA] dark:hover:bg-[#2C2C2E] text-apple-label-light dark:text-apple-label-dark px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-[#E5E5EA] dark:border-transparent">
          <FileText className="w-4 h-4" /> Imprimir PDF
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando Issues...</div>
      ) : error ? (
        <div className="bg-[#FFD1D1] dark:bg-[#FF453A]/20 border border-[#FF453A]/40 rounded-xl p-6 text-[#FF453A]">{error}</div>
      ) : issues.length === 0 ? (
        <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-12 text-center text-apple-tertiary-light dark:text-apple-tertiary-dark shadow-sm">
          <p className="text-base font-semibold">Nenhuma issue encontrada.</p>
        </div>
      ) : (
        <>
          {/* 🔥 GRID COMPLETO E PAGINAÇÃO (PADRÃO APPLE) */}
          <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden w-full transition-colors duration-200">
            
            {/* 🍎 HEADER DA GRADE */}
            <div className="grid grid-cols-[30px_1fr_110px_110px_80px_150px_60px_80px_60px_60px] gap-0 text-[10px] 
            font-semibold text-apple-tertiary-light dark:text-apple-tertiary-dark uppercase tracking-wider bg-[#F2F2F7] dark:bg-apple-card-dark/60 border-b border-apple-border-light dark:border-apple-border-dark px-4 py-3 items-center hover:cursor-pointer 
            lg:grid-cols-[30px_1fr_110px_110px_80px_150px_60px_80px_60px_60px] transition-colors">
              <div></div>
              <div onClick={() => handleSort('fileName')} className="flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">Issue {getSortIcon('fileName')}</div>
              <div onClick={() => handleSort('lastSeen')} className="hidden md:flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">Last Seen {getSortIcon('lastSeen')}</div>
              <div onClick={() => handleSort('firstSeen')} className="hidden lg:flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">Age {getSortIcon('firstSeen')}</div>
              <div onClick={() => handleSort('branch')} className="hidden lg:flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">Branch {getSortIcon('branch')}</div>
              <div onClick={() => handleSort('category')} className="hidden lg:flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">Category {getSortIcon('category')}</div>
              <div className="text-center hidden md:block">Hits</div>
              <div onClick={() => handleSort('severity')} className="hidden lg:flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">Severity {getSortIcon('severity')}</div>
              <div onClick={() => handleSort('slaHours')} className="hidden lg:flex items-center gap-1 hover:text-apple-label-light dark:hover:text-apple-label-dark">SLA {getSortIcon('slaHours')}</div>
              <div className="text-center hover:text-apple-label-light dark:hover:text-apple-label-dark" onClick={() => handleSort('assignedTo')}>Assignee {getSortIcon('assignedTo')}</div>
            </div>

            {/* 🍎 CORPO DA GRADE */}
            <div className="divide-y divide-[#E5E5EA] dark:divide-[#38383A] w-full">
              {sortedItems.map((issue) => {
                const assignedUser = users.find(u => u.sub === issue.assignedTo);
                const isOpenPopup = openAssignee === issue._id.toString();
                return (
                  <div 
                    key={issue._id.toString()} 
                    className="grid grid-cols-[30px_1fr_110px_110px_80px_150px_60px_80px_60px_60px] gap-0 items-center 
                    bg-apple-card-light dark:bg-apple-card-dark hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] transition-colors duration-150 ease-in-out px-4 py-3 relative group 
                    lg:grid-cols-[30px_1fr_110px_110px_80px_150px_60px_80px_60px_60px]"
                  >
                    <div className="flex items-center justify-center">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded bg-white dark:bg-apple-card-dark border-apple-border-light dark:border-apple-border-dark focus:ring-apple-blue" />
                    </div>

                    <div className="overflow-hidden pr-2 min-w-0 flex flex-col gap-0.5">
                      <Link href={`/observations/${issue._id}`} className="text-apple-label-light dark:text-apple-label-dark font-medium text-sm hover:text-apple-blue dark:hover:text-[#0A84FF] transition-colors truncate cursor-pointer">
                        {issue.fileName}
                      </Link>
                      <div className="text-apple-tertiary-light dark:text-apple-tertiary-light text-[10px] font-mono truncate">{issue.filePath}</div>
                    </div>

                    <div className="hidden md:block text-xs text-apple-secondary-light dark:text-apple-secondary-dark">
                      {formatDistanceToNow(new Date(issue.lastSeen), { addSuffix: false, locale: ptBR })}
                    </div>

                    <div className="hidden lg:block text-xs text-apple-secondary-light dark:text-apple-secondary-dark">
                      {formatDistanceToNow(new Date(issue.firstSeen), { addSuffix: false, locale: ptBR })}
                    </div>

                    <div className="hidden lg:block text-xs truncate">
                      <span className="bg-[#F2F2F7] dark:bg-[#38383A] text-apple-secondary-light dark:text-[#E5E5EA] px-2 py-0.5 rounded text-[10px] font-medium border border-[#E5E5EA] dark:border-transparent">
                        {issue.branch}
                      </span>
                    </div>

                    <div className="hidden lg:block text-xs">
                      <span className="px-2 py-0.5 rounded bg-[#E3F2FD] dark:bg-[#0D47A1]/30 text-[#1565C0] dark:text-[#64B5F6] border border-[#E3F2FD] dark:border-[#0D47A1]/40 truncate max-w-[90px]">
                        {issue.category}
                      </span>
                    </div>

                    <div className="text-center font-mono text-sm text-apple-label-light dark:text-apple-label-dark font-bold hidden md:block">
                      {issue.hitCount}
                    </div>

                    {/* Pills de Severidade no Padrão Apple */}
                    <div className="hidden lg:block text-xs">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        issue.severity === 'critical' ? 'bg-[#FFD1D1] dark:bg-[#FF453A]/40 text-[#FF453A] dark:text-[#FF453A]' :
                        issue.severity === 'high' ? 'bg-[#FFD1D1] dark:bg-[#FF453A]/40 text-[#FF453A] dark:text-[#FF453A]' :
                        issue.severity === 'medium' ? 'bg-[#FFD60A]/20 text-[#FFD60A] dark:bg-[#FFD60A]/30 text-[#FFD60A] dark:text-[#FFD60A]' :
                        'bg-[#F2F2F7] dark:bg-[#38383A] text-apple-tertiary-light dark:text-apple-tertiary-light'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>

                    <div className="hidden lg:block text-xs text-apple-secondary-light dark:text-apple-secondary-dark text-center">
                      {issue.slaHours}h
                    </div>

                    <div className="flex justify-center relative">
                      <button onClick={() => setOpenAssignee(isOpenPopup ? null : issue._id.toString())} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[#F2F2F7] dark:hover:bg-[#38383A] transition-colors">
                        {assignedUser ? (
                          <UserAvatar name={assignedUser.name} sub={assignedUser.sub} className="w-6 h-6 text-[8px]" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-apple-tertiary-light" />
                        )}
                      </button>

                      {/* Popover de Assignee no Padrão Apple */}
                      {isOpenPopup && (
                        <div className="absolute right-0 top-8 z-50 w-72 bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.6)] p-4 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-apple-secondary-light dark:text-apple-secondary-dark">Assignee</span>
                            <button onClick={() => updateIssue(issue._id.toString(), '')} className="text-[10px] text-apple-tertiary-light hover:text-apple-label-light dark:hover:text-apple-label-dark transition-colors">Clear</button>
                          </div>
                          <div className="relative mb-3">
                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-apple-tertiary-light" />
                            <input type="text" placeholder="Search users..." value={assigneeSearch} onChange={(e) => setAssigneeSearch(e.target.value)} className="w-full bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-apple-border-light dark:border-apple-border-dark rounded-xl pl-8 pr-3 py-1.5 text-xs text-apple-label-light dark:text-apple-label-dark transition-colors" />
                          </div>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            <div className="text-[9px] uppercase text-apple-tertiary-light dark:text-apple-tertiary-dark font-semibold px-1 mt-1 mb-1">Members</div>
                            {users.filter(u => !assigneeSearch || u.name?.toLowerCase().includes(assigneeSearch.toLowerCase())).map(u => (
                              <button key={u.sub} onClick={() => updateIssue(issue._id.toString(), u.sub)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-left transition-colors">
                                <UserAvatar name={u.name} sub={u.sub} className="w-6 h-6 text-[8px]" />
                                <span className="text-xs text-apple-label-light dark:text-apple-label-dark">{u.name || u.email}</span>
                                {issue.assignedTo === u.sub && <Check className="w-3 h-3 text-apple-blue ml-auto" />}
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 pt-2 border-t border-apple-border-light dark:border-apple-border-dark">
                            <button onClick={() => alert("Funcionalidade 'Invite Member' em breve!")} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] text-left text-apple-secondary-light dark:text-apple-secondary-dark transition-colors">
                              <UserPlus className="w-3.5 h-3.5 text-apple-tertiary-light" />
                              <span className="text-xs">Invite Member (Em breve)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Paginação no Padrão Apple */}
          <div className="flex justify-between items-center">
            <span className="text-apple-tertiary-light dark:text-apple-tertiary-dark text-sm">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="bg-[#F2F2F7] dark:bg-[#38383A] hover:bg-[#E5E5EA] dark:hover:bg-[#2C2C2E] disabled:opacity-50 text-apple-label-light dark:text-apple-label-dark px-3 py-1 rounded-xl flex items-center gap-1 transition-colors border border-[#E5E5EA] dark:border-transparent">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="bg-[#F2F2F7] dark:bg-[#38383A] hover:bg-[#E5E5EA] dark:hover:bg-[#2C2C2E] disabled:opacity-50 text-apple-label-light dark:text-apple-label-dark px-3 py-1 rounded-xl flex items-center gap-1 transition-colors border border-[#E5E5EA] dark:border-transparent">
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}