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
- Android Studio ou build nativo para testar a impressão térmica; o Expo Go
  continua suficiente para as telas que não usam o módulo de impressão

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

O comando solicita o estabelecimento, o nome e um único cargo e grava diretamente no
MySQL. No aplicativo, **Administrativo → Usuários → Novo usuário** permite criar
acessos com nome, senha e um cargo local, inclusive personalizado. Exige
`users.manage`, respeitando o alcance do operador. A senha deve ter de 8 a 128 caracteres; o nome de acesso deve
ter de 2 a 80 e ser único no sistema. O novo acesso funciona no login atual.
Criação e troca do cargo pela API são auditadas na mesma transação. Consulte os
[contratos e limites](docs/specs/user-administration.md).

Um estabelecimento
pode ter vários owners, e todo usuário pertence obrigatoriamente a um
estabelecimento. Os cargos iniciais são `OWNER`,
`MANAGER`, `WAITER` e `KITCHEN`, locais por estabelecimento. Em **Administrativo →
Cargos**, quem tem `roles.manage` cria e ajusta grupos operacionais dentro do seu
próprio alcance. Somente o Dono delega gestão de cargos/usuários; o cargo Dono é
protegido. Cargos vinculados a usuários, inclusive inativos, não podem ser excluídos.
Venda Rápida e Balcão exigem `quick-sales.read/write` e `counter-sales.read/write`,
independentemente de Mesas; Fiados utiliza `credits.read/write`, sem exigir o nome
Gerente. Sessões refletem alterações na próxima requisição; a interface atualiza
acessos ao voltar ao aplicativo, navegar e receber `403`.
A impressão térmica exige `printing.write`, concedida inicialmente a `OWNER`,
`MANAGER`, `WAITER` e `KITCHEN`. Cargos personalizados não recebem a permissão
automaticamente.

A migração `20261016120000_tenant_roles` adiciona a estrutura local, converte os
acessos efetivos legados (sem promover Gerentes a administradores), preserva a
união de múltiplos cargos e torna o vínculo local obrigatório. Execute somente
com API/CLI antigos parados, backup verificado e a versão nova pronta para subir.
Não reverta apenas o código para a autorização global antiga, pois ela pode ampliar
acessos revogados. Os seeds não sobrescrevem cargos locais personalizados.
Detalhes de implantação e recuperação: [Cargos e permissões](docs/specs/tenant-roles.md).

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
  descricao, categoria, preco em centavos e a flag `requiresKitchen`.
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
- `GET /comandas/:comandaId/print-document?kind=CONFIRMED|KITCHEN_PENDING`:
  prepara o documento atual da comanda completa ou somente dos itens de cozinha
  ainda não confirmados, sem alterar ou confirmar a comanda.
- `GET /kitchen/tickets`: lista tickets pendentes, em preparo e prontos do
  estabelecimento autenticado, dos mais antigos para os mais novos.
- `GET /kitchen/tickets/:ticketId`: consulta o snapshot de um envio.
- `PATCH /kitchen/tickets/:ticketId/status`: avanca o preparo ou cancela um
  ticket conforme a maquina de estados da cozinha.
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

A numeração visível das comandas pertence ao estabelecimento e à data local de
abertura em `America/Sao_Paulo`. Cada estabelecimento reinicia a sequência em `1`
na primeira abertura de um novo dia. `openedDate` permanece imutável mesmo quando
a comanda atravessa a meia-noite, enquanto `openedAt` preserva o instante exato.
As telas de mesas, venda rápida e detalhes exibem a data e hora de abertura para
diferenciar comandas de dias distintos com o mesmo número. A migração
`20260928120000_daily_comanda_numbering` preserva os números históricos e inicializa
o contador de cada data pelo maior número já emitido, sem renumerar registros.

