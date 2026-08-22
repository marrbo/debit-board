// components/dbql/DBQLHelpModal.tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Link from 'next/link';

interface DBQLHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'issues' | 'users' | 'projects' | string; // Adicione novos models aqui
}

// Dicionário dinâmico que mapeia o contexto para os campos do Model
const contextPropertiesMapping: Record<string, { prop: string; desc: string; ex: string }[]> = {
  issues: [
    { prop: 'category', desc: 'Categoria da vulnerabilidade', ex: 'category:"Broken Access Control"' },
    { prop: 'severity', desc: 'Severidade (critical, high, medium, low)', ex: 'severity:critical' },
    { prop: 'branch', desc: 'Branch do repositório', ex: 'branch:main' },
    { prop: 'project', desc: 'Nome do projeto', ex: 'project:GEPIN_AS' },
    { prop: 'repository', desc: 'Repositório', ex: 'repository:repo-name' },
    { prop: 'status', desc: 'Status da issue (open, fixed, etc.)', ex: 'status:open' },
    { prop: 'is', desc: 'Estado especial', ex: 'is:unresolved' },
  ],
  // Exemplo de como escalar para outros contextos futuramente:
  users: [
    { prop: 'role', desc: 'Nível de acesso do usuário', ex: 'role:admin' },
    { prop: 'department', desc: 'Departamento', ex: 'department:IT' },
    { prop: 'status', desc: 'Status da conta', ex: 'status:active' },
  ],
};

const defaultProperties = [
  { prop: 'name', desc: 'Nome ou título', ex: 'name:"Exemplo"' },
  { prop: 'id', desc: 'Identificador único', ex: 'id:123' },
];

const operators = [
  { op: 'AND', desc: 'E lógico', ex: 'branch:main AND severity:critical' },
  { op: 'OR', desc: 'OU lógico', ex: 'severity:high OR severity:critical' },
  { op: 'NOT', desc: 'NÃO lógico', ex: 'NOT branch:main' },
  { op: '!', desc: 'Nega um termo (atalho)', ex: '!branch:main' },
  { op: '( )', desc: 'Agrupamento', ex: '(severity:high OR severity:critical)' },
  { op: '*', desc: 'Curinga (Wildcard)', ex: 'fileName:*Controller.cs' },
];

export default function DBQLHelpModal({ isOpen, onClose, context = 'issues' }: DBQLHelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fecha o modal ao clicar fora da área principal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentProperties = contextPropertiesMapping[context] || defaultProperties;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-[#1C1C1E] w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            DBQL - Sintaxe Rápida
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal (com Scroll) */}
        <div className="p-6 overflow-y-auto font-sans">
          
          {/* Seção de Propriedades */}
          <div className="mb-8">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>🔍</span> Propriedades
            </h3>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-1/4">Propriedade</th>
                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-1/3">Descrição</th>
                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-auto">Exemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {currentProperties.map((item) => (
                    <tr key={item.prop} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="p-3 font-mono text-xs text-gray-800 dark:text-gray-200">{item.prop}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{item.desc}</td>
                      <td className="p-3">
                        <code className="font-mono text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-300">
                          {item.ex}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção de Operadores */}
          <div className="mb-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>⚙️</span> Operadores e Símbolos
            </h3>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-1/4">Operador</th>
                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-1/3">Descrição</th>
                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 w-auto">Exemplo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {operators.map((item) => (
                    <tr key={item.op} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{item.op}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{item.desc}</td>
                      <td className="p-3">
                        <code className="font-mono text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-300">
                          {item.ex}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer com botão da Wiki */}
        <div className="p-5 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Para uma documentação completa com exemplos avançados, consulte a Wiki.
          </span>
          <Link 
            href="/wiki/DBQL/1.Syntax"
            onClick={onClose}
            className="shrink-0 bg-[#007AFF] hover:bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            Abrir Página de Ajuda Completa
          </Link>
        </div>

      </div>
    </div>
  );
}