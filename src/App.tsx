import React, { useState, useMemo, useEffect } from 'react';
import { useAgendamentos } from './lib/useAgendamentos';
import { useToast } from './lib/useToast';
import { useTema } from './lib/useTema';
import { montarMensagemWhatsApp, abrirWhatsApp } from './lib/whatsapp';
import { SERVICOS, HORARIOS, BARBEIRO_NOME, WHATSAPP_PADRAO } from './data';
import { Agendamento, Servico } from './types';

// ─────────────────────────────────────────────────────────────
//  CONFIGURAÇÃO INTERNA — não exposta na interface
// ─────────────────────────────────────────────────────────────
const SENHA_ADMIN_PADRAO = 'dz9admin';   // senha padrão hardcoded
const LS_SENHA_KEY       = 'dz9_pwd';   // chave para senha personalizada
const SS_ADMIN_KEY       = 'dz9_adm';   // chave de sessão admin
const LS_WPP_KEY         = 'dz9_wpp';  // chave para número WhatsApp

// ─────────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function fmtDataBR(data: string): string {
  if (!data) return '';
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
}

function hojeISO(): string {
  return new Date().toISOString().split('T')[0];
}

function maskTelefone(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 7) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return v;
}

function getSenhaAtual(): string {
  try { return localStorage.getItem(LS_SENHA_KEY) || SENHA_ADMIN_PADRAO; } catch { return SENHA_ADMIN_PADRAO; }
}

// Compatibilidade com schema antigo (servicoId scalar) e novo (servicos[])
function getServicos(a: Agendamento): Servico[] {
  if (a.servicos && a.servicos.length > 0) return a.servicos;
  return [{ id: a.servicoId ?? 'legado', nome: a.servicoNome ?? 'Serviço', preco: a.preco ?? 0, duracao: 30, icone: '✂️' }];
}
function getTotalPreco(a: Agendamento): number { return a.totalPreco ?? a.preco ?? 0; }
function getNomesServicos(a: Agendamento): string { return getServicos(a).map(s => s.nome).join(' + '); }