Ao confirmar um item, sua quantidade passa a ser o piso imutavel da comanda. Novas
unidades do mesmo produto continuam editaveis ate a proxima confirmacao e aparecem
separadas dos itens imutaveis no aplicativo. Produtos marcados para preparo geram
um ticket somente com o novo delta confirmado e com snapshots das configuracoes e
adicionais. Esse envio ocorre na mesma transacao do estoque, confirmacao e
auditoria.

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
npm.cmd run dev
```

Esse comando inicia um unico Metro em modo LAN e limpa bundles antigos. No mesmo
terminal, pressione `a` para abrir o emulador Android e leia o QR code com o
celular conectado a mesma rede do computador. Ambos usam o endereço definido em
`EXPO_PUBLIC_API_URL`; por isso, para atender os dois ao mesmo tempo, configure o
IP LAN do computador em vez de `10.0.2.2`, que funciona somente no emulador.

O menu principal separa **Mesas**, **Fiados**, **Delivery**, **Cozinha** e
**Administrativo**. A Cozinha apresenta uma fila operacional atualizada a cada
30 segundos enquanto a tela esta em foco. Em Delivery, o gestor cadastra entregadores e inicia um dia
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
O fechamento usa o layout Stitch com formas de pagamento em grade, atalho para
preencher o saldo sem enviar, limpeza do valor, resumo dos valores informados e
itens recolhiveis. Os pagamentos so sao registrados ao confirmar; o rodape separa
pagamento integral e saldo em fiado conforme permissao. Nao ha calculo de troco,
taxa de servico ou integracao fiscal nesta entrega visual.
Ao concluir pagamento, conversao em fiado ou cancelamento, o aplicativo limpa
as telas operacionais concluidas da pilha de navegacao. O voltar nativo retorna
pelas listas da origem e pelo Inicio, sem reabrir o checkout ou a comanda anterior.
Fiados em aberto continuam editaveis, inclusive depois de pagamentos parciais. A
comanda exibe o historico de recebimentos e a data e hora em que cada produto foi
adicionado. O detalhe da pessoa mostra total, pago e restante, permite filtrar
pedidos em aberto e quitados e abrir a comanda completa.

Antes do menu, o aplicativo exige login. A sessão fica no `expo-secure-store` no
Android/iOS e os módulos são exibidos conforme as permissões do usuário.
`KITCHEN` recebe `kitchen.read` e `kitchen.write` para consultar a fila e
avancar o preparo sem alterar valores financeiros;
o histórico da comanda identifica o operador e o horário de cada evento.

Na tela da comanda, usuários com `printing.write` podem imprimir em uma térmica
ESC/POS de 80 mm pela rede local. "Imprimir comanda" inclui tudo que já foi
confirmado e seus valores; "Imprimir cozinha" inclui somente o delta não
confirmado dos itens marcados para preparo e não mostra preços. O papel é gerado
em preto e branco, com 48 colunas e corte total. IP e porta são configurações
locais do dispositivo, inicialmente `192.168.1.100:9100`. O transporte nativo
funciona em Android e iOS e exige um development build ou aplicativo instalado,
não o Expo Go. A versão web não exibe esses controles nesta etapa. Consulte
`docs/specs/thermal-comanda-printing.md` para o contrato completo.

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

O frontend usa o Expo SDK 57 e React Native 0.86.3. As dependencias nativas
sao alinhadas com `npx expo install --check`; `expo-font` fica declarado
diretamente porque e exigido por `@expo/vector-icons`. `expo-system-ui` aplica
o tema automatico no Android. `@react-native/jest-preset` atende ao peer do
`jest-expo` 57. O modulo da impressora termica acessa
`requireNativeModule` pela API publica do pacote `expo`.

`react-native-calendars` fornece a selecao visual do periodo.
`@expo/vector-icons` renderiza no Android, iOS e web os mesmos glifos Font
Awesome usados no design do Figma, sem depender de imagens remotas temporarias.
`expo-file-system` e `expo-sharing` permitem baixar e compartilhar o PDF no
dispositivo. `expo-secure-store` preserva o token de sessão no armazenamento
protegido do Android/iOS. No backend, `pdfkit` gera o documento diretamente em
memoria, sem arquivos temporarios. Os lockfiles registram as versoes resolvidas.

### Auditoria de dependencias do frontend

Execute `npm.cmd run audit:production` dentro de `frontend` para verificar as
dependencias usadas em producao. O comando bloqueia qualquer vulnerabilidade
alta ou critica, inclusive os antigos advisories de `image-size`. O Expo SDK 57
removeu `image-size` do grafo instalado nesta versao do projeto.

## Limpeza operacional

O comando abaixo apaga comandas, itens, eventos, clientes, fiados e os contadores
diários de comandas do estabelecimento, libera todas
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

Set-Location ../frontend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
```

Os testes de integração limpam os estabelecimentos criados pela própria suíte.
Por segurança, execute-os somente em um banco dedicado cujo nome contenha
`integration` ou `test`, confirmando explicitamente a limpeza:

