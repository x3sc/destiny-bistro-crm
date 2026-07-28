import { normalizeApiBaseUrl } from './api-base-url';

export const PRODUCT_CATEGORY_OPTIONS = [
  { label: 'Hambúrgueres clássicos', value: 'CLASSIC_BURGERS' },
  { label: 'Hambúrgueres artesanais', value: 'ARTISAN_BURGERS' },
  { label: 'Adicionais', value: 'EXTRAS' },
  { label: 'Bebidas', value: 'BEVERAGES' },
  { label: 'Drinks', value: 'COCKTAILS' },
  { label: 'Cervejas', value: 'BEERS' },
  { label: 'Batatas e nuggets', value: 'SIDES' },
  { label: 'Petiscos', value: 'SNACKS' },
  { label: 'Combos', value: 'COMBOS' },
  { label: 'Outros', value: 'OTHER' },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORY_OPTIONS)[number]['value'];

export interface Product {
  category: ProductCategory;
  id: string;
  name: string;
  priceCents: number;
}

function isProductCategory(value: unknown): value is ProductCategory {
  return PRODUCT_CATEGORY_OPTIONS.some(({ value: category }) => category === value);
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const product = value as Partial<Product>;

  return (
    isProductCategory(product.category) &&
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    Number.isInteger(product.priceCents)
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
  const response = await fetch(`${requireApiBaseUrl(apiBaseUrl)}/products`);

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
