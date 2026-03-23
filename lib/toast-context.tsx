import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";
import { Toast, type ToastVariant } from "@/components/toast";

type ToastEntry = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showSuccess: () => {},
  showError: () => {},
  showInfo: () => {},
});

let _idCounter = 0;
const DISPLAY_DURATION = 3000; // ms before auto-dismiss
const GAP_DURATION = 150;      // ms between consecutive toasts

/**
 * Provides showSuccess / showError / showInfo throughout the app.
 * Queues toasts — only one is shown at a time.
 * Mount once inside AppProvider.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastEntry | null>(null);
  const [visible, setVisible] = useState(false);
  const queue = useRef<ToastEntry[]>([]);
  const isShowing = useRef(false);

  const processQueue = useCallback(() => {
    if (isShowing.current || queue.current.length === 0) return;
    const next = queue.current.shift()!;
    isShowing.current = true;
    setCurrent(next);
    setVisible(true);

    setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        isShowing.current = false;
        setCurrent(null);
        processQueue();
      }, 300 + GAP_DURATION); // wait for exit animation
    }, DISPLAY_DURATION);
  }, []);

  const enqueue = useCallback((message: string, variant: ToastVariant) => {
    queue.current.push({ id: ++_idCounter, message, variant });
    processQueue();
  }, [processQueue]);

  const showSuccess = useCallback((msg: string) => enqueue(msg, "success"), [enqueue]);
  const showError   = useCallback((msg: string) => enqueue(msg, "error"),   [enqueue]);
  const showInfo    = useCallback((msg: string) => enqueue(msg, "info"),    [enqueue]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      {current && (
        <Toast message={current.message} variant={current.variant} visible={visible} />
      )}
    </ToastContext.Provider>
  );
}

/** Returns toast helpers. Must be used inside ToastProvider. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
