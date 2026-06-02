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
- `POST /tables/:tableId/comandas`: abre uma comanda para uma mesa livre.
- `GET /comandas/:comandaId`: consulta os detalhes da comanda.
- `POST /comandas/:comandaId/cancel`: cancela uma comanda vazia aberta por engano.

## Aplicativo mobile

Em outro terminal:

```powershell
Set-Location frontend
npm.cmd install
npm.cmd start
```

Leia o QR code com o Expo Go usando um celular conectado a mesma rede Wi-Fi do
computador.

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

Terceira fatia vertical em desenvolvimento: abertura confirmada de comandas,
detalhes somente leitura, auditoria das transicoes e cancelamento de comandas
vazias abertas por engano.
