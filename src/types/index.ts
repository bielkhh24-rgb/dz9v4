export type StatusAgendamento = 'agendado' | 'concluido' | 'cancelado';

export interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao: number; // minutos
  icone: string;
}

export interface Agendamento {
  id: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail: string;

  // ── Multi-serviço (novo schema) ──────────────────────────
  servicos: Servico[];       // array de serviços selecionados
  totalPreco: number;        // soma de preco de cada serviço
  totalDuracao: number;      // soma de duracao de cada serviço (minutos)

  // ── Legado (schema antigo — mantido para compatibilidade) ─
  servicoId?: string;
  servicoNome?: string;
  preco?: number;

  data: string;    // YYYY-MM-DD
  horario: string; // HH:MM
  status: StatusAgendamento;
  obs: string;
  criadoEm: string;
}

export interface ConfigEmpresa {
  whatsappNumero: string; // só dígitos, com DDI: 5534999999999
}
