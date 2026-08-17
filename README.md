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
npm.cmd run dev
```

Cadastre primeiro o estabelecimento e seu primeiro owner. Informe a senha
somente na sessão atual do PowerShell:

```powershell
$senha = Read-Host "Senha inicial" -AsSecureString
$env:USER_PROVISION_PASSWORD = [Net.NetworkCredential]::new("", $senha).Password
npm.cmd run establishment:provision
Remove-Item Env:\USER_PROVISION_PASSWORD
```

O provisionamento cria as 12 mesas, o catálogo e o primeiro usuário com papel
`OWNER`. Para cadastrar outros owners ou funcionários dentro de um
estabelecimento existente, carregue a nova senha da mesma forma e execute:

```powershell
$senha = Read-Host "Senha inicial" -AsSecureString
$env:USER_PROVISION_PASSWORD = [Net.NetworkCredential]::new("", $senha).Password
npm.cmd run user:provision
Remove-Item Env:\USER_PROVISION_PASSWORD
```

O comando solicita o estabelecimento, o nome e os cargos e grava diretamente no
MySQL. Não existe tela de criação de conta no aplicativo. Um estabelecimento
pode ter vários owners, e todo usuário pertence obrigatoriamente a um
estabelecimento. Os cargos iniciais são `OWNER`,
`MANAGER`, `WAITER` e `KITCHEN`; cargos e permissões são tabelas relacionais, de
modo que outros poderão ser adicionados posteriormente. O módulo de delivery é
liberado para `OWNER`, `MANAGER` e `WAITER` pelas permissões `deliveries.read` e
`deliveries.write`.

A API fica disponivel em `http://localhost:3333`:

- `GET /health`: confirma que a API esta online.
- `GET /ready`: confirma que o MySQL esta conectado.
- `POST /auth/login`: autentica nome e senha e cria uma sessão opaca.
- `GET /auth/me`: retorna estabelecimento, usuário, cargos e permissões da sessão.
- `POST /auth/logout`: revoga a sessão atual.
- `GET /tables`: lista as mesas persistidas e seus estados.
- `GET /products`: lista os produtos e categorias ativos do cardapio.
- `GET /admin/menu`: lista categorias e itens ativos e inativos para gestao.
- `POST/PATCH/DELETE /admin/categories`: cria, edita e desativa categorias.
- `POST/PATCH/DELETE /admin/products`: cria, edita e desativa itens com nome,
  descricao, categoria e preco em centavos.
- `GET /inventory`: lista ingredientes, saldo atual e estoque minimo.
- `POST /ingredients`: cadastra um ingrediente e cria seu saldo inicial zerado.
- `POST /inventory/:stockId/entries`: registra compra com lote, custo total,
  validade opcional e `requestId`.
- `POST /inventory/:stockId/movements`: registra retirada, perda ou ajuste
  idempotente com motivo e usuario responsavel.
- `POST /tables/:tableId/comandas`: abre uma comanda para uma mesa livre e aceita
  o campo opcional `name`.
- `GET /comandas/:comandaId`: consulta os detalhes da comanda, itens e total.
- `POST /comandas/:comandaId/items`: adiciona produto a uma comanda aberta.
- `PATCH /comandas/:comandaId/items/:itemId`: ajusta quantidade com `+1` ou `-1`.
- `POST /comandas/:comandaId/items/:itemId/confirm`: confirma a quantidade atual.
- `POST /comandas/:comandaId/cancel`: cancela comanda vazia ou, com motivo,
  `requestId` e destino dos insumos, cancela integralmente uma comanda aberta.
- `DELETE /comandas/:comandaId/items/:itemId`: remove apenas a quantidade ainda
  nao confirmada.
- `POST /comandas/:comandaId/close`: recebe `payments` com parcelas em dinheiro,
  Pix, cartao de debito ou credito e `customerId` quando restar saldo. O fechamento
  libera a mesa e mantem a comanda aberta enquanto existir fiado.
- `POST /comandas/:comandaId/cancel`: cancela uma comanda vazia aberta por engano.
- `GET/POST /credit-customers`: lista pessoas com saldo/rascunho e cadastra
  pessoas por nome normalizado.
