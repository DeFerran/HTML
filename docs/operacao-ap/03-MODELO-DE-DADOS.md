# Operação AP — Fase 2: Modelo de dados (aditivo)

Estruturas novas no estado `D`, **sem** tocar nas existentes. Persistem junto do
snapshot (`painel_estado`) e são preservadas na importação (`mergeImport`).

## `D.pipelineCfg` — configuração de workflow
```js
{
  tipos: [
    {
      id: 'wf_ap',
      nome: 'Agricultura de Precisão (padrão)',
      condicaoConclusaoCodigo: 'CONCLUIDO',
      ativo: true,
      etapas: [
        { codigo:'PEDIDO',         nome:'Pedido recebido',              slaDias:0,  responsavelPadrao:'', checklist:[] },
        { codigo:'PLANEJAMENTO',   nome:'Planejamento',                 slaDias:3,  responsavelPadrao:'', checklist:[] },
        { codigo:'COLETA',         nome:'Coleta',                       slaDias:7,  responsavelPadrao:'', checklist:[] },
        { codigo:'LABORATORIO',    nome:'Laboratório',                  slaDias:7,  responsavelPadrao:'', checklist:[] },
        { codigo:'PROCESSAMENTO',  nome:'Interpolação / processamento', slaDias:3,  responsavelPadrao:'', checklist:[] },
        { codigo:'MAPAS',          nome:'Mapas / recomendação',         slaDias:3,  responsavelPadrao:'', checklist:[] },
        { codigo:'APRESENTACAO',   nome:'Apresentação',                 slaDias:5,  responsavelPadrao:'', checklist:[] },
        { codigo:'REGULAGEM',      nome:'Regulagem',                    slaDias:7,  responsavelPadrao:'', checklist:[] },
        { codigo:'ACOMPANHAMENTO', nome:'Acompanhamento',               slaDias:15, responsavelPadrao:'', checklist:[] },
        { codigo:'CONCLUIDO',      nome:'Concluído',                    slaDias:0,  responsavelPadrao:'', checklist:[] }
      ]
    }
  ],
  tipoPadraoId: 'wf_ap'
}
```
Aditivo/idempotente no `hydrate`: só semeia se faltar; nunca sobrescreve edição do
usuário.

## `D.projetos` — projetos/serviços do pipeline
```js
{
  id: 'prj…',
  numero: 'PRJ-2026-0001',
  quoteId: 'q…',              // vínculo com o orçamento de origem
  clienteNome, fazenda, municipio,
  servicos: ['Fertilidade Grid 3', …],
  vendedor, safra, areaHa,
  tipoWorkflowId: 'wf_ap',
  etapaAtual: 'PLANEJAMENTO', // código de etapa do workflow
  status: 'ativo',            // ativo | concluido | cancelado
  responsaveis: { PEDIDO:'De Ferran', … },  // responsável por etapa (opcional)
  refs: { coletaIds:['opc…'], remessaIds:['opa…'], entregaId:'ope…', funil:true },
  eventos: [ … ],             // ver abaixo
  criadoEm: '2026-08-14T…Z',
  concluidoEm: ''             // preenchido ao concluir; limpo na reabertura
}
```

### Evento (`projeto.eventos[]`)
```js
{
  em: '2026-08-14T13:20:00.000Z',  // ISO
  quem: 'deferran@icloud.com',     // ou 'local'
  tipo: 'ETAPA',                   // PEDIDO_CRIADO | ETAPA | (futuros LAB_*, INTERP_*…)
  etapaDe: 'PEDIDO',
  etapaPara: 'PLANEJAMENTO',
  responsavel: 'De Ferran',
  obs: 'Convertido de ORC-2026-0001',
  origem: 'orcamento'              // orcamento | manual | sistema | automacao
}
```

## Vínculo com os módulos existentes (por id, retrocompatível)
Os registros criados na conversão passam a carregar **`projetoId`**:
- `D.opColeta.lancamentos[].projetoId`
- `D.opAmostras.remessas[].projetoId`
- `D.opEntregas.linhas[].projetoId`

Registros anteriores (sem `projetoId`) continuam funcionando — aparecerão como
**avulsos** até serem (opcionalmente) vinculados numa fase futura. Nenhuma migração
destrutiva; nenhum dado histórico reescrito.

## Onde cada dado do pipeline mora (sem duplicar base)
| Informação | Fonte de verdade | Ligação |
|---|---|---|
| Pedido/valor/itens | `D.quotes` | `projeto.quoteId` |
| Pontos/produção de coleta | `D.opColeta.lancamentos` | `projeto.refs.coletaIds` / `lanc.projetoId` |
| Datas de laboratório | `D.opAmostras.remessas` | `projeto.refs.remessaIds` / `remessa.projetoId` |
| Entregáveis (mapas/análises) | `D.opEntregas.linhas` | `projeto.refs.entregaId` / `linha.projetoId` |
| Cliente/fazenda/município | `D.clientes`/`D.fazendas`/`D.municipios` | por nome (padrão atual) |
| Etapa/tempos/eventos | `projeto.etapaAtual` + `projeto.eventos` | derivados por `PipelineCalc` |

O projeto **consolida**; a fonte oficial de cada dado permanece no módulo dono.

## Persistência & preservação
- Semeado em `hydrate` (aditivo).
- Preservado em `mergeImport` (adicionados `'projetos'` e `'pipelineCfg'` à lista) —
  a importação de planilha não zera o pipeline.
- Viaja no snapshot `painel_estado` como qualquer parte de `D`.
