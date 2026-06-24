import { Servico } from '../types';

function fmtDataBR(data: string): string {
  if (!data) return '';
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
}

export function montarMensagemWhatsApp(a: {
  clienteNome: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  servicos: Servico[];
  totalPreco: number;
  data: string;
  horario: string;
}): string {
  const linhas = [
    'Olá! Gostaria de confirmar meu agendamento.',
    '',
    `📅 Data: ${fmtDataBR(a.data)}`,
    `⏰ Horário: ${a.horario}`,
    `👤 Nome: ${a.clienteNome}`,
  ];

  if (a.clienteEmail) linhas.push(`📧 Email: ${a.clienteEmail}`);
  if (a.clienteTelefone) linhas.push(`📱 Telefone: ${a.clienteTelefone}`);

  if (a.servicos.length === 1) {
    linhas.push(`📝 Serviço: ${a.servicos[0].icone} ${a.servicos[0].nome} — R$ ${a.servicos[0].preco},00`);
  } else {
    linhas.push('📝 Serviços:');
    a.servicos.forEach(s => {
      linhas.push(`   ${s.icone} ${s.nome} — R$ ${s.preco},00`);
    });
  }

  linhas.push(`💰 Total: R$ ${a.totalPreco},00`);
  linhas.push('', 'Aguardo confirmação. Obrigado!');

  return linhas.join('\n');
}

export function abrirWhatsApp(numero: string, mensagem: string): void {
  const numeroLimpo = numero.replace(/\D/g, '');
  const url = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank');
}