- `GET /credit-customers/:customerId`: consulta pedidos, pagamentos, total pago e
  saldo restante.
- `POST /credit-customers/:customerId/orders`: cria um fiado manual em rascunho.
- `POST /credit-orders/:orderId/finalize`: finaliza um rascunho sem itens
  pendentes.
- `POST /credit-orders/:orderId/cancel`: cancela um rascunho com auditoria.
- `POST /credit-orders/:orderId/settle`: registra uma parcela parcial ou integral,
  com uma ou mais formas de pagamento, apenas no fiado selecionado.
- `POST /comandas/:comandaId/credit`: endpoint mantido para compatibilidade com o
  fluxo anterior de conversao integral em fiado.
- `GET/POST /delivery/couriers`: lista entregadores ativos com o dia em aberto e o
  total ja recebido, e cadastra um entregador por nome normalizado.
- `GET /delivery/couriers/:courierId?from=AAAA-MM-DD&to=AAAA-MM-DD`: consulta os
  dias do entregador, com filtro opcional de periodo e os totais pagos e a pagar.
- `POST /delivery/couriers/:courierId/days`: inicia um dia informando o valor da
  diaria em centavos. Cada entregador tem no maximo um dia aberto por vez.
- `GET /delivery/days/:dayId`: consulta o dia com entregas, despesas e o acerto.
- `POST /delivery/days/:dayId/deliveries`: registra uma entrega com nome do
  cliente, endereco, produtos opcionais, valor total, taxa de entrega e forma de
  pagamento.
- `POST /delivery/days/:dayId/expenses`: registra uma despesa do dia, como
  combustivel, que e deduzida do valor a pagar ao entregador.
- `POST /delivery/days/:dayId/close`: fecha o dia e grava o acerto pago.
- `GET /statements?from=AAAA-MM-DD&to=AAAA-MM-DD`: consulta indicadores,
  totais diarios e movimentacoes com os produtos historicos do periodo no fuso
  `America/Sao_Paulo`. O resumo inclui os recebimentos conciliados por dinheiro,
  Pix, cartao de debito, cartao de credito e valores antigos sem forma registrada.
  Nas movimentacoes de fiado, `creditTotalCents`, `creditPaidBeforeCents`,
  `creditPaidAfterCents`, `creditBalanceAfterCents`, `paymentOrigin` e
  `tableCheckoutPaidCents` distinguem o valor pago na comanda do valor recebido
  posteriormente no fiado.
- `GET /statements/export.pdf?from=AAAA-MM-DD&to=AAAA-MM-DD&view=summary|detailed`:
  exporta o extrato resumido ou detalhado. Sem `view`, o detalhado e usado para
  manter compatibilidade. O detalhado aceita os filtros opcionais
  `movementType=ALL|SALES|RECEIPTS|CANCELLATIONS` e
  `origin=ALL|TABLE|CREDIT_MANUAL|CREDIT_TABLE`.

Somente `/health`, `/ready` e `/auth/login` são públicos. Todas as demais rotas
exigem `Authorization: Bearer <token>` e validam permissões no backend. Senhas
são derivadas com `scrypt`, cada sessão pode ser revogada e usuários inativos
não conseguem autenticar. Eventos de comanda e o log geral de auditoria guardam
o `establishmentId`, o `userId`, a ação, o recurso e a data/hora. O
estabelecimento usado nas consultas vem exclusivamente da sessão autenticada;
mesas, produtos, comandas, fiados e extratos não aceitam um tenant informado
pelo cliente. Ingredientes, saldos e movimentos de estoque seguem a mesma regra.
As relacoes operacionais mais sensiveis tambem possuem chaves compostas no MySQL,
impedindo vinculos entre estabelecimentos mesmo em gravacoes diretas no banco.

Ao confirmar um item, sua quantidade passa a ser o piso imutavel da comanda. Novas
unidades do mesmo produto continuam editaveis ate a proxima confirmacao e aparecem
separadas dos itens imutaveis no aplicativo.

