# DF AGRO · Painel de Gestão

Painel de gestão para **agricultura de precisão** (DF AGRO). Aplicação de página
única (`index.html`) — sem build, sem dependências locais — com sincronização na
nuvem via **Supabase** e uma **camada relacional de BI** que espelha os dados
para consulta via SQL.

## Como usar

Abra `index.html` no navegador, ou publique via GitHub Pages / qualquer host
estático. Não há passo de build.

Bibliotecas carregadas por CDN:

- [SheetJS (xlsx)](https://sheetjs.com/) — importação de planilhas Excel
- [Chart.js](https://www.chartjs.org/) + plugin `datalabels` — gráficos
- [`@supabase/supabase-js`](https://supabase.com/) — autenticação e sincronização
- Google Fonts: Fraunces + Manrope

## Seções do painel

Geral · Financeiro · Clientes · Serviços · Metas · Funil · Margem · Equipe ·
Custos · Operações · Edição de dados.

Os dados ficam salvos no navegador (`localStorage`) e, quando o usuário entra na
conta, são sincronizados com a nuvem.

## Nuvem (Supabase)

- **Organização:** `Bigdata Site`
- **Projeto:** `HTML` (`pvftibzzqcbpgdihfcmb`, região `sa-east-1`)
- **Autenticação:** e-mail + senha (login/cadastro no próprio painel)
- **Fonte da verdade:** tabela `public.painel_estado` — o estado completo do
  painel é um único documento `jsonb` por usuário.

| Coluna          | Tipo          | Observação                                  |
| --------------- | ------------- | ------------------------------------------- |
| `id`            | uuid          | PK (`gen_random_uuid()`)                     |
| `user_id`       | uuid          | Padrão `auth.uid()` · FK → `auth.users`      |
| `empresa`       | text          | Padrão `'DF AGRO'`                            |
| `dados`         | jsonb         | Estado completo do painel                    |
| `atualizado_em` | timestamptz   | Atualizado por gatilho no servidor           |
| `criado_em`     | timestamptz   | Padrão `now()`                               |

- **Restrição única:** `(user_id, empresa)` — um painel por usuário.
- **RLS (por usuário):** cada usuário só lê/grava a própria linha
  (`auth.uid() = user_id`).

A chave usada no front-end é a **publishable/anon key**, projetada para uso
público no navegador; o acesso real é protegido pelas políticas de RLS.

## Camada de BI (relacional)

Além do documento JSON, o banco tem **15 tabelas `bi_*`** que espelham os dados
em formato relacional, para consulta por SQL / ferramentas de BI. Elas são
**somente-leitura** para os usuários (populadas por ETL) e protegidas por RLS
por usuário.

| Tabela BI                 | Conteúdo                                        |
| ------------------------- | ----------------------------------------------- |
| `bi_clientes`             | Clientes (receita, hectares, grupo)             |
| `bi_servicos`             | Serviços por safra (ha/receita/clientes)        |
| `bi_visitas`              | Visitas, relatórios e km por cliente            |
| `bi_grupos`               | Grupos de serviço e custos diretos              |
| `bi_funil`                | Funil de vendas / projeção por safra            |
| `bi_safras`               | Receita e custo por safra                       |
| `bi_caixa_mensal`         | Fluxo de caixa mensal (receita/custo/margem)    |
| `bi_metas`                | Metas de receita e hectares                     |
| `bi_custos_mensais`       | Custos mensais por categoria                    |
| `bi_equipe_indicadores`   | Indicadores por colaborador                     |
| `bi_custo_categoria`      | Custo anual por categoria (2025/2026)           |
| `bi_proj_gastos`          | Projeção de gastos mensal (real/projetado)      |
| `bi_operacao_situacao`    | Situação das operações                          |
| `bi_operacao_etapas`      | Etapas das operações (andamento/pendente)       |
| `bi_cross_sell`           | Matriz de venda cruzada (cliente × serviço)     |

### Sincronização (ETL)

Um gatilho `AFTER INSERT/UPDATE/DELETE` em `painel_estado` chama
`bi_rebuild(user_id, empresa, dados)`, que reconstrói todas as tabelas `bi_*`
do usuário a partir do JSON. Ou seja: **sempre que o painel é salvo, o BI é
atualizado automaticamente** — sem código extra no front-end. As funções de ETL
(`SECURITY DEFINER`) têm o `EXECUTE` revogado da API REST (`anon`/`authenticated`);
só o gatilho as executa internamente.

### Nota de configuração

Se o cadastro exigir confirmação de e-mail (opção *Confirm email* do Supabase
Auth), o novo usuário precisa confirmar pelo link enviado antes do primeiro
login — o painel já trata esse fluxo. Recomenda-se também ativar a *Leaked
Password Protection* no Supabase Auth.
