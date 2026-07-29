# Destiny Bistro CRM

CRM para apoiar a operacao de um bistro, com foco inicial no controle de comandas e na reducao de perdas durante o atendimento.

## Objetivo

O projeto sera construido de forma incremental. As primeiras entregas devem organizar o fluxo de mesas e pedidos; as etapas seguintes poderao incluir cozinha, caixa e gestao local.

## Estrategia de desenvolvimento

- Manter entregas pequenas e versionadas.
- Validar cada etapa antes de ampliar o escopo.
- Evitar incluir credenciais e configuracoes locais no repositorio.

## Estrutura inicial

```text
backend/      API Fastify, Prisma e testes
frontend/     Aplicativo mobile Expo
compose.yaml  MySQL local para desenvolvimento
```

## Requisitos

- Node.js 22.13+
- npm
- Docker Desktop
- Expo Go no celular

## Configuracao local

Crie os arquivos locais de ambiente a partir dos exemplos:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

No `frontend/.env`, substitua o IP de exemplo pelo IP local do computador na
rede Wi-Fi. Nao use `localhost`, pois o aplicativo sera executado no celular.

Por padrao, o MySQL usa a porta `3306`. Se ela ja estiver ocupada, altere apenas
o `backend/.env` local. Por exemplo, para usar a porta `3308`, ajuste
`MYSQL_PORT`, `DATABASE_PORT` e a porta presente em `DATABASE_URL`.

## Banco e API

Inicie o Docker Desktop e execute:

```powershell
docker compose --env-file backend/.env up -d
Set-Location backend
npm.cmd install
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
npm.cmd run dev
```

A API fica disponivel em `http://localhost:3333`:

- `GET /health`: confirma que a API esta online.
- `GET /ready`: confirma que o MySQL esta conectado.
- `GET /tables`: lista as mesas persistidas e seus estados.
- `GET /products`: lista os produtos ativos do catalogo seedado.
- `POST /tables/:tableId/comandas`: abre uma comanda para uma mesa livre e aceita
  o campo opcional `name`.
- `GET /comandas/:comandaId`: consulta os detalhes da comanda, itens e total.
- `POST /comandas/:comandaId/items`: adiciona produto a uma comanda aberta.
- `PATCH /comandas/:comandaId/items/:itemId`: ajusta quantidade com `+1` ou `-1`.
- `POST /comandas/:comandaId/items/:itemId/confirm`: confirma a quantidade atual.
- `DELETE /comandas/:comandaId/items/:itemId`: remove apenas a quantidade ainda
  nao confirmada.
- `POST /comandas/:comandaId/close`: fecha uma comanda sem itens pendentes e
  libera a mesa.
- `POST /comandas/:comandaId/cancel`: cancela uma comanda vazia aberta por engano.
- `GET/POST /credit-customers`: lista pessoas com saldo/rascunho e cadastra
  pessoas por nome normalizado.
- `GET /credit-customers/:customerId`: consulta pedidos, saldo e quitacoes.
- `POST /credit-customers/:customerId/orders`: cria um fiado manual em rascunho.
- `POST /credit-orders/:orderId/finalize`: finaliza um rascunho sem itens
  pendentes.
- `POST /credit-orders/:orderId/cancel`: cancela um rascunho com auditoria.
- `POST /credit-orders/:orderId/settle`: quita apenas o fiado selecionado.
- `POST /comandas/:comandaId/credit`: fecha uma mesa como fiado e libera a mesa.

Ao confirmar um item, sua quantidade passa a ser o piso imutavel da comanda. Novas
unidades do mesmo produto continuam editaveis ate a proxima confirmacao e aparecem
separadas dos itens imutaveis no aplicativo.

O fechamento grava o status `CLOSED`, a data `closedAt` e um evento `CLOSED`.
Itens, valores e eventos permanecem persistidos para o historico, enquanto a mesa
volta ao estado `FREE`.

Na abertura, o aplicativo permite informar um nome opcional de ate 80 caracteres.
O valor e normalizado, salvo na comanda e exibido na grade de mesas e nos detalhes;
por permanecer na comanda, tambem fica disponivel para o historico futuro.

## Aplicativo mobile

Em outro terminal:

```powershell
Set-Location frontend
npm.cmd install
npm.cmd start
```

Leia o QR code com o Expo Go usando um celular conectado a mesma rede Wi-Fi do
computador.

O menu principal separa **Mesas**, **Fiados** e **Extratos**. Extratos permanece
identificado como "Em breve". Em Fiados, o aplicativo permite cadastrar ou
selecionar uma pessoa, retomar rascunhos, fechar comandas de mesa como divida e
quitar cada fiado individualmente. Fiados em aberto continuam editaveis; a
comanda exibe a data e hora em que cada produto foi adicionado. O detalhe da
pessoa permite filtrar pedidos em aberto e quitados e abrir a comanda completa.

### Compatibilidade do Expo

`expo-modules-core`, `react-native-reanimated` e `react-native-worklets` ficam
declarados explicitamente nas versões compatíveis com o Expo SDK 56. Isso evita
que a resolucao automatica de dependencias do npm selecione uma versao de
`react-native-worklets` incompatível com o `jest-expo`.

## Validacao

Execute antes de abrir uma pull request:

```powershell
Set-Location backend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:seed
npm.cmd run prisma:seed
npm.cmd run test:integration

Set-Location ../frontend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

## Status

Quinta fatia vertical em desenvolvimento: menu principal, comandas de mesa,
catalogo e quantidades confirmadas, alem de fiados manuais ou convertidos de mesa,
saldo agrupado por pessoa, quitacao individual e preservacao do historico financeiro.
