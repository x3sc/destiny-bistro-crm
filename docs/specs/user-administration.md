# Administração de usuários

O dono acessa Administrativo → Usuários para consultar os usuários do seu estabelecimento e criar novos acessos. Implementa a issue #101, com referência visual aprovada no [Stitch](https://stitch.withgoogle.com/projects/2218287996926224711).

## Acesso e dados
- GET e POST /admin/users exigem sessão ativa, permissão users.manage e cargo OWNER. MANAGER não acessa estas rotas.
- O estabelecimento é obtido da sessão; identificadores de estabelecimento no corpo são rejeitados.
- Nome: 2–80 caracteres após aparar e colapsar espaços, com unicidade global sem diferença de maiúsculas/minúsculas pelo mecanismo atual.
- Senha: 8–128 caracteres, hash pelo mecanismo de autenticação existente. A confirmação existe apenas na interface.
- Um cargo por novo cadastro: OWNER (Dono), MANAGER (Gerente), WAITER (Garçom), KITCHEN (Cozinha). Usuários existentes mantêm todos os seus cargos.
- Criação de usuário ativo, atribuição do cargo com assignedByUserId e auditoria USER_CREATED ocorrem na mesma transação. Senhas e hashes não integram respostas ou logs desta operação.

## Contratos HTTP
GET /admin/users retorna { users, roles }, com usuários ordenados por nome/id e cargos disponíveis na ordem Dono, Gerente, Garçom, Cozinha.
Cada usuário tem { id, name, active, roles }; cada cargo tem { id, code, name }.

POST /admin/users recebe exatamente { name, password, roleCode } e retorna 201 com { user }.
Erros: 400 dados inválidos, 401 sem sessão, 403 sem autorização, 409 nome indisponível, 503 indisponibilidade.
A colisão global de nome não revela dados do outro estabelecimento.

## Interface
Card Usuários exclusivo do dono; acesso direto à rota também protegido. Lista operacional com perfis e situação; formulário rolável com seleção única, exibição opcional da senha e ações Criar usuário/Cancelar. Envios simultâneos são bloqueados e as senhas são limpas ao concluir ou sair. Sucesso insere o usuário retornado na lista sem trocar a sessão do dono.
Sem exemplos fictícios na interface operacional. Não há edição, desativação, exclusão ou redefinição de senha nesta entrega.

## Compatibilidade e validação
Não requer migração ou dependência nova. O provisionamento por CLI permanece disponível.
Testes de fluxo no frontend e integração MySQL real cobrem criação, login, autorização, unicidade concorrente, isolamento e rollback quando a auditoria falha. Executar os checks existentes de backend, frontend, segurança e Compose antes de revisão.