O fechamento usa uma unica colecao `payments`, por exemplo:

```json
{
  "payments": [
    { "method": "CASH", "amountCents": 2000 },
    { "method": "PIX", "amountCents": 1500 }
  ],
  "customerId": "obrigatorio somente quando restar saldo"
}
```

Os meios aceitos sao `CASH`, `PIX`, `DEBIT_CARD` e `CREDIT_CARD`. Valores
repetidos do mesmo meio sao agregados, o total recebido nunca pode exceder o
saldo e nao ha calculo de troco. Sem saldo, a comanda recebe `CLOSED`, `closedAt`
e evento `CLOSED`. Com saldo, o fiado preserva total, pago e restante; comanda e
fiado continuam abertos para novos itens e parcelas, embora a mesa volte a
`FREE`. A parcela final grava `SETTLED`/`settledAt` no fiado e
`CLOSED`/`closedAt` na comanda na mesma transacao.

Cada pagamento e imutavel e inclui horario, operador e o rateio por meio. Registros
migrados sem meio conhecido continuam visiveis como forma de pagamento nao
informada. O extrato registra a venda integral quando a mesa vira fiado, mas
reconhece como recebido apenas cada pagamento efetivo, sem duplicar a receita na
quitacao final.

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

O menu principal separa **Mesas**, **Fiados**, **Delivery** e
**Administrativo**. Em Delivery, o gestor cadastra entregadores e inicia um dia
informando o valor da diaria. Dentro do dia, cada entrega registra nome do
cliente, endereco, produtos opcionais, valor total, taxa de entrega e forma de
pagamento; despesas como combustivel sao deduzidas do acerto. O valor a pagar ao
entregador e a diaria somada as taxas menos as despesas, e o fechamento do dia
grava esse acerto com data, hora e operador. A tela do entregador mostra o total
ja recebido e permite filtrar o historico por periodo. A taxa de entrega esta
incluida no valor total pago pelo cliente, de modo que o liquido do bistro e o
total menos a taxa. No modulo
administrativo, o extrato abre no dia atual e o gestor pode criar, editar,
desativar e reativar categorias e itens do cardapio. Cada item pertence a uma
categoria do mesmo estabelecimento, e os valores sao persistidos como centavos
inteiros e formatados em reais somente na interface. Em Fiados, o
aplicativo permite cadastrar ou selecionar uma pessoa, retomar rascunhos e pagar
cada fiado individualmente. A tela unica de fechamento aceita pagamento integral,
misto, parcial ou tudo em fiado; a pessoa e exigida somente quando restar saldo.
Fiados em aberto continuam editaveis, inclusive depois de pagamentos parciais. A
comanda exibe o historico de recebimentos e a data e hora em que cada produto foi
adicionado. O detalhe da pessoa mostra total, pago e restante, permite filtrar
pedidos em aberto e quitados e abrir a comanda completa.

Antes do menu, o aplicativo exige login. A sessão fica no `expo-secure-store` no
Android/iOS e os módulos são exibidos conforme as permissões do usuário.
`KITCHEN` pode consultar mesas, comandas e itens confirmados sem alterar valores;
o histórico da comanda identifica o operador e o horário de cada evento.

Em Extrato do dia, um unico calendario permite manter o dia atual ou selecionar
outro dia ou intervalo. A aba **Resumido** apresenta valores vendidos e recebidos,
diferenca do periodo, ticket medio, comandas, itens e totais por origem e dia. A
aba **Detalhado** organiza uma linha do tempo por comanda, identifica cada etapa
como comanda paga parcialmente, fiado aberto, fiado pago parcialmente, fiado
fechado ou entrega paga. Cada etapa explicita total, valor pago, valor aberto e
pagamentos anteriores conforme o contexto. As entregas entram como receita na
data em que foram registradas, conciliadas pela forma de pagamento informada, e
exibem total, taxa de entrega e liquido do bistro. A visualizacao pode
ser filtrada por tipo de movimentacao e origem, incluindo a origem Delivery; os
mesmos filtros sao aplicados
ao PDF detalhado. O botao de exportacao gera o PDF correspondente a aba ativa no
navegador, Android ou iOS, incluindo pagamentos legados sem meio informado.