```powershell
Set-Location backend
$env:DATABASE_URL = "mysql://integration_user:integration_password@127.0.0.1:3309/destiny_bistro_integration"
$env:DATABASE_HOST = "127.0.0.1"
$env:DATABASE_PORT = "3309"
$env:DATABASE_USER = "integration_user"
$env:DATABASE_PASSWORD = "integration_password"
$env:DATABASE_NAME = "destiny_bistro_integration"
$env:ALLOW_INTEGRATION_DB_RESET = "1"

npm.cmd run prisma:migrate:deploy
npm.cmd run test:integration
```

A suíte recusa a execução antes de qualquer limpeza se essas proteções não
estiverem presentes.


## Status

Módulos operacionais de mesas, crédito, delivery e estoque integrados, com
autenticação por usuário, permissões, auditoria, ledger por lote e preparação para
implantação controlada em VPS.

Fiados: somente os perfis `OWNER` e `MANAGER`, com as respectivas permissões,
podem acessar clientes/fiados e fechar comandas com saldo em fiado. `WAITER` e
`KITCHEN` não veem a navegação nem acessam as rotas de fiados. O garçom
continua podendo fechar comandas com pagamento integral, inclusive misto.
A API aplica a restrição mesmo se o banco ainda contiver permissões antigas.

### Venda rápida

No menu principal, **Venda rápida** abre uma comanda pelo nome do cliente (obrigatório, até 80 caracteres), sem ocupar mesa. As vendas em aberto podem ser pesquisadas pelo cliente ou número e retomadas nessa tela. Produtos, adicionais, confirmação, estoque, cozinha, cancelamento, impressão e pagamento usam o fluxo normal da comanda; o saldo pode virar fiado para usuários autorizados.

A comanda persiste `name` com o cliente, `tableId = NULL` e `tableName = "Venda rápida"`. Não existe mesa fictícia. A origem financeira é `QUICK_SALE` / `QUICK_SALE_CHECKOUT`, identificada no extrato e nos recibos. Vendas convertidas em fiado passam a ser acompanhadas em **Fiados**. As mesas existentes continuam funcionando como antes.

A API adiciona `GET /quick-sales` (comandas abertas do estabelecimento, permissão `comandas.read`) e `POST /quick-sales` (`{ "name": "Maria" }`, permissão `comandas.write`). A resposta de abertura contém `{ comanda }`, com `table: null` e `tableName: "Venda rápida"`; a listagem contém `{ comandas }`. Aplique a migração `20260916120000_quick_sales` com `npm run prisma:migrate:deploy` dentro de `backend` antes de iniciar a API atualizada. A migração adiciona um campo opcional e amplia as origens financeiras, preservando os registros existentes.

### Taxa opcional e impressão da conta

No fechamento de **Mesas e Venda rápida**, a opção **Incluir taxa de serviço de
10%** vem marcada. O servidor calcula consumo, taxa e total em centavos; alternar
a seleção não envia requisições e preserva os pagamentos digitados. Se os valores
ultrapassarem o novo total, ajuste-os antes de confirmar. Balcão, Delivery e Fiados
criados diretamente não recebem essa taxa; registros antigos não são recalculados.

Com `printing.write`, **Imprimir conta** prepara uma conferência com pagamento
pendente, sem fechar a comanda nem registrar recebimento. A impressão física usa
o build nativo e a impressora térmica existentes; não funciona no Expo Go ou Web.
Se a opção mudar após imprimir, imprima novamente. O comprovante de uma comanda
encerrada usa exclusivamente os valores persistidos.

O saldo convertido em Fiado inclui a taxa escolhida uma única vez. Consumo
confirmado posterior mantém o percentual escolhido, com ajustes datados no
extrato. Parcelas apenas liquidam a dívida. Não é permitido reduzir o total abaixo
do que já foi recebido.

Esta entrega exige as migrações aditivas `20261017090000_optional_service_fee`,
`20261017091000_service_fee_consumption_ledger` e
`20261017092000_service_fee_item_ledger`. **Não executar no banco operacional sem
backup verificado e janela de implantação autorizada.** Contratos, compatibilidade
e recuperação: [Taxa de serviço](docs/specs/optional-service-fee.md).

### Balcão — pagamento no sistema externo

O Menu oferece **Balcão** separadamente de Venda rápida. Uma nova comanda recebe
número automático e abre o catálogo sem exigir nome; a identificação pode ser
informada nos detalhes. Quantidades temporárias são locais, inteiras de 1 a 99;
**Adicionar N itens** salva os lançamentos e **Cancelar** descarta os temporários.
Confirme a entrega dos itens antes de concluir a venda.

