//hooks/useConfirm.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ConfirmDialog, {
  type ConfirmDialogProps,
} from "@/components/ConfirmDialog";

// Estende as props do dialog com uma ação opcional a executar no confirm
export type ConfirmOptions = Omit<
  ConfirmDialogProps,
  "open" | "onConfirmAction" | "onCancelAction" | "loading"
> & {
  /**
   * Ação assíncrona executada quando o usuário clica em "Confirmar".
   * Se presente, o dialog mantém o estado de loading até a Promise resolver.
   * Se lançar erro, o dialog fecha e a Promise retorna `false`.
   */
  action?: () => Promise<void>;
};

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" });
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
    setLoading(false);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirmAction = async () => {
    // Sem action: fecha imediatamente
    if (!options.action) {
      resolver?.(true);
      setOpen(false);
      setResolver(null);
      return;
    }

    // Com action: mostra loading e só fecha quando terminar
    setLoading(true);
    try {
      await options.action();
      resolver?.(true);
    } catch {
      resolver?.(false);
    } finally {
      setLoading(false);
      setOpen(false);
      setResolver(null);
    }
  };

  const handleCancelAction = () => {
    resolver?.(false);
    setOpen(false);
    setResolver(null);
  };

  // Remove `action` das props passadas ao ConfirmDialog (não é prop do componente visual)
  const { action: _action, ...dialogProps } = options;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        {...dialogProps}
        open={open}
        loading={loading}
        onConfirmAction={handleConfirmAction}
        onCancelAction={handleCancelAction}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx.confirm;
}
