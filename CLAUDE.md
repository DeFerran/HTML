# Regras permanentes do projeto

## Princípio principal

Este projeto já possui uma plataforma funcional de Agricultura de Precisão.

Toda nova implementação deve preservar a arquitetura, banco de dados,
funcionalidades, cálculos, dashboards, gráficos, filtros, clientes,
fazendas, talhões, safras, custos, coleta e demais módulos existentes.

A IA será uma CAMADA SOBRE A PLATAFORMA EXISTENTE.

Nunca deverá substituir ou duplicar a fonte oficial de dados.

---

## Regra de segurança

Antes de modificar qualquer componente, função, hook, service, rota,
API, migration, tabela ou política RLS:

1. localizar todas as dependências;
2. entender a implementação existente;
3. avaliar impacto;
4. preservar compatibilidade;
5. escolher a alteração de menor risco.

---

## Proibido sem autorização explícita

- DROP TABLE
- DROP COLUMN
- TRUNCATE
- DELETE em massa
- recriar banco existente
- alterar IDs existentes
- renomear tabelas existentes
- desativar RLS
- remover políticas de segurança
- substituir autenticação
- substituir Supabase
- criar segunda tabela de clientes
- criar segunda tabela de fazendas
- criar segunda tabela de talhões
- criar segunda base financeira
- duplicar regras de negócio
- deixar secrets no frontend
- permitir SQL livre produzido pela IA em produção

---

## Multi-tenant

Toda nova funcionalidade deverá respeitar a arquitetura multi-tenant.

Verificar sempre, conforme a arquitetura existente:

- tenant_id
- company_id
- user_id
- perfil
- permissão
- escopo de acesso

Uma organização nunca poderá acessar dados de outra.

---

## IA

A IA deverá acessar a plataforma através de ferramentas controladas.

Fluxo:

Usuário
→ AI Gateway
→ Orchestrator
→ Tool autorizada
→ banco/API existente
→ resultado
→ IA

O modelo não deverá possuir acesso irrestrito ao banco.

Dados objetivos deverão vir das ferramentas.

Exemplos:

área
produtividade
custos
análises de solo
clientes
fazendas
talhões
safras
mapas
coletas

Nunca inventar esses valores.

---

## Ações

Separar ferramentas em níveis:

READ
somente consulta.

SAFE_WRITE
ações internas reversíveis.

SENSITIVE_WRITE
ações importantes que exigem aprovação humana.

A IA não deverá:

- apagar registros automaticamente;
- alterar finanças automaticamente;
- enviar comunicação externa sensível automaticamente;
- alterar recomendação agronômica crítica automaticamente.

---

## Implementação incremental

Nunca implementar várias fases grandes simultaneamente.

Para cada fase:

1. analisar;
2. planejar;
3. implementar;
4. executar build;
5. executar testes;
6. verificar console;
7. verificar dados;
8. documentar alterações;
9. parar.

Não iniciar a fase seguinte sem ordem explícita do usuário.

---

## Migrações

Migrações deverão ser:

- aditivas;
- reversíveis quando possível;
- retrocompatíveis;
- seguras para dados existentes.

Preferir:

CREATE TABLE
ADD COLUMN
CREATE INDEX
CREATE POLICY

Não modificar dados históricos sem necessidade.

---

## Secrets

Nunca colocar no frontend:

ANTHROPIC_API_KEY
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_ACCESS_TOKEN
tokens privados
credenciais internas

Utilizar secrets/env do backend.

---

## Código

Reutilizar arquitetura e bibliotecas existentes.

Não adicionar biblioteca nova se a infraestrutura atual resolver.

Não duplicar componentes sem necessidade.

Não criar valores fictícios em produção.

Não hardcodar:

- colaboradores;
- clientes;
- fazendas;
- talhões;
- safras;
- empresas.

---

## Relatório obrigatório após cada fase

Apresentar:

- objetivo realizado;
- arquivos criados;
- arquivos modificados;
- tabelas criadas;
- migrations criadas;
- endpoints criados;
- tools criadas;
- testes executados;
- erros encontrados;
- riscos;
- pendências;
- rollback;
- próxima fase sugerida.

Depois PARAR.
