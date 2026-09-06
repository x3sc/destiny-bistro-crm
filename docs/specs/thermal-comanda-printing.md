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