A impressão do Balcão é manual e separada por destinatário. No topo dos itens
em aberto, **Imprimir pendentes para o cliente** e **Imprimir pendentes para o
balcão** imprimem uma via cada, com todos os pendentes e seus valores. Essas
ações desaparecem quando não há pendências. Junto aos itens confirmados,
**Imprimir conferência final para o cliente** e **Imprimir conferência final
para o balcão** imprimem uma via cada e só são liberadas sem pendências e com
itens entregues. Os quatro botões identificam Balcão, cliente e número da
comanda; o comprovante identifica também seu destinatário. Sem nome informado,
a identificação mostra cliente não identificado.

A via final do cliente é para apresentar ao caixa; a do balcão fica para
controle. Imprimir mantém a comanda aberta e não comprova pagamento. Novos
pedidos bloqueiam a final até tratar as novas pendências; a próxima conferência
substitui a anterior. Repetir o envio pode duplicar a via selecionada. Requer
build nativo com ThermalPrinter e `printing.write`.

**Concluir venda** exige confirmação do operador: o app registra a comanda como
fechada e paga integralmente por **Balcão (caixa externo)**. O backend calcula o
valor e não recebe preço, método ou estabelecimento do cliente. Não há integração
ou confirmação automática pelo caixa externo, taxa de serviço, pagamento misto
ou conversão em Fiado neste fluxo. Comandas vazias, com total não positivo ou
itens pendentes não podem ser concluídas. Concluídas ficam somente para consulta.

Contratos autenticados e tenant-scoped:

- `POST /counter-sales`: `{ requestId }`, abre a comanda.
- `GET /counter-sales?status=OPEN`: lista todas as abertas; `status=CLOSED&date=AAAA-MM-DD`
  lista as concluídas no dia de São Paulo, inicialmente hoje.
- `PUT /counter-sales/:id/name`: `{ name }`, identificação opcional de até 80 caracteres.
- `POST /counter-sales/:id/complete`: `{ requestId, expectedSnapshot }`, conclui
  integralmente. Use o `counterSnapshot` retornado pela comanda; ele identifica
  os itens conferidos e não permite alterar o valor calculado pelo servidor.

Abertura e conclusão persistem `requestId` por estabelecimento. Repetições da
mesma operação não duplicam comanda, pagamento ou auditoria; reutilização com
outro operador, ação, recurso ou revisão retorna `409`. Se os itens mudarem,
recarregue a comanda e confira novamente antes de confirmar. Não há fila offline.
São usadas `comandas.read` e `comandas.write`; as exigências existentes para
cancelamento de confirmados, estoque, cozinha e impressão são preservadas.

A origem financeira é `COUNTER` / `COUNTER_CHECKOUT`, e o meio é `COUNTER`,
exibido como Balcão no extrato, PDF e comprovante existente. Os valores entram
uma vez nas vendas e recebimentos registrados, separados de Dinheiro/Pix/Cartão.
Ao concluir ou cancelar, a navegação remove as telas operacionais da pilha.

Antes de iniciar a API atualizada, aplique `npm.cmd run prisma:migrate:deploy`
dentro de `backend`. A migração `20261016090000_add_counter_sales` amplia os enums
e adiciona o registro de idempotência, sem reclassificar vendas históricas.
Atualize API e app em conjunto. Um rollback deve preservar a leitura dos novos
enums e os registros financeiros; não remova esses dados para reverter a interface.

### Retorno seguro no aplicativo

Os botões Voltar e o retorno nativo do Android usam a mesma política: histórico
seguro primeiro, pai lógico do fluxo quando não houver histórico válido e Início
como último destino. No Início, o Android pede confirmação antes de sair.
Pagamentos e cancelamentos concluídos continuam removendo as etapas operacionais
da pilha; consultar uma venda fechada não permite reabrir sua operação.

Ao sair do catálogo com um rascunho local, escolha continuar editando ou descartar
e voltar. Esse descarte não grava requisições nem remove itens já persistidos.
O botão Cancelar do catálogo mantém sua operação própria de descarte dos itens
temporários salvos. Gravações críticas bloqueiam a saída até sucesso ou falha.

A política considera permissões e dados carregados da operação, sem usar a origem
informada na URL como autorização. No Expo Web há proteção da navegação interna
e aviso de saída com alterações locais; o navegador controla fechar a aba.
