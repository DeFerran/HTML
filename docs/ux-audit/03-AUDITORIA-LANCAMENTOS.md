# 03 — Auditoria de Lançamentos (formulários)

Área mais crítica para o **operador**. A central "Lançamentos" (`#v-edit`) tem
**12 sub-seções**. Motores: `edTable` (tabela editável inline), `edForm`
(campos escalares), e renders sob medida (Despesas, Equipe, Coleta, Lab,
Estrutura). **Auto-save global** (grava a cada digitação; indicador "● Tudo
salvo"). **Nenhuma seção tem upload de comprovante/foto. Nenhuma tem "salvar e
criar outro".**

## Friction Score (0 = excelente · 10 = péssimo)

Considera: nº de campos, obrigatórios, cliques, dropdowns, teclado mobile,
divulgação progressiva, "salvar e novo", confirmação de exclusão, contexto
automático, **e frequência de uso** (peso maior para o que se lança todo dia).

### 10 formulários com MAIOR fricção

| # | Formulário | Campos | Obrig. | Friction | Principais problemas |
|---|---|--:|--:|--:|---|
| 1 | **Despesas — Nova despesa** (diária) | 13 | 1 | **7.5** | 13 campos de uma vez; sem "mais detalhes"; R$ sem teclado numérico no cel; sem salvar-e-novo; sem comprovante |
| 2 | **Metas & Parâmetros** (editor) | ~40 | 0 | **7.0** | ~40 campos escalares numa tela; R$/% sem `inputmode`; baixa frequência atenua |
| 3 | **Equipe** (editor) | matriz | 0 | **6.5** | matriz Indicador×meses por colaborador; muitos números; exclusão sem confirmação |
| 4 | **Coleta** (editor Lançamentos) | matriz | 0 | **6.0** | matriz Item×meses por coletor; denso; exclusão sem confirmação |
| 5 | **Custos mensais** (matriz) | 13/linha | 0 | **6.0** | Categoria × 12 meses; muitos inputs; exclusão de categoria sem confirmação |
| 6 | **Estrutura de custo** (matriz) | 13/linha | 0 | **5.5** | Grupo × meses; idem |
| 7 | **Recorrências** | 10 | 3 | **5.0** | 10 campos; `month` para período (ok); R$ sem teclado numérico |
| 8 | **Coleta de Pontos** (modal op) | ~8 + lista | 0 | **5.0** | modal; colaboradores+pontos; 8 filtros na tela por baixo; sem salvar-e-novo |
| 9 | **Funil** (inline) | 8 | 0 | **4.5** | inline largo; exclusão sem confirmação; sem obrigatórios |
| 10 | **Clientes e vendas** (inline) | 9 | 0 | **4.0** | inline; Receita calculada (bom); exclusão sem confirmação |

### 10 formulários de MENOR fricção (referência do que já é bom)
Orçamentos (4 campos, 2 obrig., valida) · Veículos (form em card) · Serviços
(3 campos inline, Receita calc.) · Preços por safra (3 campos, Contribuição
calc.) · Laboratório·Auditoria (5 campos) · Operação·edOp/edEtapas/edVisitas
(2–4 campos) · Metas por safra (4 campos) · Config·Parâmetros globais
(`type=number`, teclado numérico ✔).

## Detalhe do formulário mais importante — NOVA DESPESA

**Campos reais (13), na ordem atual:** Data (date) · Descrição (text) ·
**Valor (R$, obrigatório)** · Natureza (select, 9 opções) · Centro de custo
(select) · Categoria (select — **auto-preenche Natureza** ✔) · Colaborador
(select) · Cliente (select) · Serviço (select) · Veículo (select) · Forma pgto
(select) · Status (select) · Observação (text).

**Não existem:** competência (derivada da Data), subcategoria, **fazenda/talhão**
(não há a dimensão), **comprovante/anexo**.

Classificação por campo (é necessário sempre? pode ser default/contexto/
condicional?):

| Campo | Veredito UX |
|---|---|
| Data | **Essencial** — mas deveria vir **hoje** por padrão (hoje é opcional/vazio). |
| Descrição | **Essencial** — primeiro campo natural. |
| Valor | **Essencial + obrigatório** — no celular precisa de teclado numérico. |
| Categoria | **Essencial** — e já dispara Natureza (boa relação inteligente). |
| Natureza | **Secundário** — vem da Categoria; pode ficar oculto/somente-leitura. |
| Centro de custo | **Secundário** — "Mais detalhes". |
| Colaborador | **Condicional** — relevante p/ pessoal; "Mais detalhes". |
| Cliente | **Condicional** — "Mais detalhes". |
| Serviço | **Condicional** — "Mais detalhes". |
| Veículo | **Condicional** — só quando natureza = combustível/manutenção; "Mais detalhes". |
| Forma pgto | **Secundário** — default "Pix"/última usada; "Mais detalhes". |
| Status | **Secundário** — default "Pago"; "Mais detalhes". |
| Observação | **Opcional** — sempre por último. |

**Proposta (a validar, não implementada):** mostrar **4 campos principais**
(Data=hoje · Descrição · Valor · Categoria) + botão **"+ Mais detalhes"** que
revela os 8 secundários; botões **[Salvar]** e **[Salvar e criar outro]**;
lembrar do último **Centro/Forma/Status** para o próximo lançamento.

## Achados transversais (todos os formulários)

1. **Sem "salvar e criar outro"** em lugar nenhum — penaliza quem lança em série.
2. **Sem comprovante/anexo** — despesa não guarda foto/PDF de nota.
3. **Validação de obrigatório quase inexistente** — só Despesas (Valor>0),
   Recorrências (3) e Orçamentos (2) validam; todo o resto aceita vazio.
4. **Confirmação de exclusão inconsistente** — existe nos 3 formulários de card;
   **ausente** em todas as tabelas inline e editores sob medida (clique único
   apaga Serviço/Funil/Custo/Equipe/Coleta/Estrutura/Operação/Cliente). 🔴
5. **Divulgação progressiva ausente** — formulários longos (Despesa, Metas)
   mostram tudo de uma vez.
6. **Feedback é global, não por registro** — "● Tudo salvo" no topo, mas sem
   "✓ Despesa salva" após cada lançamento (e no drill-in mobile o indicador
   some, pois `.edbar` é escondida — ver 05).
7. **Contexto não é reaproveitado** — não há herança "estou no Cliente X" para
   pré-preencher lançamentos relacionados (as telas não são hierárquicas).

## Conceito "Lançamento rápido" (Fase 7 — avaliar, não implementar)
Hoje **não existe**. O único botão flutuante (FAB) é o **Copiloto de IA**, não um
"+ Lançar". Há espaço claro para um **FAB "+ Lançar"** com menu curto
(Despesa · Coleta · Entrega · Observação) que abra o formulário reduzido já no
contexto da safra em foco — reduziria a J4 de 3 cliques + garimpo para 2 cliques
diretos. **Recomendação: sim, vale** (ver 08, Quick Win).
