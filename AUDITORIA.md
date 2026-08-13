# Auditoria da Plataforma — DF AGRO

Auditoria completa do painel de gestão (`index.html`, `sw.js`, backend Supabase),
realizada em **13/08/2026**. Quatro frentes de análise — **Dados**, **Cálculos**,
**Segurança** e **Banco** — com cada achado crítico verificado diretamente no
código-fonte e no banco. Todas as correções foram implementadas em fases,
testadas (Playwright headless) e publicadas.

## Panorama

**21 achados** — 3 críticos, 5 altos, 8 médios, 5 baixos. A fundação da
plataforma é sólida: isolamento por usuário (RLS) e controle de acesso (RBAC)
são reais e aplicados no banco, resistindo a manipulação pelo console. Os
problemas graves estavam concentrados onde **dado externo entra** (importar
planilha), **dado confidencial sai** (base de clientes no código) e onde **uma
tela quebrava o painel inteiro** (cálculo sem proteção).

| Severidade | Qtd | Situação |
| ---------- | --- | -------- |
| Crítico | 3 | ✅ corrigido |
| Alto | 5 | ✅ corrigido |
| Médio | 8 | ✅ corrigido |
| Baixo | 5 | ✅ 2 corrigidos · 3 dependem de painel/hospedagem |

---

## Correções por fase

### Fase 0 — Estancar perda e vazamento de dados (`8e5d1ac`)

- **S‑1 · Base real de clientes exposta no código (crítico).** O
  `<script id="seed">` continha a base real (nomes, receitas, comissões),
  legível **sem login** por qualquer visitante. O seed foi esvaziado; os dados
  reais vivem na nuvem (`painel_estado`) e voltam via `cloudLoad` após o login.
- **D‑1 · Importar planilha apagava o módulo de custos (crítico).** `parseWB`
  reconstruía o estado do zero e `loadFile` trocava sem confirmação, apagando
  lançamentos, recorrências, centros de custo, veículos, orçamentos, funil e a
  carteira de clientes. Adicionada a função `mergeImport()` (preserva os
  cadastros manuais) e uma **confirmação explícita** antes de trocar o estado.
- **C‑1 · Uma tela sem dados derrubava o painel inteiro (crítico).** `hydrate`
  passou a inicializar os contêineres de análise; `renderServ` foi blindado; e
  `renderAll` isola cada seção em `try/catch` — uma tela com falha não deixa
  mais o dashboard em branco.

### Fase 1 — Endurecimento contra XSS + logout (`a2bac3d`)

- **S‑3 · `esc()` incompleto (alto).** Passou a escapar os 5 caracteres
  perigosos (`& < > " '`), fechando a quebra de atributo com aspas simples.
- **S‑2 · XSS via importação de planilha (alto).** Nomes de cliente/serviço
  vindos do cross‑sell agora são escapados antes de renderizar.
- **S‑4 · ~10 telas de análise sem escape (médio).** `esc()` aplicado em todos
  os pontos que inseriam nomes crus (heatmap, rankings, grupos, bônus, etc.).
- **S‑5 · Logout não limpava o aparelho (médio).** `doLogout` apaga o
  `localStorage` e zera o estado em memória — sem vazamento entre usuários em
  aparelhos compartilhados.

### Fase 2 — Integridade de dados (`cac5ac6`)

- **D‑2 · "Restaurar versão" não fazia backup (alto).** `restaurarVersao` grava
  o estado atual no `painel_historico` **antes** de sobrescrever.
- **D‑3 · Reconexão sobrescrevia a nuvem (alto).** O handler `online` confere o
  `atualizado_em` da nuvem antes de enviar; havendo conflito com outro
  dispositivo, pergunta ao usuário em vez de sobrescrever.
- **D‑4 · `cloudLoad` podia descartar edições offline (médio).** Passou a
  rastrear edições pendentes (`_pend`) e pergunta antes de baixar a nuvem.
- **D‑5 · Falha de armazenamento cheio era engolida (médio).** `saveLocal`
  detecta `QuotaExceeded` e avisa o usuário.

