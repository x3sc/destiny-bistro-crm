import { fireEvent, render, screen } from '@testing-library/react-native';

import { PaymentForm } from '../payment-form';

function selectMethod(paymentNumber: number, method: string) {
  fireEvent.press(
    screen.getByRole('button', { name: `Forma de pagamento ${paymentNumber}` }),
  );
  fireEvent.press(
    screen.getByRole('button', {
      name: `Selecionar ${method} no pagamento ${paymentNumber}`,
    }),
  );
}

it('submits one allocation for each informed payment method', () => {
  const onSubmit = jest.fn();

  render(
    <PaymentForm
      allowZero={false}
      maxCents={3500}
      onSubmit={onSubmit}
      submitLabel="Confirmar"
    />,
  );

  expect(screen.queryByRole('button', { name: /Adicionar outra forma/ })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 1'), '2000');
  selectMethod(1, 'Dinheiro');
  fireEvent.press(screen.getByRole('button', { name: /Adicionar outra forma/ }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 2'), '1500');
  selectMethod(2, 'Pix');
  expect(screen.getByText('Pago: R$ 35,00')).toBeTruthy();
  expect(screen.getByText('Restante: R$ 0,00')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Adicionar outra forma/ })).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
  expect(onSubmit).toHaveBeenCalledWith([
    { amountCents: 2000, method: 'CASH' },
    { amountCents: 1500, method: 'PIX' },
  ]);
});

it('limits an informed value to the total still available', () => {
  const onSubmit = jest.fn();
  render(
    <PaymentForm
      allowZero={false}
      maxCents={1000}
      onSubmit={onSubmit}
      submitLabel="Confirmar"
    />,
  );

  expect(screen.getByRole('button', { name: 'Confirmar' }).props.accessibilityState)
    .toMatchObject({ disabled: true });
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 1'), '1001');
  selectMethod(1, 'Pix');
  expect(screen.getByLabelText('Valor do pagamento 1').props.value).toBe('R$ 10,00');
  expect(screen.getByText('Restante: R$ 0,00')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
  expect(onSubmit).toHaveBeenCalledWith([{ amountCents: 1000, method: 'PIX' }]);
});

it('limits a second payment to the balance left by the first one', () => {
  const onSubmit = jest.fn();
  render(
    <PaymentForm
      allowZero={false}
      maxCents={10000}
      onSubmit={onSubmit}
      submitLabel="Confirmar"
    />,
  );

  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 1'), '6000');
  selectMethod(1, 'Dinheiro');
  fireEvent.press(screen.getByRole('button', { name: /Adicionar outra forma/ }));
  fireEvent.changeText(screen.getByLabelText('Valor do pagamento 2'), '100000');
  selectMethod(2, 'Pix');

  expect(screen.getByLabelText('Valor do pagamento 2').props.value).toBe('R$ 40,00');
  expect(screen.getByText('Pago: R$ 100,00')).toBeTruthy();
  expect(screen.getByText('Restante: R$ 0,00')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }));
  expect(onSubmit).toHaveBeenCalledWith([
    { amountCents: 6000, method: 'CASH' },
    { amountCents: 4000, method: 'PIX' },
  ]);
});

it('accepts zero only when explicitly allowed', () => {
  const onSubmit = jest.fn();

  render(
    <PaymentForm
      allowZero
      maxCents={1000}
      onSubmit={onSubmit}
      submitLabel="Tudo em fiado"
    />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Tudo em fiado' }));
  expect(onSubmit).toHaveBeenCalledWith([]);
});
