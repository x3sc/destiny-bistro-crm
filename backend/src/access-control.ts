import type { PrismaClient } from "./generated/prisma/client.js";

export const permissions = {
  COMANDAS_READ: "comandas.read",
  COMANDAS_WRITE: "comandas.write",
  CREDITS_READ: "credits.read",
  CREDITS_WRITE: "credits.write",
  DELIVERIES_READ: "deliveries.read",
  DELIVERIES_WRITE: "deliveries.write",
  INVENTORY_READ: "inventory.read",
  INVENTORY_WRITE: "inventory.write",
  KITCHEN_READ: "kitchen.read",
  KITCHEN_WRITE: "kitchen.write",
  PRODUCTS_READ: "products.read",
  PRODUCTS_WRITE: "products.write",
  PRINTING_WRITE: "printing.write",
  ROLES_MANAGE: "roles.manage",
  STATEMENTS_READ: "statements.read",
  TABLES_READ: "tables.read",
  USERS_MANAGE: "users.manage",
} as const;

export type PermissionCode = (typeof permissions)[keyof typeof permissions];

const permissionDefinitions = [
  [permissions.COMANDAS_READ, "Visualizar comandas"],
  [permissions.COMANDAS_WRITE, "Alterar comandas"],
  [permissions.CREDITS_READ, "Visualizar fiados"],
  [permissions.CREDITS_WRITE, "Alterar fiados"],
  [permissions.DELIVERIES_READ, "Visualizar delivery"],
  [permissions.DELIVERIES_WRITE, "Alterar delivery"],
  [permissions.INVENTORY_READ, "Visualizar estoque"],
  [permissions.INVENTORY_WRITE, "Alterar estoque"],
  [permissions.KITCHEN_READ, "Visualizar cozinha"],
  [permissions.KITCHEN_WRITE, "Alterar cozinha"],
  [permissions.PRODUCTS_READ, "Visualizar produtos"],
  [permissions.PRODUCTS_WRITE, "Gerenciar cardápio"],
  [permissions.PRINTING_WRITE, "Imprimir comandas e pedidos da cozinha"],
  [permissions.ROLES_MANAGE, "Gerenciar cargos e permissões"],
  [permissions.STATEMENTS_READ, "Visualizar e exportar extratos"],
  [permissions.TABLES_READ, "Visualizar mesas"],
  [permissions.USERS_MANAGE, "Gerenciar usuários"],
] as const;

export const systemRoleDefinitions = [
  {
    code: "OWNER",
    description: "Acesso total ao sistema.",
    managerAssignable: false,
    name: "Dono",
    permissions: permissionDefinitions.map(([code]) => code),
  },
  {
    code: "MANAGER",
    description: "Gerencia a operação e usuários operacionais.",
    managerAssignable: false,
    name: "Gerente",
    permissions: [
      permissions.COMANDAS_READ,
      permissions.COMANDAS_WRITE,
      permissions.CREDITS_READ,
      permissions.CREDITS_WRITE,
      permissions.DELIVERIES_READ,
      permissions.DELIVERIES_WRITE,
      permissions.INVENTORY_READ,
      permissions.INVENTORY_WRITE,
      permissions.KITCHEN_READ,
      permissions.KITCHEN_WRITE,
      permissions.PRODUCTS_READ,
      permissions.PRODUCTS_WRITE,
      permissions.PRINTING_WRITE,
      permissions.STATEMENTS_READ,
      permissions.TABLES_READ,
      permissions.USERS_MANAGE,
    ],
  },
  {
    code: "WAITER",
    description: "Opera mesas, comandas e fiados.",
    managerAssignable: true,
    name: "Garçom",
    permissions: [
      permissions.COMANDAS_READ,
      permissions.COMANDAS_WRITE,
      permissions.CREDITS_READ,
      permissions.CREDITS_WRITE,
      permissions.DELIVERIES_READ,
      permissions.DELIVERIES_WRITE,
      permissions.PRODUCTS_READ,
      permissions.PRINTING_WRITE,
      permissions.TABLES_READ,
    ],
  },
  {
    code: "KITCHEN",
    description: "Consulta comandas e itens confirmados.",
    managerAssignable: true,
    name: "Cozinha",
    permissions: [
      permissions.COMANDAS_READ,
      permissions.INVENTORY_READ,
      permissions.KITCHEN_READ,
      permissions.KITCHEN_WRITE,
      permissions.PRODUCTS_READ,
      permissions.PRINTING_WRITE,
      permissions.TABLES_READ,
    ],
  },
] as const;

export async function ensureSystemAccessControl(prisma: PrismaClient) {
  for (const [code, name] of permissionDefinitions) {
    await prisma.permission.upsert({
      create: { code, name },
      update: { name },
      where: { code },
    });
  }

  for (const definition of systemRoleDefinitions) {
    const role = await prisma.role.upsert({
      create: {
        code: definition.code,
        description: definition.description,
        managerAssignable: definition.managerAssignable,
        name: definition.name,
        system: true,
      },
      update: {
        description: definition.description,
        managerAssignable: definition.managerAssignable,
        name: definition.name,
        system: true,
      },
      where: { code: definition.code },
    });
    const rolePermissions = await prisma.permission.findMany({
      select: { id: true },
      where: { code: { in: [...definition.permissions] } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: rolePermissions.map(({ id }) => ({
        permissionId: id,
        roleId: role.id,
      })),
      skipDuplicates: true,
    });
  }
}
