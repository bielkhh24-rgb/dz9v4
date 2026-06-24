import { useState, useEffect, useCallback } from 'react';
import { Agendamento, Servico } from '../types';
import { HORARIOS } from '../data';

const STORAGE_KEY = 'dz9_agendamentos';

function carregar(): Agendamento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const lista: Agendamento[] = JSON.parse(raw);
    // Migração: registros antigos (servicoId scalar) → novo schema
    return lista.map(a => {
      if (!a.servicos || a.servicos.length === 0) {
        const servicoLegado: Servico = {
          id: a.servicoId ?? 'legado',
          nome: a.servicoNome ?? 'Serviço',
          preco: a.preco ?? 0,
          duracao: 30,
          icone: '✂️',
        };
        return {
          ...a,
          servicos: [servicoLegado],
          totalPreco: a.preco ?? 0,
          totalDuracao: 30,
        };
      }
      return a;
    });
  } catch {
    return [];
  }
}

function salvar(lista: Agendamento[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // localStorage indisponível — segue só em memória
  }
}

// Converte "HH:MM" em minutos desde meia-noite
function paraMinutos(horario: string): number {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}

// Retorna todos os slots (de HORARIOS) que um agendamento ocupa
function slotsOcupados(horarioInicio: string, duracao: number): string[] {
  const inicio = paraMinutos(horarioInicio);
  const fim = inicio + duracao;
  return HORARIOS.filter(h => {
    const hMin = paraMinutos(h);
    // slot é ocupado se começa dentro do intervalo [inicio, fim)
    return hMin >= inicio && hMin < fim;
  });
}

let nextId = 1;

export function useAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  useEffect(() => {
    const carregados = carregar();
    setAgendamentos(carregados);
    nextId = carregados.reduce((max, a) => {
      const n = parseInt(a.id.replace('agt-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n + 1);
    }, 1);
  }, []);

  const persistir = useCallback((lista: Agendamento[]) => {
    setAgendamentos(lista);
    salvar(lista);
  }, []);

  // ── Validações ────────────────────────────────────────────
  function validar(dados: {
    clienteNome: string;
    data: string;
    horario: string;
    servicos: Servico[];
  }): string | null {
    if (!dados.clienteNome || !dados.clienteNome.trim()) {
      return 'Informe o nome do cliente.';
    }
    if (!dados.servicos || dados.servicos.length === 0) {
      return 'Selecione ao menos um serviço.';
    }
    if (!dados.data) {
      return 'Selecione uma data.';
    }
    if (!dados.horario || !HORARIOS.includes(dados.horario)) {
      return 'Selecione um horário válido.';
    }
    const dataObj = new Date(dados.data + 'T12:00:00');
    if (isNaN(dataObj.getTime())) {
      return 'Data inválida.';
    }
    if (dataObj.getDay() === 0) {
      return 'Domingo é fechado. Escolha outro dia.';
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEscolhida = new Date(dados.data + 'T00:00:00');
    if (dataEscolhida < hoje) {
      return 'Não é possível agendar em datas passadas.';
    }
    return null;
  }

  // Retorna todos os slots bloqueados em uma data, considerando duração real
  function horariosOcupados(data: string, excluirId?: string): string[] {
    const ocupados = new Set<string>();
    agendamentos
      .filter(a => a.data === data && a.status !== 'cancelado' && a.id !== excluirId)
      .forEach(a => {
        slotsOcupados(a.horario, a.totalDuracao ?? 30).forEach(s => ocupados.add(s));
      });
    return Array.from(ocupados);
  }

  // Verifica se um horário específico está ocupado (considerando duração do novo agendamento)
  function horarioOcupado(
    data: string,
    horario: string,
    duracao: number,
    excluirId?: string,
  ): boolean {
    const novoInicio = paraMinutos(horario);
    const novoFim = novoInicio + duracao;

    return agendamentos.some(a => {
      if (a.data !== data) return false;
      if (a.status === 'cancelado') return false;
      if (a.id === excluirId) return false;

      const existInicio = paraMinutos(a.horario);
      const existFim = existInicio + (a.totalDuracao ?? 30);

      // Sobreposição: novo começa antes do existente terminar E novo termina depois do existente começar
      return novoInicio < existFim && novoFim > existInicio;
    });
  }

  // ── CRUD ──────────────────────────────────────────────────
  function criar(
    dados: Omit<Agendamento, 'id' | 'status' | 'criadoEm'>,
  ): { ok: boolean; erro?: string; data?: Agendamento } {
    const erro = validar(dados);
    if (erro) return { ok: false, erro };

    if (horarioOcupado(dados.data, dados.horario, dados.totalDuracao, undefined)) {
      return { ok: false, erro: `Horário ${dados.horario} já está ocupado. Escolha outro.` };
    }

    const novo: Agendamento = {
      ...dados,
      id: `agt-${nextId++}`,
      status: 'agendado',
      criadoEm: new Date().toISOString(),
    };
    persistir([...agendamentos, novo]);
    return { ok: true, data: novo };
  }

  function editar(
    id: string,
    dados: Omit<Agendamento, 'id' | 'status' | 'criadoEm'>,
  ): { ok: boolean; erro?: string } {
    const erro = validar(dados);
    if (erro) return { ok: false, erro };

    if (horarioOcupado(dados.data, dados.horario, dados.totalDuracao, id)) {
      return { ok: false, erro: `Horário ${dados.horario} já está ocupado. Escolha outro.` };
    }

    const atualizado = agendamentos.map(a => (a.id === id ? { ...a, ...dados } : a));
    persistir(atualizado);
    return { ok: true };
  }

  function cancelar(id: string) {
    persistir(agendamentos.map(a => (a.id === id ? { ...a, status: 'cancelado' as const } : a)));
  }

  function excluir(id: string) {
    persistir(agendamentos.filter(a => a.id !== id));
  }

  function concluir(id: string) {
    persistir(agendamentos.map(a => (a.id === id ? { ...a, status: 'concluido' as const } : a)));
  }

  return {
    agendamentos,
    criar,
    editar,
    cancelar,
    excluir,
    concluir,
    horarioOcupado,
    horariosOcupados,
  };
}
