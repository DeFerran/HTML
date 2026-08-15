# 04 — Detecção de duplicidade

> Implementada em `ImportStaging.classificar` (bloco `<import-staging>`).
> Regra de ouro: **append-only**. A detecção só CLASSIFICA — nunca apaga,
> sobrescreve ou ignora um registro legítimo automaticamente.

## Status por linha

| Status | Significado |
|---|---|
| 🟢 `nova` | Sem correspondência — será criada |
| 🔵 `existente` | Mesma `import_row_key` já importada (reupload) |
| 🟡 `possivel` | Fingerprint igual a um lançamento já existente |
| 🔴 `erro` | Falha de validação (valor ≤ 0, data inválida, cliente inexistente…) |
| 🟠 `atencao` | Linha repetida dentro do próprio arquivo |

## Camada 1 — `import_row_key` (idempotência)

Chave estável por linha. Se o arquivo trouxer `import_row_key` preenchida, ela é
usada; senão, cai no fingerprint. No import, cada registro criado grava
`importRowKey`. **Reenviar o mesmo arquivo** → as linhas viram 🔵 `existente` e
**0 são reimportadas** (provado em `tests/importstaging` + runtime).

## Camada 2 — identificador externo

Suportada pela mesma chave (`import_row_key`), que pode carregar nº de documento/
pedido quando o modelo do tipo o incluir.

## Camada 3 — fingerprint canônico

`LancService.fingerprint(rec, tipo)` monta uma assinatura por conteúdo:
- **despesa:** `data | valor | cliente | categoria | descrição` (case-insensitive)
- **coleta:** `data | cliente | fazenda | talhão | colaboradores:pontos` (ordem dos
  colaboradores não importa)

Coincidência de fingerprint com um registro existente → 🟡 `possivel` (o usuário
decide **Importar como novo** ou **Ignorar**). **Dois lançamentos legítimos iguais
(mesmo valor/data/categoria) NÃO são tratados como duplicados automaticamente.**

## Duplicidade dentro do arquivo

A segunda ocorrência do mesmo fingerprint no arquivo é marcada 🟠 `atencao`.

## Não criar cadastro por erro de digitação

Nome não encontrado → 🔴 `erro` com **sugestão** (distância de Levenshtein, ex.:
`Joao` → "você quis dizer *João*?"). A correspondência é **acento-sensível** (só
aceita match exato); a sugestão é acento-tolerante. Nunca cria cliente/categoria
automaticamente.

## Modo UPDATE

Não existe atualização automática de registros existentes (decisão desta fase). Se
um dia houver "Atualizar existentes", será funcionalidade **separada, explícita e
com permissão superior**.
