# 05 — Auditoria Mobile

Regra: mobile **não** é "desktop reduzido". Avaliado em 320/360/375/390/393/412/
430px e 768/820px (tablet). Base técnica confirmada: **0 overflow horizontal, 0
vazamento entre telas, 0 erro JS** em toda a varredura (ver
`docs/config/02-VARREDURA-LAYOUT.md`).

## O que já está bem (preservar)
- **Sidebar → drawer**: overlay com blur, fecha ao navegar, Esc e clique fora;
  trava o scroll de fundo. Botão ☰ no header. Bem implementado.
- **Tabelas → cards** (`resp-cards`, <767px): thead some, cada célula vira
  "rótulo: valor" — inclui a tabela de Despesas, membros, histórico, IA.
- **Rede de segurança `wrapTables()`**: envolve qualquer tabela sem wrapper em
  scroll — nenhuma tabela vaza a página.
- **Alvos de toque de 44px** nos controles principais (pílulas, segmentos,
  `.edbtn`, `.toggle`, inputs de card 46px, "Adicionar linha" 48px).
- **Nenhuma ação depende só de hover** — tudo tocável.
- **Gráficos: 1 por linha** no celular, altura fluida (`clamp`).
- Editores viram **card-formulário** (uma coluna, input full-width).

## Problemas por severidade

### 🔴 UX-P1 — Campos de dinheiro sem teclado numérico no celular
Os campos **R$ da área financeira/Despesas** são `type=text` **sem `inputmode`**
→ abrem **teclado alfabético** no celular. Afeta: "Valor (R$)" da despesa,
"Valor/mês" da recorrência, "Meta de gasto", "Valor total cobrado" (lab), e os
campos R$/% do editor de Metas.
**Inconsistência:** os editores **em tabela** (`edTable`) acertam com
`inputmode="decimal"`. Ou seja, o mesmo tipo de dado tem teclado certo num lugar
e errado no outro. É o atrito mobile mais sentido no uso diário.

### 🟡 UX-P2 — Indicador de "salvo" some no drill-in de Lançamentos
No celular, ao abrir uma seção (`.sec-open`), a barra `.edbar` (que mostra "●
Tudo salvo") é **escondida** para dar foco. Auto-save continua funcionando, mas
o usuário **perde o feedback** de que salvou — insegurança em formulário longo.

### 🟡 UX-P2 — "Despesas" no celular abre 5 cards empilhados
Tocar em **Despesas** no drill-in mostra Despesas + Recorrências + Veículos +
Orçamentos + Matriz de custo empilhados (rolagem longa). Quem quer só **lançar
uma despesa** rola bastante antes/depois do formulário.

### 🟡 UX-P2 — Tabelas operacionais densas rolam de lado no celular
Coleta/Amostras/Entregas usam scroll horizontal (por design — tabelas de
lançamento diário). Funciona, mas no campo, com uma mão, ler uma matriz rolando
lateralmente é desconfortável. Candidatas ao padrão **resumo + [Ver detalhes]**
(card por linha) no celular.

### 🟡 UX-P3 — Checkbox 16px e links "remover"/"✕" fora de card
Checkbox de 16×16 (abaixo do alvo de ~40px). Links "remover" (safra) e "✕" de
linha **fora** do contexto `.edcards` não têm `min-height` (dependem do padding
do texto) — pequenos para o dedo.

## Teclado mobile — resumo
| Campo | Teclado hoje | Deveria |
|---|---|---|
| Valor R$ (Despesa/Recorrência/Metas) | alfabético 🔴 | numérico (`inputmode="decimal"`) |
| Valor R$ (editores em tabela) | numérico ✔ | ok |
| Fator/Volume/Área/Prazo (operacional/config) | numérico ✔ (`type=number`) | ok |
| E-mail (login/cadastro) | e-mail ✔ (`type=email`) | ok |
| Data (operacional) | date picker ✔ | ok |
| Telefone/WhatsApp | — | não há máscara `type=tel` (avaliar quando houver campo) |

## Formulário mobile — fluxo esperado vs atual
Esperado: Título → principais → secundários → comprovante/obs → **Salvar**.
Atual (Despesa): todos os 13 campos numa coluna, sem "mais detalhes", sem
comprovante, sem salvar sticky. **Recomendação:** progressive disclosure + botão
**Salvar** fixo no rodapé (sticky) em formulários longos no celular.

## Operação em campo (uma mão, pouco tempo, internet ruim)
- **Registrar rápido:** parcialmente — 2 cliques até o modal de Coleta, mas
  muitos campos e sem "salvar e novo".
- **Precisão de mouse:** os checkboxes 16px e "✕" pequenos exigem mira; ruim no
  trânsito/campo.
- **Internet ruim:** o app é **local-first** (auto-save no navegador + sync
  posterior) — **forte**: não perde lançamento se a conexão cair; o snapshot
  sincroniza depois. Não há spinner/retry visível por requisição, mas o risco de
  perda é baixo por design. Recomenda-se mensagem clara de "salvo no aparelho,
  sincroniza quando voltar".

## Veredito mobile
**Tela mobile mais problemática:** **Metas** (14→38 KPIs + 15 gráficos numa
coluna = rolagem interminável) — inutilizável para decisão no celular. Depois,
os **formulários de Despesa/Metas** pelo teclado alfabético no R$.
**Nota Mobile: 66/100** — fundação forte, atritos concentrados em teclado
numérico, feedback de salvamento e densidade das super-views.
