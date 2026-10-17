# Taxa opcional de serviço e conta para conferência

## Escopo e autoridade

Mesas e Venda Rápida abertas, sem vínculo de Fiado, oferecem 10% opcionais,
selecionados inicialmente. O frontend escolhe apenas a inclusão; percentual,
subtotal, taxa e total são calculados pela API sobre configurações confirmadas,
incluindo adicionais. O cálculo usa aritmética inteira, arredondamento único
metade para cima e limite compatível com os inteiros monetários do banco.

Balcão, Delivery e Fiados manuais não admitem a taxa. Históricos sem decisão
persistida permanecem sem taxa. Desmarcar não exige aprovação gerencial.
Permissões são resolvidas pela origem persistida, nunca pelo parâmetro de rota.

## Contratos

- `GET /comandas/:id/checkout-summary`: autenticação e leitura da origem; retorna
  `comanda`, `eligible`, `canClose`, `subtotalCents`, `serviceFee`,
  `totalWithoutServiceFeeCents`, `totalWithServiceFeeCents` e `expectedSnapshot`.
- `POST /comandas/:id/close`: mantém `payments` e `customerId`; clientes novos
  enviam `includeServiceFee`, `requestId` e `expectedSnapshot` juntos.
  Campos parciais, percentual/valor fornecido pelo cliente e campos desconhecidos
  são rejeitados. Clientes legados que omitam os três campos fecham sem taxa.
- `GET /comandas/:id/print-document?kind=CHECKOUT_PREVIEW&includeServiceFee=true|false&expectedSnapshot=...`:
  exige leitura da origem e `printing.write`; recalcula a conta sob bloqueio de
  leitura, sem recebimento nem encerramento. Snapshot divergente retorna `409`.
  `CONFIRMED` não aceita sobrescrever a taxa persistida.

O snapshot inclui identidade, origem, estado e configurações/quantidades/preços.
O fechamento adquire bloqueio exclusivo da comanda e revalida autorização,
snapshot, pendências e pagamentos. Operação, decisão, pagamento, eventos e
auditoria são atômicos. A chave é única por estabelecimento; fingerprint inclui
operador, recurso, opções e pagamentos. Retry idêntico retorna o resultado salvo;
reutilização incompatível ou snapshot antigo retorna `409`, sem efeitos parciais.
O app conserva a chave em retries de rede do mesmo envio e bloqueia duplo toque.

## Experiência e impressão

A seleção é local: não há gravação por toque. Valores já digitados permanecem;
pagamentos acima do novo total bloqueiam o fechamento e exigem ajuste explícito.
Conflitos bloqueiam novo envio até recarregar e conferir a conta; o botão informa
que os pagamentos digitados serão limpos. Falhas de rede não enfileiram operações.

A conferência apresenta consumo, taxa aplicada/dispensada e total com a indicação
“Conta para conferência — pagamento pendente”. Trocar a seleção após impressão
gera aviso de desatualização. Após fechamento, o comprovante usa apenas valores
gravados, sem nova seleção. A conclusão preserva a limpeza da pilha operacional.
Impressão física depende do módulo térmico e build nativo existentes, com teste
separado em hardware. Expo Go e navegador não ganham suporte de impressão.

## Fiado e extratos

O saldo herdado inclui a taxa uma vez em `CreditOrder.totalCents`. Parcelas não
recalculam a taxa. Posteriores alterações confirmadas recalculam subtotal e taxa
com o percentual persistido, inclusive zero quando dispensada. Temporários não
aumentam a dívida. Redução abaixo do valor já pago é recusada integralmente.
Bloqueios da comanda serializam alterações com liquidação do Fiado.

Eventos `SERVICE_FEE_CHANGED` registram deltas de consumo, taxa e quantidade,
operador e instante; a auditoria registra valores anteriores/posteriores. O
extrato reconhece a venda inicial e ajustes nas respectivas datas, sem reescrever
vendas passadas nem tratar parcelas como novas vendas. Reduções são movimentos
negativos; resumo, exportação PDF e painel usam o mesmo resultado consolidado.

## Migração e recuperação

Três migrações aditivas acrescentam decisão e valores à comanda, operação
idempotente e campos de ledger. Linhas antigas mantêm decisão nula e taxa zero;
nenhum pagamento histórico é modificado. Novos registros de operação devem ser
preservados para retries seguros e auditoria.

Antes da implantação operacional: backup com restauração verificada, validação
no MySQL isolado, autorização do responsável e interrupção dos escritores antigos.
Aplicar as migrações e atualizar API/app de forma coordenada. Manter clientes
antigos é compatível apenas com fechamento sem taxa; não misturar versões de API
que desconhecem os novos totais durante a transição.

Não reverter para uma API que ignore a taxa ou os deltas financeiros depois de
registrar fechamentos novos. Recuperação deve manter as colunas, valores e
idempotência; preferir correção compatível, com gravações suspensas até validar
conciliação. Não apagar registros financeiros para reverter a interface.
