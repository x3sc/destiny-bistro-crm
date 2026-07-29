# Implantação em VPS

## Preparação

Instale Docker Engine, Docker Compose e configure HTTPS em um proxy reverso. A
API fica vinculada somente a `127.0.0.1`; publique-a pelo proxy em
`PUBLIC_API_URL`. O frontend fica disponível em `WEB_PORT`.

Copie o exemplo e substitua todas as credenciais:

```bash
cp deploy/.env.example deploy/.env.production
chmod 600 deploy/.env.production
```

`deploy/.env.production` é local e não deve ser commitido.

## Primeira subida

```bash
docker compose --env-file deploy/.env.production -f compose.vps.yaml up -d --build
docker compose --env-file deploy/.env.production -f compose.vps.yaml ps
```

O container da API aplica migrations e o seed idempotente antes de iniciar.

## Criar usuário diretamente no banco

Não passe a senha como argumento. Carregue-a apenas na sessão atual:

```bash
read -s USER_PROVISION_PASSWORD
export USER_PROVISION_PASSWORD
docker compose --env-file deploy/.env.production -f compose.vps.yaml exec \
  -e USER_PROVISION_PASSWORD api npm run user:provision
unset USER_PROVISION_PASSWORD
```

O comando solicita nome e cargos. Os cargos iniciais são `OWNER`, `MANAGER`,
`WAITER` e `KITCHEN`.

## Atualização

```bash
git pull --ff-only
docker compose --env-file deploy/.env.production -f compose.vps.yaml up -d --build
```

Faça backup do volume MySQL antes de atualizações e nunca execute a limpeza
operacional na VPS sem um backup conferido.
