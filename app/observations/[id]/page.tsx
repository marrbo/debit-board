// app/observations/[id]/page.tsx
'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, BookOpen, ShieldCheck, RotateCw } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// 🔥 Importações do Markdown
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { IObservation } from '@/types/IObservation';

export default function IssueDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { data: session, status } = useSession();
  const router = useRouter();

  // Estados Principais
  const [issue, setIssue] = useState<any>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [errorIssue, setErrorIssue] = useState<string | null>(null);

  // Estados do Snippet (Isolados)
  const [snippets, setSnippets] = useState<{ snippet: string; hitLine: number; startLine: number }[]>([]);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [errorSnippets, setErrorSnippets] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState<'code' | 'why' | 'fix'>('code');
  const [activeSnippetIndex, setActiveSnippetIndex] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // Detectar tema
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkTheme(isDark);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const getLanguageFromExtension = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      'cs': 'csharp', 'js': 'javascript', 'ts': 'typescript', 'py': 'python',
      'java': 'java', 'go': 'go', 'rb': 'ruby', 'rs': 'rust',
      'swift': 'swift', 'php': 'php', 'html': 'html', 'css': 'css',
      'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
      'md': 'markdown', 'sh': 'bash', 'bash': 'bash', 'ps1': 'powershell',
    };
    return map[ext || ''] || 'text';
  };

  // =========================================================================
  // 🔥 1. Função de Busca do Código (Azure) - Isolada e com Timeout de 15s
  // =========================================================================
  const fetchSnippet = async (issue: IObservation) => {
    if (!issue || !params.id) return;

    setLoadingSnippets(true);
    setErrorSnippets(null);
    setSnippets([]);
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 🔥 Timeout reduzido para 15s conforme solicitado
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const snippetRes = await fetch(`/api/observations/${params.id}/snippet`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (snippetRes.ok) {
        const snippetData = await snippetRes.json();
        setSnippets(snippetData.snippets || []);
        setLoadingSnippets(false);
      } else {
        setErrorSnippets('Azure DevOps indisponível, não foi possível carregar o código.');
        setLoadingSnippets(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        // 🔥 Mensagem personalizada de timeout
        setErrorSnippets('Tempo máximo de espera excedido (30s). Azure DevOps indisponível, não foi possível carregar o código.');
      } else {
        setErrorSnippets('Erro ao carregar o trecho de código do Azure.');
      }
      setLoadingSnippets(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  // =========================================================================
  // 🔥 2. Carregamento da Página e Estratégia de Renderização
  // =========================================================================
  useEffect(() => {
    if (issue !== null) return;
    if (!session) { router.push('/login'); return; }

    const fetchIssueDetails = async () => {
      setLoadingIssue(true);
      try {
        const issueRes = await fetch(`/api/observations?id=${params.id}`);
        if (!issueRes.ok) throw new Error('Erro ao carregar Observation');
        const data = await issueRes.json();
        
        let foundIssue = null;
        if (data._id) foundIssue = data;
        else if (data.observations && Array.isArray(data.observations)) foundIssue = data.observations.find((i: any) => i._id === params.id);
        
        if (!foundIssue) throw new Error('Issue não encontrada.');
        setIssue(foundIssue);

        // 🔥 Assim que a Issue carrega, começamos a buscar o código do Azure
        fetchSnippet(foundIssue);

      } catch (err: any) { 
        setErrorIssue(err.message); 
      } finally { 
        setLoadingIssue(false); 
      }
    };
    
    fetchIssueDetails();

    // Cleanup do AbortController ao desmontar a página
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [params.id, session, status, router, issue]);

  // Função de "Tentar Novamente" no erro
  const handleRetrySnippet = () => {
    fetchSnippet(issue);
  };

  if (loadingIssue) return <div className="flex justify-center py-12 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando detalhes da Issue...</div>;
  if (errorIssue) return <div className="w-full px-4 py-6 text-apple-red">Erro: {errorIssue}</div>;
  if (!issue) return <div className="text-center py-12 text-apple-tertiary-light">Issue não encontrada.</div>;

  const pattern = issue.patternId || null;
  const azureUrl = `${session?.user?.azureSettings?.instanceUrl || ''}/tfs/${session?.user?.azureSettings?.azureCollection || ''}/${issue.project}/_git/${issue.repository}?path=${issue.filePath}&version=GB${issue.branch}&_a=contents`;

  const renderSnippetContent = () => {
    if (loadingSnippets) {
      return (
        <div className="flex flex-col items-center justify-center h-44 border border-apple-border-light dark:border-apple-border-dark rounded-xl bg-apple-card-light/50 dark:bg-apple-card-dark/50">
          <div className="w-6 h-6 border-2 border-apple-blue/30 border-t-apple-blue rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-apple-tertiary-light">Carregando trecho de código do Azure...</p>
        </div>
      );
    }

    if (errorSnippets) {
      return (
        <div className="flex flex-col items-center justify-center h-44 border border-apple-red/20 rounded-xl bg-apple-red/5 p-4 text-center">
          <p className="text-sm font-medium text-apple-red mb-1">Falha ao carregar o código</p>
          <p className="text-xs text-apple-tertiary-light text-center max-w-md mx-auto mb-3">{errorSnippets}</p>
          <button 
            onClick={()=>handleRetrySnippet()}
            className="inline-flex items-center gap-2 bg-apple-blue hover:bg-[#0063CE] text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors shadow-sm"
          >
            <RotateCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      );
    }

    if (snippets.length === 0) {
      return <div className="text-apple-tertiary-light text-sm mt-4 text-center py-8">Nenhum trecho de código disponível para esta ocorrência.</div>;
    }

    const current = snippets[activeSnippetIndex];
    return (
      <div className="w-full transition-all duration-300">
        <div className="flex items-center justify-between mb-4 text-apple-tertiary-light">
            <span className="text-xs font-mono">Linhas {current?.startLine} - {(current?.startLine || 0) + (current?.snippet?.split('\n')?.length || 0) - 1}</span>
            {snippets.length > 1 && (
                <div className="flex gap-2">
                    <button onClick={() => setActiveSnippetIndex(i => Math.max(0, i-1))} disabled={activeSnippetIndex === 0} className="px-2 py-1 bg-apple-tertiary-light/10 rounded text-xs disabled:opacity-30">Anterior</button>
                    <span className="text-xs self-center">{activeSnippetIndex + 1} / {snippets.length}</span>
                    <button onClick={() => setActiveSnippetIndex(i => Math.min(snippets.length-1, i+1))} disabled={activeSnippetIndex === snippets.length-1} className="px-2 py-1 bg-apple-tertiary-light/10 rounded text-xs disabled:opacity-30">Próximo</button>
                </div>
            )}
        </div>
        <div className="rounded-xl border border-apple-border-light dark:border-apple-border-dark overflow-hidden transition-colors">
          <SyntaxHighlighter
            language={getLanguageFromExtension(issue.fileName)}
            wrapLongLines={true}
            style={isDarkTheme ? oneDark : oneLight}
            showLineNumbers={true}
            customStyle={{ 
              backgroundColor: isDarkTheme ? '#0f172a' : '#f8fafc', 
              padding: '1.5rem', 
              fontSize: '0.875rem', 
              margin: 0,
              transition: 'background-color 0.2s ease'
            }}
            startingLineNumber={current?.startLine}
            lineProps={(lineNumber) => {
              const globalLine = (current?.startLine || 1) + (lineNumber - 1);
              const isHit = globalLine === ((current?.hitLine || 0 ) + (current?.startLine || 1) - 1);
              if (isHit) {
                return { 
                  style: { 
                    display: 'block', 
                    backgroundColor: isDarkTheme ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.15)', 
                    borderLeft: `4px solid #ef4444`, 
                    paddingLeft: '1rem', 
                    marginLeft: '-1.5rem', 
                    paddingRight: '1rem', 
                    marginRight: '-1.5rem' 
                  } 
                };
              }
              return {};
            }}
          >
            {current?.snippet ?? ''}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  // =========================================================================
  // 🔥 3. Layout Refatorado (Baseado no SecObserve)
  // =========================================================================
  return (
    <div className="w-full mx-auto px-4 py-4 space-y-6">
      
      {/* 🔥 Cabeçalho Estilo "Observation" */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-apple-border-light dark:border-apple-border-dark pb-4 mb-2">
        <div className="flex items-center gap-4">
          <Link href="/observations" className="flex items-center gap-2 text-apple-tertiary-light hover:text-apple-label-light transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <div className="h-6 w-px bg-apple-border-light dark:border-apple-border-dark"></div>
          <h1 className="text-lg font-bold text-apple-label-light dark:text-apple-label-dark">{issue.fileName}</h1>
        </div>
        
        {/* Badges de Severidade e Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            issue.severity === 'critical' ? 'bg-apple-red/10 text-apple-red border border-apple-red/20' :
            issue.severity === 'high' ? 'bg-apple-orange/10 text-apple-orange border border-apple-orange/20' :
            issue.severity === 'medium' ? 'bg-apple-yellow/10 text-apple-yellow border border-apple-yellow/20' :
            'bg-apple-blue/10 text-apple-blue border border-apple-blue/20'
          }`}>
            {issue.severity?.toUpperCase()}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            issue.status === 'open' || issue.status === 'recurring' ? 'bg-apple-blue/10 text-apple-blue border border-apple-blue/20' :
            issue.status === 'resolved' ? 'bg-apple-green/10 text-apple-green border border-apple-green/20' :
            'bg-apple-tertiary-light/10 text-apple-tertiary-light border border-apple-border-light'
          }`}>
            {issue.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* 🔥 Layout de 2 Colunas (Conteúdo Principal + Sidebar Lateral) */}
      <div className="flex flex-col lg:flex-row gap-8">

        {/* LADO ESQUERDO (Conteúdo Principal - 65% da tela) */}
        <div className="w-full lg:w-[65%] space-y-8">
          
          {/* 🔥 Abas de Contexto do SecObserve */}
          <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-apple-border-light dark:border-apple-border-dark bg-apple-bg-light/30 dark:bg-apple-bg-dark/20">
              <button onClick={() => setActiveTab('code')} className={`px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'code' ? 'border-b-2 border-apple-red text-apple-red' : 'text-apple-tertiary-light hover:text-apple-label-light'}`}>Onde está o problema?</button>
              <button onClick={() => setActiveTab('why')} className={`px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'why' ? 'border-b-2 border-apple-blue text-apple-blue' : 'text-apple-tertiary-light hover:text-apple-label-light'}`}>Por que isso é um problema?</button>
              <button onClick={() => setActiveTab('fix')} className={`px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'fix' ? 'border-b-2 border-apple-green text-apple-green' : 'text-apple-tertiary-light hover:text-apple-label-light'}`}>Como corrigir?</button>
            </div>

            <div className="p-6">
              {activeTab === 'code' && (
                <div>
                  <div className="mb-4 flex flex-col md:flex-row justify-between md:items-center gap-2">
                      <div>
                        <h4 className="font-medium text-apple-label-light dark:text-apple-label-dark mb-1 text-sm">Ocorrência encontrada em:</h4>
                        <p className="text-xs text-apple-tertiary-light font-mono break-all">{issue.filePath}</p>
                      </div>
                  </div>
                  {/* Renderização do Bloco de Código com Loading Isolado */}
                  {renderSnippetContent()}
                  {!loadingSnippets && !errorSnippets && snippets.length > 0 && (
                    <div className="mt-4 flex items-center justify-start gap-1.5 text-[10px] text-apple-tertiary-light border-t border-apple-border-light/50 dark:border-apple-border-dark/50 pt-3 pl-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-apple-green dark:text-apple-green/80" />
                        <span>Para garantir sua privacidade, este trecho de código não é armazenado em nosso banco de dados. Ele é consultado em tempo real e exibido apenas enquanto a conexão com o Azure estiver ativa.</span>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'why' && (
                <div className="space-y-4 text-sm leading-relaxed text-apple-label-light dark:text-apple-label-dark ">
                    <BookOpen className="w-5 h-5 text-apple-blue mb-2 " />
                    <div className="prose prose-slate dark:prose-invert max-w-none scroll-my-20 min-h-[350px] max-h-[550px] overflow-auto p-3">
                        <Markdown remarkPlugins={[remarkGfm]}>
                            {pattern?.description || "Não há descrição cadastrada no sistema para este padrão. O administrador pode cadastrar uma recomendação no módulo de Padrões SAST."}
                        </Markdown>
                    </div>
                </div>
              )}
              
              {activeTab === 'fix' && (
                <div className="space-y-4 text-sm leading-relaxed text-apple-label-light dark:text-apple-label-dark">
                    <BookOpen className="w-5 h-5 text-apple-green mb-2" />
                    <div className="prose prose-slate dark:prose-invert max-w-none scroll-my-20 min-h-[362px] max-h-[550px] overflow-auto p-3">
                        <Markdown remarkPlugins={[remarkGfm]}>
                            {pattern?.recommendation || "Não há recomendação cadastrada no sistema para este padrão. O administrador pode cadastrar uma recomendação no módulo de Padrões SAST."}
                        </Markdown>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LADO DIREITO (Sidebar - 35% da tela) */}
        <div className="w-full lg:w-[35%] space-y-6">
          
          {/* Ações */}
          <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm">
              <h3 className="text-[10px] font-bold text-apple-tertiary-light uppercase tracking-wider mb-3">Actions</h3>
              <a href={azureUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-apple-tertiary-light/10 hover:bg-apple-tertiary-light/20 py-2.5 rounded-xl text-sm font-medium text-apple-label-light transition-colors border border-apple-border-light dark:border-transparent">
                  Ver no Azure <ExternalLink className="w-4 h-4" />
              </a>
          </div>

          {/* Origem / Metadata */}
          <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm divide-y divide-apple-border-light/50 dark:divide-apple-border-dark/50">
            
            <div className="pb-4 mb-4">
              <h3 className="text-[10px] font-bold text-apple-tertiary-light uppercase tracking-wider mb-3">Origem</h3>
              <div className="space-y-2 text-sm text-apple-label-light dark:text-apple-label-dark">
                  <div className="flex justify-between"><span className="text-apple-tertiary-light text-xs">Project</span><span className="font-medium text-xs">{issue.project}</span></div>
                  <div className="flex justify-between"><span className="text-apple-tertiary-light text-xs">Repository</span><span className="font-medium text-xs truncate max-w-[50%] text-right">{issue.repository}</span></div>
                  <div className="flex justify-between"><span className="text-apple-tertiary-light text-xs">Branch</span><span className="font-medium text-xs">{issue.branch}</span></div>
                  <div className="flex justify-between items-end"><span className="text-apple-tertiary-light text-xs">Source file</span><span className="font-mono text-right text-xs w-2/3 break-all bg-apple-bg-light/30 dark:bg-apple-bg-dark/30 px-2 py-0.5 rounded">{issue.filePath.split('/').pop().trim()}</span></div>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-[10px] font-bold text-apple-tertiary-light uppercase tracking-wider mb-3">Metadata</h3>
              <div className="space-y-2 text-sm text-apple-label-light dark:text-apple-label-dark">
                  <div className="flex justify-between"><span className="text-apple-tertiary-light text-xs">Category</span><span className="font-medium text-xs">{issue.category}</span></div>
                  <div className="flex justify-between"><span className="text-apple-tertiary-light text-xs">Hits</span><span className="font-medium text-xs text-apple-orange">{issue.hitCount}</span></div>
                  <div className="flex justify-between"><span className="text-apple-tertiary-light text-xs">SLA</span><span className="font-medium text-xs">{issue.slaHours}h</span></div>
                  <div className="flex justify-between items-center"><span className="text-apple-tertiary-light text-xs">Created</span><span className="font-medium text-xs">{formatDistanceToNow(new Date(issue.firstSeen), { addSuffix: true, locale: ptBR })}</span></div>
                  {pattern?.externalId && pattern?.externalLink && (
                    <div className="flex justify-between items-center border-t border-apple-border-light/50 dark:border-apple-border-dark/50 pt-2 mt-2">
                      <span className="text-apple-tertiary-light text-xs">External ID</span>
                      <a href={pattern.externalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-apple-blue hover:text-apple-blue/80 text-xs font-medium max-w-[50%] text-right break-all">
                          {pattern.externalId} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}