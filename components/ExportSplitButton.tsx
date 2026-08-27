"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, FileSpreadsheet, ChevronDown } from "lucide-react";

interface ExportSplitButtonProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  title?: string; // para acessibilidade, opcional
}

export default function ExportSplitButton({
  onExportPDF,
  onExportExcel,
  title = "Exportar",
}: ExportSplitButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center text-[12px]" ref={menuRef}>
      {/* Botão principal: exportar PDF */}
      <button
        onClick={onExportPDF}
        className="p-1.5 flex items-center gap-2 text-apple-tertiary-light hover:text-apple-red hover:bg-apple-red/10 rounded-md transition-colors"
        title="Exportar PDF"
        aria-label="Exportar PDF"
      >
        <FileText className="w-4 h-4" />
        {title}
      </button>

      {/* Botão do chevron para abrir o menu */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="p-1.5 text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 rounded-md transition-colors"
        title="Opções de exportação"
        aria-label="Opções de exportação"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Dropdown */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1C1C1E] border border-apple-border-light dark:border-apple-border-dark rounded-md shadow-lg p-1 z-50">
          <button
            onClick={onExportPDF}
            className="w-full text-left px-2 py-1.5 text-sm text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 rounded-md transition-colors"
            title="Exportar PDF"
            aria-label="Exportar PDF"
          >
            <FileText className="w-4 h-4 inline mr-1" />
            PDF
          </button>
          <button
            onClick={onExportExcel}
            className="w-full text-left px-2 py-1.5 text-sm text-apple-tertiary-light hover:text-apple-blue hover:bg-apple-blue/10 rounded-md transition-colors"
            title="Exportar Excel"
            aria-label="Exportar Excel"
          >
            <FileSpreadsheet className="w-4 h-4 inline mr-1" />
            Excel
          </button>
        </div>
      )}
    </div>
  );
}