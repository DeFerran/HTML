# 08 — Segurança / RLS / Multi-tenant

> Contexto (ver `01-AUDITORIA-ATUAL.md §0` e `docs/security-audit/`): plataforma
> **single-tenant**, persistência em **blob JSON** (`painel_estado`, uma linha por
> `user_id + empresa='DF AGRO'`), protegido por **RLS por `user_id`**. Não há
> tabelas relacionais por lançamento — logo, não há RLS por linha nem endpoint.

## Modelo de segurança da Central

- **Autoridade no backend/serviço central, não no Excel.** A planilha pode ter
  fórmulas e dropdowns de ajuda, mas a importação **revalida tudo** e **recalcula**
  pelas mesmas regras do lançamento manual (`LancService`). Fórmulas do Excel nunca
  viram valor oficial (o backend recalcula, ex.: `parseData`, `r2`, natureza).
- **Nunca confiar em IDs/tenant do arquivo.** Não se lê tenant do XLSX; o escopo é
  sempre o snapshot do usuário autenticado (RLS de `painel_estado`). Importar/
  replicar/ratear só escreve no próprio `D` — impossível escrever no dado de outro
  usuário via arquivo manipulado.
- **Snapshot de referência envelhece:** as listas do arquivo são apenas ajuda; a
  classificação revalida os nomes contra os cadastros **atuais** (cliente/categoria
  desativado vira 🔴 erro com sugestão).
- **`import_row_key`/IDs de sistema** não são confiados sem revalidação de conteúdo
  (fingerprint recomputado no backend).

## Arquivo malformado

Validações no parse: extensão/tipo (`.xlsx`/`.csv`), estrutura (cabeçalho
reconhecível, colunas obrigatórias), versão do template. **Nunca** executa macros/
fórmulas nem interpreta conteúdo como código (`XLSX.read` só extrai dados;
`ImportStaging` trata células como texto).

## Permissões

A Central vive na aba **Lançamentos**/Coleta, que o RBAC client-side esconde de
`leitor` (`aplicarPermissoes`). Rollback exige confirmação explícita e registra
autoria (`desfeitoPor`). Escrita real continua sujeita à RLS de `painel_estado`.

## Multi-tenant (futuro)

Se um dia houver 2ª empresa, `empresa` deixa de ser constante e as policies passam
a `tenant_id = minha_empresa() ∧ user_id` (ver `docs/security-audit` SEC-003). A
Central já ignora qualquer tenant vindo do arquivo, então a mudança fica contida
no `LancStore`/RLS.
