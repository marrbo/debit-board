'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { parseRepoName } from '@/lib/utils';
import KPICards from '@/components/KPICards';
import Filters from '@/components/Filters';
import Charts from '@/components/Charts';
import ResultsList from '@/components/ResultsList';
import ExcelJS from 'exceljs';

export default function AzureSearchCodePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('ext:cs AllowAnonymous');
  const [searchText, setSearchText] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedGerencia, setSelectedGerencia] = useState('');
  const [selectedNucleo, setSelectedNucleo] = useState('');
  const [selectedRepo, setSelectedRepo] = useState('');
  const [groupBy, setGroupBy] = useState('project-repo');

  // ⏳ Estado de carregamento da sessão
  if (status === 'loading') {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 flex justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 🔐 Se não estiver logado, redireciona
  if (!session) {
    router.push('/login');
    return null;
  }

  // 🔥 Função principal de busca
  const fetchData = useCallback(async (queryToSend?: string) => {
    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      // A requisição vai para /api/search. O Backend vai buscar as configs no Banco!
      const payload = {
        searchText: queryToSend || searchQuery,
        skipResults: 0,
        takeResults: 0,
        filters: [],
        searchFilters: {},
        sortOptions: [],
        summarizedHitCountsNeeded: true,
        includeSuggestions: false,
        isInstantSearch: false,
      };

      const res = await fetch(`/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // X-Settings NÃO É MAIS NECESSÁRIO! O Backend vai buscar no banco.
          // Mas mantemos o header para não quebrar a assinatura da API que já estava pronta.
          'X-Settings': encodeURIComponent(JSON.stringify({})),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao buscar dados');
      }

      const data = await res.json();
      setItems(data.results.values || []);
      if (data.warning) setWarning(data.warning);
    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // 🔥 Executa a primeira busca ao montar a página
  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  const filteredItems = items.filter((item) => {
    const { gerencia, nucleo } = parseRepoName(item.repository);
    const matchesSearch =
      !searchText ||
      item.fileName?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.path?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.project?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.repository?.toLowerCase().includes(searchText.toLowerCase()) ||
      gerencia.toLowerCase().includes(searchText.toLowerCase()) ||
      nucleo.toLowerCase().includes(searchText.toLowerCase());

    const matchesProject = !selectedProject || item.project === selectedProject;
    const matchesGerencia = !selectedGerencia || gerencia === selectedGerencia;
    const matchesNucleo = !selectedNucleo || nucleo === selectedNucleo;
    const matchesRepo = !selectedRepo || item.repository === selectedRepo;

    return matchesSearch && matchesProject && matchesGerencia && matchesNucleo && matchesRepo;
  });

  const handleExportExcel = async () => {
    if (filteredItems.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }
    if (!confirm(`Deseja exportar ${filteredItems.length} registros?`)) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ocorrências');
    worksheet.columns = [
      { header: 'Nome do Arquivo', key: 'fileName', width: 30 },
      { header: 'Caminho', key: 'path', width: 40 },
      { header: 'Projeto', key: 'project', width: 20 },
      { header: 'Repositório', key: 'repository', width: 20 },
      { header: 'Gerência', key: 'gerencia', width: 15 },
      { header: 'Núcleo', key: 'nucleo', width: 20 },
      { header: 'Hits', key: 'hitCount', width: 10 },
    ];

    filteredItems.forEach((item) => {
      const { gerencia, nucleo } = parseRepoName(item.repository);
      worksheet.addRow({
        fileName: item.fileName,
        path: item.path,
        project: item.project,
        repository: item.repository,
        gerencia,
        nucleo,
        hitCount: item.hitCount || 0,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    alert('Funcionalidade de impressão integrada!');
  };

  return (
    <div className="w-full mx-auto px-6 py-6 lg:py-8 lg:px-8 space-y-6">
      {/* 🔥 Exibe o erro vindo da API sem travar a tela inteira */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-red-300 text-sm">
          <p className="font-medium">Acesso restrito</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {warning && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-4 text-amber-200 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <p>{warning}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            <FileText className="w-4 h-4" /> Imprimir PDF
          </button>
        </div>
      )}

      <KPICards items={filteredItems} />

      <Filters
        allItems={items}
        filteredItems={filteredItems}
        searchText={searchText}
        setSearchText={setSearchText}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        selectedGerencia={selectedGerencia}
        setSelectedGerencia={setSelectedGerencia}
        selectedNucleo={selectedNucleo}
        setSelectedNucleo={setSelectedNucleo}
        selectedRepo={selectedRepo}
        setSelectedRepo={setSelectedRepo}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        onSearch={() => fetchData(searchQuery)}
        disabled={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Projeto x Quantidade (Hits)
          </h2>
          <div className="h-64">
            <Charts data={filteredItems} type="project" />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Projeto x Repositórios x Ocorrências
          </h2>
          <div className="h-64">
            <Charts data={filteredItems} type="project-repo" />
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-4 text-right text-xs text-slate-500">
          Total de registros carregados: <strong className="text-slate-300">{items.length}</strong>
        </div>
      )}

      <ResultsList items={filteredItems} groupByMode={groupBy} azureSettings={session?.user?.azureSettings} />
    </div>
  );
}