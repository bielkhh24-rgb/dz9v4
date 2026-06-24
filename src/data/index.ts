import { Servico } from '../types';

// Barbeiro único e fixo do sistema
export const BARBEIRO_NOME = 'Rafael';

// Serviços com preços definitivos
export const SERVICOS: Servico[] = [
  { id: 'corte',       nome: 'Corte',       preco: 35, duracao: 30, icone: '✂️' },
  { id: 'barba',       nome: 'Barba',       preco: 25, duracao: 20, icone: '🪒' },
  { id: 'acabamento',  nome: 'Acabamento',  preco: 15, duracao: 15, icone: '✨' },
  { id: 'sobrancelha', nome: 'Sobrancelha', preco: 15, duracao: 10, icone: '👁️' },
];

// WhatsApp padrão da barbearia (editável nas configurações)
export const WHATSAPP_PADRAO = '5534999999999';

// Horários de funcionamento: 08:00 às 20:00, intervalos de 30min
export function gerarHorarios(): string[] {
  const lista: string[] = [];
  for (let h = 8; h <= 20; h++) {
    lista.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 20) lista.push(`${String(h).padStart(2, '0')}:30`);
  }
  return lista;
}

export const HORARIOS = gerarHorarios();

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
