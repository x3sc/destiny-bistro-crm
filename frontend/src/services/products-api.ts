import { normalizeApiBaseUrl } from './api-base-url';
import { authenticatedFetch } from './auth-session';

export interface Product {
  additionals?: {
    active: boolean;
    code: string;
    id: string;
    name: string;
    priceCents: number;
  }[];
  category: { id: string; name: string };
  description: string | null;
  id: string;
  name: string;
  priceCents: number;
  requiresKitchen: boolean;
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const product = value as Partial<Product>;

  return (
    !!product.category &&
    typeof product.category === 'object' &&
    typeof product.category.id === 'string' &&
    typeof product.category.name === 'string' &&
    (product.description === null || typeof product.description === 'string') &&
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    Number.isInteger(product.priceCents) &&
    typeof product.requiresKitchen === 'boolean' &&
    (product.additionals === undefined ||
      (Array.isArray(product.additionals) && product.additionals.every(
        (additional) =>
          additional &&
          typeof additional === 'object' &&
          typeof additional.id === 'string' &&
          typeof additional.name === 'string' &&
          Number.isInteger(additional.priceCents),
      )))
  );
}

function requireApiBaseUrl(value: string) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(value);

  if (!normalizedApiBaseUrl) {
    throw new Error('Missing API URL');
  }

  return normalizedApiBaseUrl;
}

export async function loadProducts(apiBaseUrl: string) {
  const response = await authenticatedFetch(`${requireApiBaseUrl(apiBaseUrl)}/products`);

  if (!response.ok) {
    throw new Error('Products request failed');
  }

  const payload: unknown = await response.json();
  const products = (payload as { products?: unknown }).products;

  if (!Array.isArray(products) || !products.every(isProduct)) {
    throw new Error('Invalid products response');
  }

  return products;
}
