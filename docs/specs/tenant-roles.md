# Cargos locais e autorização por grupo

Issue #139. Cargos e seus vínculos de permissões pertencem a um estabelecimento.
`User.localRoleId` é obrigatório e sua FK composta impede atribuição entre tenants.
Os modelos globais legados permanecem apenas como referência, não como autoridade.

## Autoridade e concorrência

O Dono local é protegido e possui todos os acessos. Não pode ser editado/excluído;
códigos internos são gerados no servidor. Somente o Dono concede ou remove
`roles.manage` e `users.manage`. Delegados não editam o próprio cargo, cargos
administrativos nem acessos fora do alcance atual/proposto. Administração de usuários
aplica os mesmos limites ao cargo atual e ao proposto. Nem o Dono reatribui a si mesmo.

Todas as gravações administrativas bloqueiam a linha do estabelecimento, revalidam
o operador ativo no banco e verificam versões na mesma transação da auditoria.
Exclusão considera todos os usuários vinculados, inclusive inativos. Falha de
auditoria desfaz a alteração. O último Dono ativo não pode ser removido.

## Contratos

- `GET /admin/roles`: cargos com versão, contagem de usuários e ações permitidas;
  catálogo de permissões com grupos e dependências. `ownerOnly` na resposta indica
  opção indisponível ao operador atual (reservada ao Dono ou fora de seu alcance).
- `POST /admin/roles`: `{ name, description?, permissions }`.
- `PATCH /admin/roles/:id`: os mesmos campos, com `expectedVersion`.
- `DELETE /admin/roles/:id`: `{ expectedVersion }`.
- `GET /admin/users`: usuários do tenant com cargo único, `roleVersion`, permissões
  e `canReassign`; opções de cargos filtradas pelo alcance do operador.
- `POST /admin/users`: `{ name, password, roleId }`; aceita `roleCode` padrão como
  alternativa temporária, nunca os dois. Nome normalizado de 2–80 caracteres,
  único globalmente; senha de 8–128 caracteres.
- `PATCH /admin/users/:id/role`: `{ roleId, expectedVersion }`, versão do vínculo,
  não do cargo. Registra cargo/permissões anteriores e posteriores na auditoria.

Nomes de cargo normalizados por trim, espaços e minúsculas; unicidade local. Códigos
desconhecidos, duplicados e dependências incompletas são rejeitados. `409` para
versão desatualizada, nome duplicado e cargo em uso. Recursos de outro tenant
retornam `404`. Senhas/tokens nunca entram nos valores anteriores/posteriores.

## Operação

Venda Rápida usa `quick-sales.read/write`, Balcão `counter-sales.read/write`,
Mesa `comandas.read/write`, Fiado `credits.read/write`, Delivery
`deliveries.read/write`. Rotas compartilhadas resolvem a origem persistida e
revalidam sob bloqueio na transação de alteração. Impressão e cancelamento de
confirmados mantêm seus acessos adicionais. Cozinha e extratos autorizam consultas
agregadas independentemente das permissões específicas de cada fluxo.

## Migração e recuperação

1. Interromper gravações da API/CLI antigos e verificar backup restaurável em
   ambiente separado. Nunca executar testes com reset no banco operacional.
2. Aplicar `npm.cmd run prisma:migrate:deploy` na pasta `backend`, com ambiente
   previamente conferido pelo responsável. A migração adiciona tabelas, preenche
   cargos/vínculos e só então exige `localRoleId` obrigatório.
3. Conferir totais de usuários antes/depois, ausência de vínculos nulos e tenants
   incompatíveis; comparar acessos efetivos, especialmente multi-cargos e Donos.
4. Subir somente a API nova e verificar `/ready`, login e `/auth/me` antes de
   liberar gravações. Frontends antigos não entendem todos os novos cargos.

Gerentes não herdam `users.manage`/`roles.manage` antes bloqueados por código.
Permissões de Fiado anteriormente ineficazes são removidas dos demais cargos.
Novas permissões de Venda Rápida/Balcão derivam dos acessos antigos de comandas.
Multi-cargos não Dono recebem grupo de compatibilidade com união efetiva; quem
já é Dono continua Dono; sem cargo recebe grupo sem acesso. Dados financeiros e
auditorias históricas não são alterados. Seeds não recriam permissões locais.

DDL MySQL não garante rollback transacional completo: em falha, manter a API
parada e recuperar backup validado ou corrigir a migração com avaliação do estado
real. Nunca voltar apenas à autorização legada global, que pode reativar acessos
revogados. Não há down migration automática. Esta entrega não executa migração
no ambiente operacional.
