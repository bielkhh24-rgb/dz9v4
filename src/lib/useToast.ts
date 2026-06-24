import { useState, useCallback } from 'react';

export type ToastTipo = 'success' | 'error' | 'info';
export interface ToastItem { id: number; texto: string; tipo: ToastTipo; }

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((texto: string, tipo: ToastTipo = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, texto, tipo }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  }, []);

  const remover = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, toast, remover };
}
