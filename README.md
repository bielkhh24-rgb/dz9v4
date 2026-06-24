# Barbearia DZ9 — Sistema de Agendamento (Premium)

Sistema completo e moderno para uma barbearia, com barbeiro fixo (Rafael) e integração com WhatsApp.

## Como rodar

```
npm install
npm run dev
```

Abre em http://localhost:3000

## O que tem

### Agendamento
- Seleção visual de serviço (cards com ícone, preço e duração)
- Criar, editar, cancelar e excluir agendamentos
- Marcar como concluído
- Lista com busca por nome, filtro por status e por data
- Bloqueio automático de horários já ocupados
- Bloqueio de domingo e datas passadas
- Dados salvos no navegador (localStorage)

### Integração WhatsApp
- Após confirmar um agendamento, aparece o botão **"Confirmar no WhatsApp"**
- Abre o WhatsApp com mensagem pré-formatada com todos os dados
- Número da barbearia configurável na aba Agendamentos (campo "Número do WhatsApp da Barbearia")
- Funciona também na lista, em qualquer agendamento ativo (botão 📲)

### Visual
- Modo escuro / claro (botão no header, persiste a escolha)
- Animações suaves em cards, botões e transições
- Toasts de sucesso/erro/info
- Skeleton loading na lista
- Stats cards (hoje, agendados, faturamento concluído)
- Hero banner com CTA na tela inicial
- Totalmente responsivo (mobile-first)

## Serviços e preços (fixos)

| Serviço | Preço | Duração |
|---|---|---|
| Corte | R$ 35 | 30 min |
| Barba | R$ 25 | 20 min |
| Acabamento | R$ 15 | 15 min |
| Sobrancelha | R$ 15 | 10 min |

## Barbeiro

Sistema fixo para **Rafael** — não há seleção de múltiplos barbeiros, é intencional.

## Estrutura

```
src/
  App.tsx                → interface completa (form + lista + confirmação)
  lib/useAgendamentos.ts → CRUD + validações + persistência
  lib/useToast.ts        → sistema de notificações toast
  lib/useTema.ts         → dark/light mode com persistência
  lib/whatsapp.ts        → geração de mensagem e link wa.me
  data/index.ts          → serviços, horários, nome do barbeiro, whatsapp padrão
  types/index.ts         → tipos TypeScript
  index.css              → design system completo (CSS variables, dark/light)
```

## Configurar WhatsApp padrão

Edite `WHATSAPP_PADRAO` em `src/data/index.ts`, ou configure direto na interface (aba Agendamentos → campo do WhatsApp), que fica salvo no navegador.

## Observação sobre dados

Os agendamentos ficam salvos no `localStorage` do navegador. Se quiser resetar tudo:
```js
localStorage.removeItem('dz9_agendamentos')
localStorage.removeItem('dz9_whatsapp_numero')
localStorage.removeItem('dz9_theme')
```

## Dependências

Nenhuma nova dependência externa foi necessária — tudo construído com React + CSS puro para manter o build 100% estável com Vite.