### Compatibilidade do Expo

`expo-modules-core`, `react-native-reanimated` e `react-native-worklets` ficam
declarados explicitamente nas versões compatíveis com o Expo SDK 56. Isso evita
que a resolucao automatica de dependencias do npm selecione uma versao de
`react-native-worklets` incompatível com o `jest-expo`.

`react-native-calendars` fornece a selecao visual do periodo.
`@expo/vector-icons` renderiza no Android, iOS e web os mesmos glifos Font
Awesome usados no design do Figma, sem depender de imagens remotas temporarias.
`expo-file-system` e `expo-sharing` permitem baixar e compartilhar o PDF no
dispositivo. `expo-secure-store` preserva o token de sessão no armazenamento
protegido do Android/iOS. No backend, `pdfkit` gera o documento diretamente em
memoria, sem arquivos temporarios. Os lockfiles registram as versoes resolvidas.

### Auditoria de dependencias do frontend

Execute `npm.cmd run audit:production` dentro de `frontend` para verificar as
dependencias usadas em producao. O comando continua bloqueando qualquer
vulnerabilidade alta ou critica. Temporariamente, somente os advisories
`GHSA-w3rx-r6r6-pgpr` e `GHSA-5p2g-fcmc-qvqq` do `image-size` sao aceitos,
porque ainda nao existe uma versao corrigida publicada. A remocao dessa excecao
esta acompanhada pela issue
[#64](https://github.com/x3sc/destiny-bistro-crm/issues/64).

## Limpeza operacional

O comando abaixo apaga comandas, itens, eventos, clientes e fiados, libera todas
as mesas e preserva categorias do cardapio, produtos, mesas, usuários, cargos e permissões:

```powershell
Set-Location backend
$env:RESET_OPERATIONAL_DATA = "CONFIRMAR"
$env:RESET_OPERATIONAL_ESTABLISHMENT = "Nome exato do estabelecimento"
npm.cmd run data:reset:operational
Remove-Item Env:\RESET_OPERATIONAL_DATA
Remove-Item Env:\RESET_OPERATIONAL_ESTABLISHMENT
```

Ele é protegido por confirmação explícita e não deve ser executado na VPS sem
backup verificado. A limpeza afeta somente o estabelecimento informado e preserva
seus ingredientes, saldos, movimentos, produtos, mesas, usuarios, cargos e
permissoes.

## Módulo de estoque

O administrativo possui a área **Estoque** para consultar saldos, estoque baixo,
déficits, lotes, vencimentos e movimentações. Também permite cadastrar insumos e
registrar entradas, retiradas, perdas e ajustes. Quantidades de massa e volume são
armazenadas em gramas e mililitros; custos e preços permanecem em centavos.

Receitas e adicionais são administrados pelas rotas de cardápio. A confirmação de
um item consome a ficha técnica e os adicionais por FEFO, sem utilizar lotes
vencidos. Saldo insuficiente não bloqueia a venda: a API devolve
`inventoryWarnings`, mantém o saldo negativo e registra o déficit. Novas mutações
de estoque, personalização e cancelamento exigem `requestId` idempotente.
Saldos anteriores ao ledger são preservados por migration como lotes `LEGACY`.

As decisões de ledger, concorrência, FEFO e cancelamento estão registradas em
[`docs/adrs/0001-inventory-ledger-fefo.md`](docs/adrs/0001-inventory-ledger-fefo.md).

## Implantação em VPS

Os arquivos `compose.vps.yaml`, `backend/Dockerfile` e `frontend/Dockerfile`
preparam MySQL, API e frontend web. O procedimento completo, incluindo HTTPS,
migrations, provisionamento do primeiro usuário e atualizações, está em
[`deploy/README.md`](deploy/README.md).

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

Módulos operacionais de mesas, crédito, delivery e estoque integrados, com
autenticação por usuário, permissões, auditoria, ledger por lote e preparação para
implantação controlada em VPS.