### Fase 3 — Cálculos alinhados às regras de negócio (`ee7b152`)

Regras confirmadas pelo dono:

1. **Comissão incide sobre a RECEITA BRUTA** da venda (custos não descontados).
2. **Ponto de equilíbrio desconta imposto e comissão** da contribuição/ha.
3. **Margem operacional usa `projGastos`** como fonte única de custo.

- **C‑2 · Bases de comissão inconsistentes (alto).** Nova função única
  `comissaoSobre(receita)`; funil e carteira deixam de descontar custos antes da
  taxa. Empresa, funil, carteira e segmentos passam a conciliar.
- **C‑3 · Break‑even superestimava a contribuição/ha (médio).** `contribHa`
  passa a descontar imposto e comissão (na base de teste, de 76,20 para
  51,00/ha, ~33% menor — a contribuição real).
- **C‑4 · Margem operacional misturava fontes (médio).** `custoNaoOper` é
  reescalado para a mesma base do total abatido (`projGastos`).
- **C‑5 · Divisão por zero com carteira vazia (baixo).** `renderCli` protegido
  contra 0 clientes (sem `NaN`).

### Fase 4 — Higiene de acesso + RLS otimizada (`ed602cf`)

- **S‑6 · Perfil "leitor" bloqueado de fato (médio).** Um listener em captura
  impede a edição dos campos `.edinp` em modo somente‑leitura (à prova de
  re‑render). A nuvem já barrava por RLS; isto remove a edição local silenciosa.
- **S‑8 · Cadastro não revela mais se o e‑mail já existe (baixo).** Mensagem
  genérica no signup, evitando enumeração de usuários.
- **B‑2 · Políticas RLS otimizadas (baixo, no banco).** Migração
  `rls_initplan_optimize` envolve `auth.uid()` e as funções `SECURITY DEFINER`
  em `(select ...)` nas 25 políticas — avaliação única por consulta. O advisor
  confirmou a eliminação dos ~24 avisos de `auth_rls_initplan`.

---

## O que já estava sólido (não alterado)

- **RBAC real no banco:** admin e edição exigidos pela RLS
  (`is_admin`/`pode_editar`); auto‑promoção pelo console é bloqueada.
- **Isolamento por usuário:** todas as tabelas com Row Level Security.
- **Integridade das bibliotecas:** SRI completo + versões fixadas nos CDNs.
- **Dados ao vivo fora do cache:** o service worker nunca cacheia o Supabase.
- **Ciclo de vida dos gráficos** sem vazamento; `MutationObserver` sem loop.
- **Contas de custo corretas:** cascata da DRE, imposto, conservação do custo
  por hectare e faixas de comissão conferem; migração de custos é idempotente.

---

## Pendências fora do código (ação manual)

Não automatizáveis — dependem do painel do Supabase ou da hospedagem:

1. **B‑1 · Proteção de senha vazada** — Supabase → Authentication → Policies →
   ativar **"Leaked Password Protection"** (recusa senhas já vazadas).
2. **S‑9 · Anti‑clickjacking robusto** — servir o header HTTP
   `frame-ancestors 'none'` no host (não é possível via `<meta>`; indisponível
   no GitHub Pages). Hoje há um frame‑buster em JS como proteção.
3. **S‑7 · CSP sem `unsafe-inline`** (esforço grande, opcional) — exigiria mover
   todo o JS inline para arquivo externo. Risco mitigado: os XSS já foram
   fechados na Fase 1.

---

## Como validar

Cada fase foi coberta por testes automatizados com Playwright (Chromium
headless, com stub do Chart.js): estado‑vazio renderiza limpo, `mergeImport`
preserva cadastros, payloads de XSS são neutralizados, o backup de restauração é
criado, a reconexão detecta conflito, as fórmulas de comissão/break‑even batem
com as regras de negócio, e o perfil leitor é bloqueado. Todas as fases passaram
sem regressão nas anteriores.
