'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Code, ShieldAlert, BookOpen, ShieldCheck } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// 🔥 Importações do Markdown (Já usadas na sua Wiki)
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function IssueDetailPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [issue, setIssue] = useState<any>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [errorIssue, setErrorIssue] = useState<string | null>(null);
  
  const [snippets, setSnippets] = useState<{ snippet: string; hitLine: number; startLine: number }[]>([]);
  const [loadingSnippets, setLoadingSnippets] = useState(false);
  const [errorSnippets, setErrorSnippets] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [activeTab, setActiveTab] = useState<'code' | 'why' | 'fix'>('code');
  const [activeSnippetIndex, setActiveSnippetIndex] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  
  const isAdmin = session?.user?.tenantId === 'tenant_admin';

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

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) { router.push('/login'); return; }

    const fetchIssueDetails = async () => {
      setLoadingIssue(true);
      try {
        const issueRes = await fetch(`/api/issues?id=${params.id}`);
        if (!issueRes.ok) throw new Error('Erro ao carregar Issue');
        const data = await issueRes.json();
        
        let foundIssue = null;
        if (data._id) foundIssue = data;
        else if (data.issues && Array.isArray(data.issues)) foundIssue = data.issues.find((i: any) => i._id === params.id);
        if (!foundIssue) throw new Error('Issue não encontrada.');
        setIssue(foundIssue);

        setLoadingSnippets(true);
        setErrorSnippets(null);
        
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const snippetRes = await fetch(`/api/issues/${params.id}/snippet`, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (snippetRes.ok) {
            const snippetData = await snippetRes.json();
            setSnippets(snippetData.snippets || []);
            
            if (snippetData.pattern) {
              setIssue((prev: any) => ({ ...prev, patternId: snippetData.pattern }));
            }
          } else {
            setErrorSnippets('Azure DevOps indisponível, não foi possível carregar o código.');
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setErrorSnippets('Tempo máximo de espera excedido (30s). Azure DevOps indisponível, não foi possível carregar o código.');
          } else {
            setErrorSnippets('Erro ao carregar o trecho de código do Azure.');
          }
        } finally {
          setLoadingSnippets(false);
          abortControllerRef.current = null;
        }

      } catch (err: any) { 
        setErrorIssue(err.message); 
      } finally { 
        setLoadingIssue(false); 
      }
    };
    fetchIssueDetails();
  }, [params.id, session, status, router]);

  if (loadingIssue) return <div className="flex justify-center py-12 text-apple-tertiary-light dark:text-apple-tertiary-dark">Carregando detalhes da Issue...</div>;
  if (errorIssue) return <div className="w-full px-4 py-6 text-apple-red">Erro: {errorIssue}</div>;
  if (!issue) return <div className="text-center py-12 text-apple-tertiary-light">Issue não encontrada.</div>;

  const azureUrl = `${session?.user?.azureSettings?.instanceUrl || ''}/tfs/${session?.user?.azureSettings?.azureCollection || ''}/${issue.project}/_git/${issue.repository}?path=${issue.filePath}&_a=contents`;
  const pattern = issue.patternId || null;

  const renderSnippet = () => {
    if (snippets.length === 0) return <div className="text-apple-tertiary-light text-sm mt-4">Sem trecho de código disponível.</div>;
    
    const current = snippets[activeSnippetIndex];
    return (
      <div className="w-full transition-all duration-300">
        <div className="flex items-center justify-between mb-4 text-apple-tertiary-light">
            <span className="text-xs font-mono">Linhas {current.startLine} - {current.startLine + current.snippet.split('\n').length - 1}</span>
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
            style={isDarkTheme ? oneDark : oneLight}
            showLineNumbers={true}
            customStyle={{ 
              backgroundColor: isDarkTheme ? '#0f172a' : '#f8fafc', 
              padding: '1.5rem', 
              fontSize: '0.875rem', 
              margin: 0,
              transition: 'background-color 0.2s ease'
            }}
            lineProps={(lineNumber) => {
              const globalLine = (current.startLine || 1) + lineNumber - 1;
              const isHit = globalLine === current.hitLine;
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
            {current.snippet}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
        <div className="flex items-center justify-between border-b border-apple-border-light dark:border-apple-border-dark pb-4">
            <div className="flex items-center gap-4">
                <Link href="/issues" className="flex items-center gap-2 text-apple-tertiary-light hover:text-apple-label-light transition-colors"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
                <div className="h-6 w-px bg-apple-border-light dark:border-apple-border-dark"></div>
                <h1 className="text-xl font-bold text-apple-label-light dark:text-apple-label-dark">{issue.fileName}</h1>
            </div>
            <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    issue.severity === 'critical' ? 'bg-apple-red/10 text-apple-red border border-apple-red/20' :
                    issue.severity === 'high' ? 'bg-apple-orange/10 text-apple-orange border border-apple-orange/20' :
                    issue.severity === 'medium' ? 'bg-apple-yellow/10 text-apple-yellow border border-apple-yellow/20' :
                    'bg-apple-blue/10 text-apple-blue border border-apple-blue/20'
                }`}>
                    {issue.severity?.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark`}>
                    {issue.status.toUpperCase()}
                </span>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
            {/* Painel Esquerdo */}
            <div className="w-full md:w-1/3 space-y-4">
                <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-apple-tertiary-light uppercase tracking-wider mb-3">Propriedades</h3>
                    <div className="space-y-2 text-sm text-apple-label-light dark:text-apple-label-dark">
                        <div className="flex justify-between"><span className="text-apple-tertiary-light">Projeto</span><span className="font-medium">{issue.project}</span></div>
                        <div className="flex justify-between"><span className="text-apple-tertiary-light">Repo</span><span className="font-medium truncate">{issue.repository}</span></div>
                        <div className="flex justify-between"><span className="text-apple-tertiary-light">Branch</span><span className="font-medium">{issue.branch}</span></div>
                        <div className="flex justify-between"><span className="text-apple-tertiary-light">Hits</span><span className="font-medium text-apple-orange">{issue.hitCount}</span></div>
                        <div className="flex justify-between items-center"><span className="text-apple-tertiary-light">Criado</span><span className="font-medium text-xs">{formatDistanceToNow(new Date(issue.firstSeen), { addSuffix: true, locale: ptBR })}</span></div>
                    </div>
                </div>
                
                {/* Painel da Issue */}
                <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-apple-tertiary-light uppercase tracking-wider mb-3">Issue</h3>
                    <div className="space-y-2 text-sm text-apple-label-light dark:text-apple-label-dark">
                        <div className="flex justify-between"><span className="text-apple-tertiary-light">Categoria</span><span className="font-medium">{issue.category}</span></div>
                        {pattern?.externalId && pattern?.externalLink ? (
                            <div className="flex justify-between items-center">
                                <span className="text-apple-tertiary-light">External ID</span>
                                <a href={pattern.externalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-apple-blue hover:text-apple-blue/80 text-sm font-medium max-w-[50%] text-right break-all">
                                    {pattern.externalId} <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                            </div>
                        ) : (
                            <div className="flex justify-between">
                                <span className="text-apple-tertiary-light">External ID</span>
                                <span className="text-apple-tertiary-light text-xs">--</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-apple-tertiary-light">SLA (horas)</span>
                            <span className="font-medium">{pattern?.slaHours || issue.slaHours}h</span>
                        </div>
                    </div>
                </div>

                <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-apple-tertiary-light uppercase tracking-wider mb-3">Ações</h3>
                    <a href={azureUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-apple-tertiary-light/10 hover:bg-apple-tertiary-light/20 py-2 rounded-xl text-sm font-medium text-apple-label-light transition-colors border border-apple-border-light dark:border-transparent">
                        Ver no Azure <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>

            {/* Painel Direito */}
            <div className="w-full md:w-2/3">
                <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex border-b border-apple-border-light dark:border-apple-border-dark bg-apple-bg-light/30 dark:bg-apple-bg-dark/20">
                        <button onClick={() => setActiveTab('code')} className={`px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'code' ? 'border-b-2 border-apple-blue text-apple-blue' : 'text-apple-tertiary-light hover:text-apple-label-light'}`}>Onde está o problema?</button>
                        <button onClick={() => setActiveTab('why')} className={`px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'why' ? 'border-b-2 border-apple-blue text-apple-blue' : 'text-apple-tertiary-light hover:text-apple-label-light'}`}>Por que isso é um problema?</button>
                        <button onClick={() => setActiveTab('fix')} className={`px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'fix' ? 'border-b-2 border-apple-blue text-apple-blue' : 'text-apple-tertiary-light hover:text-apple-label-light'}`}>Como corrigir?</button>
                    </div>

                    <div className="p-6">
                        {activeTab === 'code' && (
                            <div>
                                <div className="mb-4 flex flex-col md:flex-row justify-between md:items-center gap-2">
                                    <div>
                                        <h4 className="font-medium text-apple-label-light dark:text-apple-label-dark mb-1">Ocorrência encontrada em:</h4>
                                        <p className="text-xs text-apple-tertiary-light font-mono break-all">{issue.filePath}</p>
                                    </div>
                                </div>
                                {loadingSnippets && (
                                    <div className="flex flex-col items-center justify-center h-44 border border-apple-border-light dark:border-apple-border-dark rounded-xl bg-apple-card-light/50 dark:bg-apple-card-dark/50">
                                        <div className="w-6 h-6 border-2 border-apple-blue/30 border-t-apple-blue rounded-full animate-spin mb-3"></div>
                                        <p className="text-sm text-apple-tertiary-light">Carregando trecho de código do Azure...</p>
                                    </div>
                                )}
                                {errorSnippets && !loadingSnippets && (
                                    <div className="flex flex-col items-center justify-center h-44 border border-apple-red/20 rounded-xl bg-apple-red/5 p-4 text-center">
                                        <p className="text-sm font-medium text-apple-red mb-1">Falha ao carregar o código</p>
                                        <p className="text-xs text-apple-tertiary-light text-center max-w-md mx-auto">{errorSnippets}</p>
                                    </div>
                                )}
                                {!loadingSnippets && !errorSnippets && renderSnippet()}
                                {!loadingSnippets && (
                                    <div className="mt-4 flex items-center justify-start gap-1.5 text-[10px] text-apple-tertiary-light border-t border-apple-border-light/50 dark:border-apple-border-dark/50 pt-3 pl-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-apple-green dark:text-apple-green/80" />
                                        <span>Para garantir sua privacidade, este trecho de código não é armazenado em nosso banco de dados. Ele é consultado em tempo real e exibido apenas enquanto a conexão com o Azure estiver ativa.</span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* 🔥 ABA WHY COM MARKDOWN RENDERIZADO */}
                        {activeTab === 'why' && (
                            <div className="space-y-4 text-sm leading-relaxed text-apple-label-light dark:text-apple-label-dark">
                                <BookOpen className="w-5 h-5 text-apple-blue mb-2" />
                                <div className="prose prose-slate dark:prose-invert max-w-none">
                                    <Markdown remarkPlugins={[remarkGfm]}>
                                        {pattern?.description || "Não há descrição cadastrada no sistema para este padrão. O administrador pode cadastrar uma recomendação no módulo de Padrões SAST."}
                                    </Markdown>
                                </div>
                            </div>
                        )}
                        
                        {/* 🔥 ABA FIX COM MARKDOWN RENDERIZADO */}
                        {activeTab === 'fix' && (
                            <div className="space-y-4 text-sm leading-relaxed text-apple-label-light dark:text-apple-label-dark">
                                <BookOpen className="w-5 h-5 text-apple-green mb-2" />
                                <div className="prose prose-slate dark:prose-invert max-w-none">
                                    <Markdown remarkPlugins={[remarkGfm]}>
                                        {pattern?.recommendation || "Não há recomendação cadastrada no sistema para este padrão. O administrador pode cadastrar uma recomendação no módulo de Padrões SAST."}
                                    </Markdown>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}