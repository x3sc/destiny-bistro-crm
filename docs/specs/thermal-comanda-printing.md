# Impressão térmica de comandas

## Objetivo

O aplicativo mobile imprime diretamente em impressoras térmicas ESC/POS de
80 mm conectadas à mesma rede local. O envio usa RAW TCP, com endereço e porta
configurados por dispositivo. O padrão é `192.168.1.100:9100`.

A interface segue o protótipo criado no Stitch. O papel e todo o conteúdo
impresso usam exclusivamente preto e branco; as cores do CRM aparecem apenas
nos controles da tela.

## Documentos

`GET /comandas/:comandaId/print-document?kind=CONFIRMED` retorna todas as
quantidades confirmadas da comanda, incluindo configurações, adicionais,
valores, taxa de entrega e total.

`GET /comandas/:comandaId/print-document?kind=KITCHEN_PENDING` retorna somente
o delta ainda não confirmado dos itens cujo snapshot `requiresKitchen` é
verdadeiro. Esse documento não contém preços. A impressão não confirma itens,
não cria tickets e não altera a comanda.

Quando não há linhas aplicáveis, a API responde `409`. Comandas de outro
estabelecimento são tratadas como não encontradas. Os documentos sempre são
montados novamente a partir do estado persistido antes da prévia.

## Permissão e uso

A rota e os controles exigem `printing.write`. A migration concede a permissão
a `OWNER`, `MANAGER`, `WAITER` e `KITCHEN`; cargos personalizados não são
alterados automaticamente.

O operador escolhe manualmente entre "Imprimir comanda" e "Imprimir cozinha",
confere a prévia e confirma o envio. Uma nova ação repete a impressão e pode
gerar uma segunda via, por isso a tela exibe esse aviso antes do envio.

## Transporte

O módulo Expo local abre uma conexão TCP, envia uma única carga ESC/POS e fecha
a conexão sem repetição automática. O conteúdo usa 48 colunas, caracteres
compatíveis com a impressora, avanço de papel e corte total.

A integração nativa está disponível em Android e iOS e requer um development
build ou build instalado do aplicativo; não funciona no Expo Go. A versão web
oculta os controles de impressão nesta etapa. No iOS, o aplicativo declara a
finalidade de acesso à rede local.

As configurações ficam somente no dispositivo: `expo-secure-store` em Android
e iOS e `localStorage` como implementação de armazenamento para futuro suporte
web. Nenhuma credencial ou dado operacional é salvo com a configuração.


## Balcão: impressão por destinatário

Confirmar significa entregar ao cliente. O Balcão oferece impressão manual em
build nativo, com `printing.write` e acesso de leitura à origem da comanda.

- No topo dos itens em aberto: **Imprimir pendentes para o cliente** e
  **Imprimir pendentes para o balcão**. Cada ação imprime uma única via.
- Junto aos itens confirmados: **Imprimir conferência final para o cliente** e
  **Imprimir conferência final para o balcão**. Cada ação imprime uma única via.
- Os quatro botões mostram Balcão, número da comanda e nome do cliente. Se não
  houver nome, indicam cliente não identificado, sem tornar o nome obrigatório.

`kind=COUNTER_PENDING` continua retornando todas as quantidades não entregues,
incluindo produtos sem cozinha, com preços, adicionais e subtotal sem taxa de
serviço. As duas ações de pendentes desaparecem quando não há pendências.

`kind=COUNTER_FINAL` continua retornando todos os entregues e o total vigente.
Exige comanda aberta, com entregues e sem pendências; caso contrário responde
`409`. As duas ações finais ficam desabilitadas enquanto houver pendências.

A escolha de destinatário é local ao frontend e não muda o contrato da API. O
mesmo documento carregado é usado na prévia, no envio e na repetição após falha.
Cada ação envia uma via e um corte. O gerador preserva o modo padrão de duas
vias para chamadas sem destinatário; os quatro botões sempre selecionam um.

Cada via imprime Balcão, número da comanda, nome do cliente (ou identificação
não informada), data/hora, configurações/adicionais e valores. A via do cliente
na final informa apresentar ao caixa; a do balcão informa controle. A final
substitui a conferência anterior. Nenhuma das vias comprova pagamento.

Imprimir não entrega itens, movimenta estoque, cria pagamento ou fecha comanda.
Novos pedidos bloqueiam a final até entregar ou cancelar os pendentes. Atualizar
a comanda invalida a prévia. Uma falha permite repetir manualmente a mesma via;
falhas parciais de TCP podem causar duplicação física, sem reenvio automático.
O modelo atual não possui observação livre por item; adicionais são impressos.
