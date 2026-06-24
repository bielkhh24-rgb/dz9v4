import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dz9_theme';

export function useTema() {
  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo === 'dark' || salvo === 'light') return salvo;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(STORAGE_KEY, tema); } catch {}
  }, [tema]);

  const alternar = useCallback(() => {
    setTema(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { tema, alternar };
}
