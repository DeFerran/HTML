# Orçamentos — 01 · Auditoria da estrutura atual (Fase 1)

Auditoria antes de qualquer implementação, como pede o próprio briefing e as
regras do projeto. Nada foi alterado nesta fase.

## Reconciliação essencial — realidade da plataforma × premissas do briefing
O briefing assume um backend SQL multi-tabela com RLS, multi-tenant e PDF de
servidor. **A plataforma real não é assim:**
- É **single-file, client-side** (vanilla JS). Todo o estado é **um objeto `D`**
  salvo em `localStorage` + **um snapshot por usuário** no Supabase
  (`painel_estado`, `user_id` + empresa fixa **"DF AGRO"**).
- Portanto **não haverá tabelas** `quotes/quote_items/...`; elas viram **arrays
  aninhados em `D.quotes`** — o mesmo padrão que já usamos nos cadastros.
- **RLS/multi-tenant** → o modelo real é **snapshot por conta + papéis
  `admin/editor/leitor`** (tabela `membros`, com `abas` permitidas). A alçada de
  desconto sai desse papel.
- **PDF de servidor** → **proposta em HTML + `window.print()`** (Salvar como PDF
  do navegador). Não há lib de PDF nem servidor; o CSP bloqueia recursos externos.

> Consequência: os nomes conceituais do briefing são respeitados como **campos**
> dentro de `D.quotes`, não como tabelas. Nada de "segunda base" de clientes,
> serviços ou preços.

## As 13 perguntas da auditoria

**1. Quais estruturas de orçamento já existem?**
Existe `D.orcamentos`, mas é **orçamento de GASTO** (teto de despesa por
categoria/centro/natureza/colaborador × ano) — comparado com `D.lancamentos`.
Nada a ver com proposta comercial. → O módulo comercial é **novo** (`D.quotes`),
ao lado; **não evoluir** `D.orcamentos`. (`index.html:1692, 5074-5132`)

**2. Onde está a tabela de preços atual?**
`D.precosSafra[safra][servico] = {preco, custo, un:'ha'}` — preço de venda e
custo de execução por **serviço por safra** (acessor `precoServ(S,serv)`;
editor `renderPrecoEditor`). Também `D.servicos[].precoHa2627` e o **lab**
(`D.lab.precos` R$/amostra, `D.lab.gridHa` ha/ponto, `D.lab.pctColeta`). Detalhe
completo no doc 03.

**3. Como os serviços são cadastrados?**
`D.servicos[]` (nome + área/receita por safra + `precoHa2627`), com o catálogo de
seleção via `funilServicoLista()`/`funilServicoOpts()`; `D.grupos[]` liga
serviços a custos diretos. Editável em Lançamentos › Serviços e no hub Cadastros.

**4. Como clientes e fazendas estão relacionados?**
`D.clientes[]` (nome, vendedor, `servico`, `ha`, `precoHa`, `receita`, e — das
Fases 3–4 — `fazenda`/`municipio`). `D.fazendas[]` liga **cliente → fazenda →
município** (`clienteNome`, `municipioNome`, `areaHa`). **Talhões não existem**
(a fazenda tem área total, sem subdivisão).

**5. Existe funil comercial?**
Sim: `D.funil[]` {cliente, safra, servico, estagio, vendedor, mes, area,
precoHa, valor}. Estágios: **Fechado(1.0) · Provável(0.7) · Possível(0.4) ·
Prospecção(0.15)**. `funilOps(safra)` **já junta** carteira-Fechado (de
`D.clientes`) + pipeline manual aberto, evitando dupla contagem — regra que o
módulo **deve respeitar** (integrar, não criar 2º funil). Funil **não tem
fazenda/talhão**.

**6. Existe vendedor responsável?**
Sim: `vendedor` em `D.clientes` e `D.funil` (lista De Ferran/Anderlírio/Bruno/A
definir), com cadastro de Colaboradores e cascata de renome (Fase 6). Receita por
vendedor via `vendasVendedor()`; plano de comissão em `D.comissaoPlano`.

**7. Existe estrutura de desconto?**
Parcial e **implícita**: `vendaMargem(o)` calcula **`desvio = (receita −
valorTab)/valorTab`** (preço negociado vs preço de tabela). Ou seja, o "desconto
vs tabela" já é calculado e exibido — mas **não há alçada, nem preço mínimo, nem
autorização**. Esses são **gaps a preencher**.

**8. Existe estrutura de condições de pagamento?**
Só **global**: `D.recebimento2027.parcelas[]` (ex.: Abr/27 90% + Ago/27 10%) para
a curva de caixa da empresa. **Não há condição de pagamento por proposta** — é
conceito novo (`quote.pagamento`).

**9. Existe geração de PDF/proposta?**
Não. Há export CSV (`opDownload`) e HTML (`baixarPainel`). Caminho viável:
**proposta HTML + `window.print()`**.

**10. Existe integração com financeiro?**
Receita vem de `D.safras`/carteira; custos de `D.lancamentos`; projeção pelo
funil. **Regra a respeitar:** orçamento **não** é recebimento — nada entra como
receita realizada até a conversão seguir a regra existente.

**11. Quais tabelas/estruturas poderão ser reutilizadas?**
`D.clientes`, `D.fazendas`, `D.municipios`, `D.servicos`, `D.grupos`,
`D.precosSafra`, `D.lab` (grid/malha/amostras), `D.funil` (+ `vendaMargem`,
`funilOps`, `funilProb`), Colaboradores/vendedores, papéis `membros`,
export/print, e os módulos operacionais para a conversão.

**12. Quais estruturas novas seriam necessárias?**
`D.quotes[]` (orçamentos comerciais, com itens/versões/histórico embutidos) e
`D.comercial` (cadastros configuráveis: **profundidades, malhas, condições de
pagamento, pacotes, alçadas de desconto, validade padrão, política de preço
mínimo**).

**13. Quais riscos existem?**
- Duplicar o funil / contar venda duas vezes (mitigado por integrar com
  `funilOps`).
- Preço mudar depois e alterar orçamento antigo → **snapshot de preço** por item.
- Tamanho do snapshot (versões/histórico incham `D`) → limitar histórico.
- Reconhecer receita cedo demais → só na conversão, pela regra atual.
- Complexidade de preço por amostra/profundidade → usar as regras reais do lab,
  **sem assumir** pontos×profundidades.
- Mobile: wizard tem que ser realmente simples (1 etapa/tela).

## Onde o módulo vive
Já existe o grupo **"Comercial"** na barra lateral (Clientes · Serviços · Funil)
— é ali que entra **Orçamentos** (`index.html:706`).

## Permissões (modelo real)
`membros.papel` = **admin / editor / leitor** + `abas` permitidas; `ehAdmin`,
`meuPapel`, `minhasAbas`, `aplicarPermissoes()`. Vendedor ≈ editor; gestor/diretor
≈ admin. Alçada de desconto será mapeada nesses papéis (configurável).

## Conclusão
Reutilizar tudo o que já existe (cliente/fazenda/serviço/preço/funil/vendedor);
criar **apenas** `D.quotes` + `D.comercial`; integrar ao funil e à conversão
operacional; nunca duplicar base nem reconhecer receita antes da regra real.
