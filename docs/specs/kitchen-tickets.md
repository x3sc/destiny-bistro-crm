# Tickets de cozinha

## Objetivo

Produtos podem declarar `requiresKitchen`. A flag e copiada para o
`ComandaItem` quando o produto entra na comanda, preservando o comportamento
historico mesmo se o cadastro for alterado depois.

## Confirmacao

O envio acontece somente em
`POST /comandas/:comandaId/items/:itemId/confirm`. Cada confirmacao efetiva
gera um ticket novo para o delta
`quantity - confirmedQuantity`. Configuracoes e adicionais sao copiados como
snapshots com suas quantidades.

A chave `CONFIRM:<itemId>:<anterior>:<novo>` e unica por estabelecimento.
Ticket, consumo de estoque, quantidades confirmadas, evento de comanda e
auditoria usam a mesma transacao Prisma. Repeticoes sem quantidade pendente nao
geram ticket.

## Isolamento e permissoes

Todos os modelos de cozinha carregam `establishmentId` e usam relacionamentos
compostos. As consultas derivam o estabelecimento da sessao e retornam como nao
encontrado qualquer ticket de outro tenant.

- `kitchen.read`: consultar tickets.
- `kitchen.write`: alterar status.

`OWNER`, `MANAGER` e `KITCHEN` recebem ambas as permissoes.

## Estados

`PENDING -> PREPARING -> READY -> DELIVERED`. Tickets em qualquer estado
operacional podem ir para `CANCELLED`. Repetir o estado atual e idempotente;
saltos, reversoes e alteracoes de estados terminais sao rejeitados.

Tickets sao historicos e nao sao reescritos por alteracoes posteriores no
produto ou por cancelamentos da comanda. O cancelamento operacional do ticket e
explicito na API/tela da cozinha.
