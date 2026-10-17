import { authenticatedFetch, configureAuthenticatedFetch } from '../auth-session';
afterEach(() => configureAuthenticatedFetch(null));
it('requests permission refresh on 403 without logging out', async () => {
  const unauthorized = jest.fn(), forbidden = jest.fn();
  configureAuthenticatedFetch('token-current', unauthorized, forbidden);
  globalThis.fetch = jest.fn(async () => ({ status: 403 }) as Response);
  await authenticatedFetch('http://localhost:3333/admin/roles');
  expect(forbidden).toHaveBeenCalledTimes(1);
  expect(unauthorized).not.toHaveBeenCalled();
});
it('ignores authentication failures from requests belonging to an older session', async () => {
  let finish!: (response: Response) => void;
  globalThis.fetch = jest.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
  configureAuthenticatedFetch('old-token');
  const pending = authenticatedFetch('http://localhost:3333/tables');
  const unauthorized = jest.fn(), forbidden = jest.fn();
  configureAuthenticatedFetch('new-token', unauthorized, forbidden);
  finish({ status: 401 } as Response);
  await pending;
  expect(unauthorized).not.toHaveBeenCalled();
  expect(forbidden).not.toHaveBeenCalled();
});
