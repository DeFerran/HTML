# Varredura de layout — todas as telas

**Data:** 2026-08-14
**Método:** render headless (Chromium) de **todas as 20 telas** do menu, em
**4 configurações**: desktop claro, desktop escuro, celular claro, celular
escuro (80 checagens). Para cada tela mediu-se: erros de JS, vazamento entre
views (alguma `.view` renderizando sem ser a ativa), overflow horizontal do
corpo, e elementos que estouram a largura da viewport.

## Telas cobertas (20)
geral, fin, cli, serv, funil, margem, metas, equipe, custos, op, opresumo,
opcoleta, opamostras, opentregas, edit (Lançamentos), **config (Safras &
Parâmetros)**, ia (Conhecimento), iamem (Memória), iahub (Central IA), admin.
As telas restritas (IA/Admin) foram reveladas para entrarem na varredura.

## Resultado

| Verificação | desk-claro | desk-escuro | cel-claro | cel-escuro |
|---|---|---|---|---|
| Erros de JS | 0 | 0 | 0 | 0 |
| Vazamento entre views | 0 | 0 | 0 | 0 |
| Overflow horizontal do corpo | 0 | 0 | 0 | 0 |

**Nenhuma tela faz a página rolar de lado; nenhuma view vaza por baixo de
outra; zero erros de JS em qualquer tema/tamanho.**

## Tabelas largas (comportamento correto, não é bug)

No celular, algumas tabelas densas são **mais largas que a tela** e **rolam
horizontalmente dentro do próprio quadro** (contêiner `overflow-x:auto`),
sem cortar conteúdo e sem empurrar a página:

- `serv` (Conciliação `#tRecon`), `margem` (`#tPrecos`), `metas` (`#tGrupo`),
  `equipe` (`#tEquipe`) → wrapper `div` com `overflow-x:auto`, rolável ✔
- `opcoleta`/`opamostras`/`opentregas` (`.op-tbl`) → wrapper `div.tblscroll`
  com `overflow-x:auto`, rolável ✔ (tabelas de lançamento diário, densas por
  natureza — a rolagem é intencional).

Outras tabelas (ex.: Serviços por linha, Membros, Histórico) usam
`.resp-cards` e viram **cards** no celular.

Observação cosmética: em `custos` um `<b>` de nota fica ~4px além da borda
(sem overflow do corpo, sem corte) — irrelevante.

## Correção aplicada nesta rodada
Antes desta varredura, corrigi um vazamento mobile real: `#v-edit{display:flex}`
mantinha o Lançamentos visível por baixo de outras abas no celular →
escopado para `#v-edit.active`. A varredura confirma **0 vazamentos** agora.

## Veredito
Layout **saudável** em todas as telas, temas e tamanhos. Nenhuma correção
adicional necessária. Nada pendente.
