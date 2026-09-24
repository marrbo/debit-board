"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert, { type AlertColor } from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";

// ============================================================
// Tipos
// ============================================================
export interface ToastOptions {
  duration?: number;
  description?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
}

export interface FeedbackApi {
  toast: {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface InternalToast extends ToastOptions {
  id: number;
  message: string;
  severity: AlertColor;
}

interface InternalConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export const FeedbackContext = createContext<FeedbackApi | null>(null);

// ============================================================
// Provider
// ============================================================
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<InternalToast | null>(null);
  const [confirmState, setConfirmState] = useState<InternalConfirm | null>(null);
  const toastIdRef = useRef(0);

  const pushToast = useCallback(
    (severity: AlertColor) =>
      (message: string, options?: ToastOptions) => {
        toastIdRef.current += 1;
        setToast({
          id: toastIdRef.current,
          message,
          severity,
          duration: options?.duration ?? 4000,
          description: options?.description,
        });
      },
    [],
  );

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> =>
      new Promise((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  const api = useMemo<FeedbackApi>(
    () => ({
      toast: {
        success: pushToast("success"),
        error: pushToast("error"),
        warning: pushToast("warning"),
        info: pushToast("info"),
      },
      confirm,
    }),
    [pushToast, confirm],
  );

  const handleToastClose = (
    _event?: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === "clickaway") return;
    setToast(null);
  };

  const handleConfirmChoice = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {/* Toast — Snackbar do MUI */}
      {toast && (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={toast.duration}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity}
            variant="filled"
            sx={{ width: "100%", fontSize: "0.8125rem" }}
          >
            <span className="font-medium">{toast.message}</span>
            {toast.description && (
              <span className="block text-xs opacity-90 mt-0.5">
                {toast.description}
              </span>
            )}
          </Alert>
        </Snackbar>
      )}

      {/* Confirm — Dialog do MUI */}
      <Dialog
        open={!!confirmState}
        onClose={() => handleConfirmChoice(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle
          sx={{ fontSize: "1rem", fontWeight: 700, pb: 1 }}
        >
          {confirmState?.title}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            {confirmState?.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => handleConfirmChoice(false)}
            size="small"
            color="inherit"
          >
            {confirmState?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            onClick={() => handleConfirmChoice(true)}
            variant="contained"
            size="small"
            color={confirmState?.variant === "danger" ? "error" : "primary"}
            autoFocus
          >
            {confirmState?.confirmLabel ?? "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
}