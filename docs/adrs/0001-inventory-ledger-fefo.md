# ADR 0001: ledger de estoque, FEFO e idempotência

- Status: aceito
- Data: 2026-08-16

## Contexto

O PDV confirma itens por mesas, crédito e delivery, inclusive em dispositivos concorrentes. O estoque precisa manter rastreabilidade por lote, aceitar déficit sem bloquear a venda e preservar os valores históricos de adicionais e cancelamentos.

## Decisão

- Quantidades são inteiros em unidade-base: unidade, grama ou mililitro. Valores monetários são centavos inteiros.
- Toda entrada, confirmação, ajuste ou cancelamento cria uma `InventoryOperation` identificada por chave idempotente única no estabelecimento.
- Movimentos são imutáveis e registram saldo anterior e posterior. A alocação física fica em `InventoryMovementLot`.
- O consumo bloqueia os estoques em ordem determinística e seleciona lotes válidos por FEFO; lotes sem validade vêm depois dos lotes com validade.
- Lotes vencidos continuam consultáveis, mas não são consumidos.
- Falta de saldo gera o movimento integral, saldo negativo, déficit e alerta; não bloqueia a confirmação da venda.
- Entradas reduzem primeiro o déficit e disponibilizam apenas o restante.
- Adicionais e configurações guardam nome e preço como snapshot da venda.
- Cancelamentos nunca apagam o consumo original: devolução cria reversão e perda preserva o consumo.
- O reset operacional desvincula a referência opcional à comanda, mas preserva operações e movimentos do ledger.

## Consequências

O histórico pode reconciliar consumo, devolução e perdas mesmo após mudanças de receita. As mutações precisam ocorrer em transação MySQL e o cliente deve fornecer uma chave idempotente. Consultas de saldo e lote são mais detalhadas, mas não dependem de reconstruir o estoque a partir de comandas.