// ─────────────────────────────────────────────────────────────
//  COMPONENTES REUTILIZÁVEIS
// ─────────────────────────────────────────────────────────────
function ToastContainer({ toasts, remover }: { toasts: { id: number; texto: string; tipo: string }[]; remover: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.tipo}`} onClick={() => remover(t.id)}>
          <span>{t.tipo === 'success' ? '✓' : t.tipo === 'error' ? '✕' : 'ℹ'}</span>
          <span>{t.texto}</span>
        </div>
      ))}
    </div>
  );
}

function SkeletonLista() {
  return (
    <>
      <div className="skeleton skel-item" />
      <div className="skeleton skel-item" />
      <div className="skeleton skel-item" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  FORMULÁRIO DE AGENDAMENTO (público — usado em ambas as views)
// ─────────────────────────────────────────────────────────────
interface FormAgendamentoProps {
  editId: string | null;
  onSalvo: (agendamento: Agendamento | null, foiEdicao: boolean) => void;
  onCancelarEdicao: () => void;
  agendamentos: Agendamento[];
  criar: (d: any) => any;
  editar: (id: string, d: any) => any;
  horariosOcupados: (data: string, excluirId?: string) => string[];
  toast: (msg: string, tipo?: any) => void;
  dadosEdicao?: {
    nome: string; telefone: string; email: string;
    servicoIds: string[]; data: string; horario: string; obs: string;
  } | null;
}

function FormAgendamento({ editId, onSalvo, onCancelarEdicao, criar, editar, horariosOcupados, toast, dadosEdicao }: FormAgendamentoProps) {
  const [nome, setNome]         = useState(dadosEdicao?.nome ?? '');
  const [telefone, setTelefone] = useState(dadosEdicao?.telefone ?? '');
  const [email, setEmail]       = useState(dadosEdicao?.email ?? '');
  const [servicoIds, setServicoIds] = useState<string[]>(dadosEdicao?.servicoIds ?? []);
  const [data, setData]         = useState(dadosEdicao?.data ?? '');
  const [horario, setHorario]   = useState(dadosEdicao?.horario ?? '');
  const [obs, setObs]           = useState(dadosEdicao?.obs ?? '');
  const [erro, setErro]         = useState('');

  const servicosSelecionados = useMemo(() => SERVICOS.filter(s => servicoIds.includes(s.id)), [servicoIds]);
  const totalDuracao = useMemo(() => servicosSelecionados.reduce((acc, s) => acc + s.duracao, 0), [servicosSelecionados]);
  const totalPreco   = useMemo(() => servicosSelecionados.reduce((acc, s) => acc + s.preco, 0),  [servicosSelecionados]);
  const ocupados     = useMemo(() => data ? horariosOcupados(data, editId ?? undefined) : [], [data, editId, horariosOcupados]);

  function toggleServico(id: string) {
    setServicoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setHorario('');
  }

  function handleSalvar() {
    setErro('');
    if (servicosSelecionados.length === 0) { const msg = 'Selecione ao menos um serviço.'; setErro(msg); toast(msg, 'error'); return; }

    const payload = {
      clienteNome: nome.trim(), clienteTelefone: telefone, clienteEmail: email.trim(),
      servicos: servicosSelecionados, totalPreco, totalDuracao, data, horario, obs,
    };

    const resultado = editId ? editar(editId, payload) : criar(payload);
    if (!resultado.ok) { setErro(resultado.erro ?? 'Erro ao salvar.'); toast(resultado.erro ?? 'Erro ao salvar', 'error'); return; }

    if (editId) {
      toast('Agendamento atualizado!', 'success');
      onSalvo(null, true);
    } else {
      toast('Agendamento confirmado!', 'success');
      onSalvo(resultado.data ?? { ...payload, id: '', status: 'agendado', criadoEm: '' }, false);
    }
  }

  return (
    <div className="card">
      <h2>{editId ? '✏️ Editar Agendamento' : '✂️ Novo Agendamento'}</h2>
      {erro && <div className="alert alert-error">⚠ {erro}</div>}

      {/* Serviços (multi-select) */}
      <div className="field">
        <label>
          Serviços *
          {servicosSelecionados.length > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--text-faint)', marginLeft: 8 }}>
              {servicosSelecionados.length} selecionado{servicosSelecionados.length > 1 ? 's' : ''}
            </span>
          )}
        </label>
        <div className="servicos-grid">
          {SERVICOS.map(s => {
            const sel = servicoIds.includes(s.id);
            return (
              <div key={s.id} className={`servico-card ${sel ? 'selected' : ''}`}
                onClick={() => toggleServico(s.id)} role="checkbox" aria-checked={sel}>
                {sel && <div className="servico-check">✓</div>}
                <div className="ic">{s.icone}</div>
                <div className="nome">{s.nome}</div>
                <div className="preco">R${s.preco}</div>
                <div className="duracao">{s.duracao} min</div>
              </div>
            );
          })}
        </div>
        {servicosSelecionados.length > 0 && (
          <div className="servicos-resumo">
            <span>⏱ {totalDuracao} min</span>
            <span className="sep">·</span>
            <span>💰 R$ {totalPreco},00</span>
          </div>
        )}
      </div>

      <div className="field">
        <label>Nome *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João Silva" />
      </div>

      <div className="row2">
        <div className="field">
          <label>Telefone</label>
          <input value={telefone} onChange={e => setTelefone(maskTelefone(e.target.value))} placeholder="(34) 99999-9999" />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
        </div>
      </div>

      <div className="row2">
        <div className="field">
          <label>Data *</label>
          <input type="date" value={data} min={hojeISO()} onChange={e => { setData(e.target.value); setHorario(''); }} />
        </div>
        <div className="field">
          <label>Barbeiro</label>
          <input value={BARBEIRO_NOME} disabled />
        </div>
      </div>

      {data && (
        <div className="field">
          <label>
            Horário *
            {totalDuracao > 0 && <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 6 }}>(duração: {totalDuracao} min)</span>}
            {ocupados.length > 0 && <span style={{ color: 'var(--text-faint)', fontWeight: 400, marginLeft: 6 }}>· {ocupados.length} ocupado{ocupados.length > 1 ? 's' : ''}</span>}
          </label>
          <div className="horarios-grid">
            {HORARIOS.map(h => {
              const ocupado = ocupados.includes(h);
              return (
                <button key={h} type="button" disabled={ocupado}
                  className={`horario-btn ${horario === h ? 'selected' : ''}`}
                  onClick={() => setHorario(h)}>{h}</button>
              );
            })}
          </div>
        </div>
      )}

      <div className="field">
        <label>Observações</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Detalhes do corte, preferências..." />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button className="btn btn-primary" onClick={handleSalvar}>
          {editId ? '✓ Salvar Alterações' : '✓ Confirmar Agendamento'}
        </button>
        {editId && <button className="btn btn-secondary" onClick={onCancelarEdicao}>Cancelar</button>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  TELA DE CONFIRMAÇÃO PÓS-AGENDAMENTO
// ─────────────────────────────────────────────────────────────
function TelaConfirmacao({ agendamento, whatsappNumero, onNovo, onVerLista, toast }: {
  agendamento: Agendamento; whatsappNumero: string;
  onNovo: () => void; onVerLista: () => void;
  toast: (msg: string, tipo?: any) => void;
}) {
  function abrirWpp() {
    const msg = montarMensagemWhatsApp({
      clienteNome: agendamento.clienteNome, clienteEmail: agendamento.clienteEmail,
      clienteTelefone: agendamento.clienteTelefone, servicos: getServicos(agendamento),
      totalPreco: getTotalPreco(agendamento), data: agendamento.data, horario: agendamento.horario,
    });
    abrirWhatsApp(whatsappNumero, msg);
    toast('Abrindo WhatsApp...', 'info');
  }

  return (
    <div className="card">
      <div className="success-screen">
        <div className="success-icon">✓</div>
        <h3>Agendamento Confirmado!</h3>
        <p className="desc">Envie os detalhes para a barbearia confirmar pelo WhatsApp.</p>
        <div className="resumo-box">
          <div className="resumo-row"><span className="k">👤 Cliente</span><span className="v">{agendamento.clienteNome}</span></div>
          <div className="resumo-row">
            <span className="k">✂️ Serviço{getServicos(agendamento).length > 1 ? 's' : ''}</span>
            <span className="v">{getNomesServicos(agendamento)}</span>
          </div>
          <div className="resumo-row"><span className="k">📅 Data</span><span className="v">{fmtDataBR(agendamento.data)}</span></div>
          <div className="resumo-row"><span className="k">⏰ Horário</span><span className="v">{agendamento.horario}</span></div>
          <div className="resumo-row"><span className="k">⏱ Duração</span><span className="v">{agendamento.totalDuracao} min</span></div>
          <div className="resumo-row"><span className="k">💈 Barbeiro</span><span className="v">{BARBEIRO_NOME}</span></div>
          <div className="resumo-row"><span className="k">💰 Total</span><span className="v">R$ {getTotalPreco(agendamento)},00</span></div>
        </div>
        <div className="acoes-confirmacao">
          <button className="btn btn-whatsapp" onClick={abrirWpp}>📲 Confirmar no WhatsApp</button>
          <button className="btn btn-secondary" onClick={onNovo}>+ Novo Agendamento</button>
          <button className="btn btn-secondary" onClick={onVerLista}>📋 Ver Agendamentos</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  VIEW CLIENTE (pública — sem login)
// ─────────────────────────────────────────────────────────────
interface ViewClienteProps {
  agendamentos: Agendamento[];
  criar: (d: any) => any;
  horariosOcupados: (data: string, excluirId?: string) => string[];
  whatsappNumero: string;
  toast: (msg: string, tipo?: any) => void;
  tema: string; alternar: () => void;
  onIrAdmin: () => void;
}

function ViewCliente({ agendamentos, criar, horariosOcupados, whatsappNumero, toast, tema, alternar, onIrAdmin }: ViewClienteProps) {
  const [aba, setAba] = useState<'novo' | 'lista'>('novo');
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState<Agendamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroData, setFiltroData] = useState('');

  useEffect(() => { const t = setTimeout(() => setCarregando(false), 350); return () => clearTimeout(t); }, []);

  const totalHoje = agendamentos.filter(a => a.data === hojeISO() && a.status !== 'cancelado').length;
  const totalAtivos = agendamentos.filter(a => a.status !== 'cancelado').length;

  const listaFiltrada = agendamentos
    .filter(a => a.status !== 'cancelado')
    .filter(a => !busca || a.clienteNome.toLowerCase().includes(busca.toLowerCase()))
    .filter(a => !filtroData || a.data === filtroData)
    .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));

  function handleConfirmarWpp(a: Agendamento) {
    const msg = montarMensagemWhatsApp({
      clienteNome: a.clienteNome, clienteEmail: a.clienteEmail, clienteTelefone: a.clienteTelefone,
      servicos: getServicos(a), totalPreco: getTotalPreco(a), data: a.data, horario: a.horario,
    });
    abrirWhatsApp(whatsappNumero, msg);
    toast('Abrindo WhatsApp...', 'info');
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <img src="/logo.png" alt="DZ9" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="header-info">
          <h1>Barbearia DZ9</h1>
          <div className="sub"><span className="dot" />Barbeiro: {BARBEIRO_NOME} · Online agora</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn-owner" onClick={onIrAdmin} title="Área administrativa">🔐</button>
          <button className="theme-toggle" onClick={alternar} title="Alternar tema" aria-label="Tema">
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Hero — só na aba novo, sem confirmação ativa */}
      {aba === 'novo' && !agendamentoConfirmado && (
        <div className="hero">
          <h2>Agende seu horário em 30 segundos ⚡</h2>
          <p>Escolha os serviços, a data e o horário ideal. Confirmação rápida direto pelo WhatsApp.</p>
        </div>
      )}

      {/* Stats públicas — sem faturamento */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="icon">📅</div>
          <div className="num">{totalHoje}</div>
          <div className="label">Hoje</div>
        </div>
        <div className="stat-box">
          <div className="icon">📋</div>
          <div className="num">{totalAtivos}</div>
          <div className="label">Agendamentos</div>
        </div>
        <div className="stat-box">
          <div className="icon">💈</div>
          <div className="num">{BARBEIRO_NOME}</div>
          <div className="label">Barbeiro</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${aba === 'novo' ? 'active' : ''}`}
          onClick={() => { setAba('novo'); setAgendamentoConfirmado(null); }}>
          + Novo Agendamento
        </button>
        <button className={`tab ${aba === 'lista' ? 'active' : ''}`}
          onClick={() => setAba('lista')}>
          📋 Horários ({totalAtivos})
        </button>
      </div>

      {/* Aba: Novo agendamento */}
      {aba === 'novo' && !agendamentoConfirmado && (
        <FormAgendamento
          editId={null}
          onSalvo={(ag, _) => { setAgendamentoConfirmado(ag); }}
          onCancelarEdicao={() => {}}
          agendamentos={[]}
          criar={criar}
          editar={() => ({ ok: false })}
          horariosOcupados={horariosOcupados}
          toast={toast}
        />
      )}

      {/* Confirmação */}
      {aba === 'novo' && agendamentoConfirmado && (
        <TelaConfirmacao
          agendamento={agendamentoConfirmado}
          whatsappNumero={whatsappNumero}
          onNovo={() => setAgendamentoConfirmado(null)}
          onVerLista={() => { setAgendamentoConfirmado(null); setAba('lista'); }}
          toast={toast}
        />
      )}

      {/* Aba: Lista pública (leitura) */}
      {aba === 'lista' && (
        <div className="card">
          <h2>📋 Horários Agendados</h2>
          <div className="filtros">
            <input placeholder="🔍 Buscar nome..." value={busca} onChange={e => setBusca(e.target.value)} />
            <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
          </div>
          {carregando ? <SkeletonLista /> : listaFiltrada.length === 0 ? (
            <div className="empty"><div className="ic">📭</div><div className="txt">Nenhum agendamento encontrado.</div></div>
          ) : (
            listaFiltrada.map(a => (
              <div key={a.id} className={`agendamento-item ${a.status}`}>
                <div className="agendamento-info">
                  <div className="agendamento-nome">
                    {a.clienteNome}
                    <span className={`badge badge-${a.status}`}>
                      {a.status === 'agendado' ? 'Agendado' : 'Concluído'}
                    </span>
                  </div>
                  <div className="agendamento-meta">
                    {fmtDataBR(a.data)} às {a.horario} · {getNomesServicos(a)} · {BARBEIRO_NOME}
                  </div>
                </div>
                <div className="agendamento-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => handleConfirmarWpp(a)} title="WhatsApp">📲</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="footer-note">Barbearia DZ9 © {new Date().getFullYear()} · Sistema de agendamento</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  LOGIN ADMIN
// ─────────────────────────────────────────────────────────────
function TelaLoginAdmin({ onLogin, onVoltar }: { onLogin: () => void; onVoltar: () => void }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro]   = useState('');

  function tentar() {
    if (senha === getSenhaAtual()) {
      sessionStorage.setItem(SS_ADMIN_KEY, '1');
      onLogin();
    } else {
      setErro('Senha incorreta.');
      setSenha('');
    }
  }

  return (
    <div className="app">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="modal-box" style={{ maxWidth: 360, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>Área Administrativa</h3>
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 4 }}>Barbearia DZ9</p>
          </div>
          {erro && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠ {erro}</div>}
          <div className="field">
            <label>Senha</label>
            <input
              type="password" value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && tentar()}
              placeholder="••••••••" autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={tentar}>Entrar</button>
            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={onVoltar}>← Voltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  VIEW ADMIN (protegida)
// ─────────────────────────────────────────────────────────────
interface ViewAdminProps {
  agendamentos: Agendamento[];
  criar: (d: any) => any;
  editar: (id: string, d: any) => any;
  cancelar: (id: string) => void;
  excluir: (id: string) => void;
  concluir: (id: string) => void;
  horariosOcupados: (data: string, excluirId?: string) => string[];
  whatsappNumero: string;
  salvarWhatsapp: (n: string) => void;
  toast: (msg: string, tipo?: any) => void;
  tema: string; alternar: () => void;
  onLogout: () => void;
  onVoltarSite: () => void;
}

function ViewAdmin(props: ViewAdminProps) {
  const { agendamentos, cancelar, excluir, concluir, whatsappNumero, salvarWhatsapp, toast, tema, alternar, onLogout, onVoltarSite } = props;
  const [aba, setAba]       = useState<'agendamentos' | 'novo' | 'config'>('agendamentos');
  const [editId, setEditId] = useState<string | null>(null);
  const [dadosEdicao, setDadosEdicao] = useState<any>(null);
  const [carregando, setCarregando]   = useState(true);

  // Filtros
  const [busca, setBusca]             = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroData, setFiltroData]   = useState('');

  // Config
  const [editandoWpp, setEditandoWpp]     = useState(false);
  const [wppTemp, setWppTemp]             = useState(whatsappNumero);
  const [novaSenha, setNovaSenha]         = useState('');
  const [novaSenhaConfirm, setNovaSenhaConfirm] = useState('');

  useEffect(() => { const t = setTimeout(() => setCarregando(false), 350); return () => clearTimeout(t); }, []);

  const totalHoje     = agendamentos.filter(a => a.data === hojeISO() && a.status !== 'cancelado').length;
  const totalAtivos   = agendamentos.filter(a => a.status !== 'cancelado').length;
  const totalConcluidos = agendamentos.filter(a => a.status === 'concluido').length;
  const faturamento   = agendamentos.filter(a => a.status === 'concluido').reduce((s, a) => s + getTotalPreco(a), 0);

  const listaFiltrada = agendamentos
    .filter(a => !busca || a.clienteNome.toLowerCase().includes(busca.toLowerCase()))
    .filter(a => !filtroStatus || a.status === filtroStatus)
    .filter(a => !filtroData || a.data === filtroData)
    .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));

  function iniciarEdicao(a: Agendamento) {
    setEditId(a.id);
    setDadosEdicao({
      nome: a.clienteNome, telefone: a.clienteTelefone, email: a.clienteEmail || '',
      servicoIds: getServicos(a).map(s => s.id), data: a.data, horario: a.horario, obs: a.obs,
    });
    setAba('novo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelar(id: string) {
    if (window.confirm('Cancelar este agendamento? O horário será liberado.')) {
      cancelar(id); toast('Agendamento cancelado', 'info');
    }
  }

  function handleExcluir(id: string) {
    if (window.confirm('Excluir definitivamente este agendamento?')) {
      excluir(id); toast('Agendamento excluído', 'info');
    }
  }

  function handleConcluir(id: string) {
    concluir(id); toast('Marcado como concluído', 'success');
  }

  function handleConfirmarWpp(a: Agendamento) {
    const msg = montarMensagemWhatsApp({
      clienteNome: a.clienteNome, clienteEmail: a.clienteEmail, clienteTelefone: a.clienteTelefone,
      servicos: getServicos(a), totalPreco: getTotalPreco(a), data: a.data, horario: a.horario,
    });
    abrirWhatsApp(whatsappNumero, msg);
    toast('Abrindo WhatsApp...', 'info');
  }

  function handleAlterarSenha() {
    if (!novaSenha || novaSenha.length < 4) { toast('Senha deve ter ao menos 4 caracteres', 'error'); return; }
    if (novaSenha !== novaSenhaConfirm) { toast('As senhas não coincidem', 'error'); return; }
    try { localStorage.setItem(LS_SENHA_KEY, novaSenha); } catch {}
    setNovaSenha(''); setNovaSenhaConfirm('');
    toast('Senha alterada com sucesso!', 'success');
  }

  function limparEdicao() {
    setEditId(null); setDadosEdicao(null); setAba('agendamentos');
  }

  return (
    <div className="app">
      {/* Header Admin */}
      <div className="header">
        <img src="/logo.png" alt="DZ9" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="header-info">
          <h1>Barbearia DZ9</h1>
          <div className="sub">
            <span style={{ background: 'var(--primary-glow)', color: 'var(--primary-light)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              🔓 ADMIN
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn-owner" onClick={onVoltarSite} title="Voltar ao site">← Site</button>
          <button className="btn-owner active" onClick={onLogout} title="Sair">Sair</button>
          <button className="theme-toggle" onClick={alternar} title="Tema" aria-label="Tema">
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Stats Admin — com faturamento */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-box">
          <div className="icon">📅</div>
          <div className="num">{totalHoje}</div>
          <div className="label">Hoje</div>
        </div>
        <div className="stat-box">
          <div className="icon">📋</div>
          <div className="num">{totalAtivos}</div>
          <div className="label">Ativos</div>
        </div>
        <div className="stat-box">
          <div className="icon">✅</div>
          <div className="num">{totalConcluidos}</div>
          <div className="label">Concluídos</div>
        </div>
        <div className="stat-box">
          <div className="icon">💰</div>
          <div className="num">R${faturamento}</div>
          <div className="label">Faturado</div>
        </div>
      </div>

      {/* Tabs Admin */}
      <div className="tabs">
        <button className={`tab ${aba === 'agendamentos' ? 'active' : ''}`}
          onClick={() => { setAba('agendamentos'); limparEdicao(); }}>
          📋 Agendamentos ({agendamentos.length})
        </button>
        <button className={`tab ${aba === 'novo' ? 'active' : ''}`}
          onClick={() => { setAba('novo'); if (!editId) { setEditId(null); setDadosEdicao(null); } }}>
          {editId ? '✏️ Editando' : '+ Novo'}
        </button>
        <button className={`tab ${aba === 'config' ? 'active' : ''}`}
          onClick={() => setAba('config')}>
          ⚙️ Config
        </button>
      </div>

      {/* Aba: Agendamentos (gerenciamento completo) */}
      {aba === 'agendamentos' && (
        <div className="card">
          <h2>📋 Gerenciar Agendamentos</h2>
          <div className="filtros">
            <input placeholder="🔍 Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="agendado">Agendado</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} />
          </div>

          {carregando ? <SkeletonLista /> : listaFiltrada.length === 0 ? (
            <div className="empty"><div className="ic">📭</div><div className="txt">Nenhum agendamento encontrado.</div></div>
          ) : (
            listaFiltrada.map(a => (
              <div key={a.id} className={`agendamento-item ${a.status}`}>
                <div className="agendamento-info">
                  <div className="agendamento-nome">
                    {a.clienteNome}
                    <span className={`badge badge-${a.status}`}>
                      {a.status === 'agendado' ? 'Agendado' : a.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                    </span>
                  </div>
                  <div className="agendamento-meta">
                    {fmtDataBR(a.data)} às {a.horario} · {getNomesServicos(a)} · {BARBEIRO_NOME}
                    {a.clienteTelefone && ` · ${a.clienteTelefone}`}
                  </div>
                  <div className="agendamento-preco">R$ {getTotalPreco(a)},00</div>
                </div>
                <div className="agendamento-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => handleConfirmarWpp(a)} title="WhatsApp">📲</button>
                  {a.status === 'agendado' && (
                    <>
                      <button className="btn btn-sm btn-secondary" onClick={() => iniciarEdicao(a)} title="Editar">✏️</button>
                      <button className="btn btn-sm btn-success"   onClick={() => handleConcluir(a.id)} title="Concluir">✓</button>
                      <button className="btn btn-sm btn-danger"    onClick={() => handleCancelar(a.id)} title="Cancelar">✕</button>
                    </>
                  )}
                  {a.status !== 'agendado' && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleExcluir(a.id)} title="Excluir">🗑️</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Aba: Novo / Editar */}
      {aba === 'novo' && (
        <FormAgendamento
          key={editId ?? 'novo'}
          editId={editId}
          dadosEdicao={dadosEdicao}
          onSalvo={(_, foiEdicao) => { limparEdicao(); }}
          onCancelarEdicao={limparEdicao}
          agendamentos={agendamentos}
          criar={props.criar}
          editar={props.editar}
          horariosOcupados={props.horariosOcupados}
          toast={toast}
        />
      )}

      {/* Aba: Configurações */}
      {aba === 'config' && (
        <div className="card">
          <h2>⚙️ Configurações</h2>

          <div className="config-box" style={{ marginBottom: 16 }}>
            <div className="title">📱 WhatsApp da Barbearia</div>
            {editandoWpp ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={wppTemp} onChange={e => setWppTemp(e.target.value.replace(/\D/g, ''))}
                  placeholder="5534999999999" style={{ flex: 1 }} />
                <button className="btn btn-sm btn-primary" style={{ width: 'auto' }}
                  onClick={() => { salvarWhatsapp(wppTemp); setEditandoWpp(false); toast('Número salvo!', 'success'); }}>
                  Salvar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>+{whatsappNumero}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => { setWppTemp(whatsappNumero); setEditandoWpp(true); }}>Editar</button>
              </div>
            )}
          </div>

          <div className="config-box">
            <div className="title">🔑 Alterar Senha do Admin</div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Nova senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 4 caracteres" />
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Confirmar senha</label>
              <input type="password" value={novaSenhaConfirm} onChange={e => setNovaSenhaConfirm(e.target.value)} placeholder="Repita a nova senha" />
            </div>
            <button className="btn btn-primary" onClick={handleAlterarSenha}>Salvar nova senha</button>
          </div>
        </div>
      )}

      <div className="footer-note">Barbearia DZ9 © {new Date().getFullYear()} · Área Administrativa</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  APP ROOT — orquestra as views
// ─────────────────────────────────────────────────────────────
export default function App() {
  const { agendamentos, criar, editar, cancelar, excluir, concluir, horariosOcupados } = useAgendamentos();
  const { toasts, toast, remover } = useToast();
  const { tema, alternar } = useTema();

  // 'cliente' | 'login' | 'admin'
  const [view, setView] = useState<'cliente' | 'login' | 'admin'>(() => {
    return sessionStorage.getItem(SS_ADMIN_KEY) === '1' ? 'admin' : 'cliente';
  });

  const [whatsappNumero, setWhatsappNumero] = useState(() => {
    try { return localStorage.getItem(LS_WPP_KEY) || WHATSAPP_PADRAO; } catch { return WHATSAPP_PADRAO; }
  });

  function salvarWhatsapp(numero: string) {
    setWhatsappNumero(numero);
    try { localStorage.setItem(LS_WPP_KEY, numero); } catch {}
  }

  function handleLoginOk() {
    setView('admin');
  }

  function handleLogout() {
    sessionStorage.removeItem(SS_ADMIN_KEY);
    setView('cliente');
    toast('Sessão encerrada', 'info');
  }

  const commonProps = { agendamentos, horariosOcupados, whatsappNumero, toast, tema, alternar };

  return (
    <>
      <ToastContainer toasts={toasts} remover={remover} />

      {view === 'cliente' && (
        <ViewCliente
          {...commonProps}
          criar={criar}
          onIrAdmin={() => setView('login')}
        />
      )}

      {view === 'login' && (
        <TelaLoginAdmin
          onLogin={handleLoginOk}
          onVoltar={() => setView('cliente')}
        />
      )}

      {view === 'admin' && (
        <ViewAdmin
          {...commonProps}
          criar={criar}
          editar={editar}
          cancelar={cancelar}
          excluir={excluir}
          concluir={concluir}
          salvarWhatsapp={salvarWhatsapp}
          onLogout={handleLogout}
          onVoltarSite={() => setView('cliente')}
        />
      )}
    </>
  );
}
