# DF AGRO · Painel de Gestão

Painel de gestão para **agricultura de precisão** (DF AGRO). Aplicação de página
única (`index.html`) — sem build, sem dependências locais — com sincronização na
nuvem via **Supabase**.

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

- **Projeto:** `HTML` (`pvftibzzqcbpgdihfcmb`, região `sa-east-1`)
- **Autenticação:** e-mail + senha (login/cadastro no próprio painel)
- **Tabela:** `public.painel_estado`

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
- **Modelo de dados:** por usuário — cada login tem seu próprio painel,
  acessível de qualquer computador.

A chave usada no front-end é a **publishable/anon key**, projetada para uso
público no navegador; o acesso real é protegido pelas políticas de RLS.

### Nota de configuração

Se o cadastro exigir confirmação de e-mail (opção *Confirm email* do Supabase
Auth), o novo usuário precisa confirmar pelo link enviado antes do primeiro
login — o painel já trata esse fluxo e exibe a mensagem correspondente.
