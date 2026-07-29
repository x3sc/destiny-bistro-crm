# Implantação em VPS

Este procedimento publica a API e o frontend web com Docker Compose. MySQL,
API e frontend ficam em redes separadas; somente as portas locais `3333` e
`8080` são abertas no host. O acesso externo deve passar pelo Nginx com HTTPS.

## Pré-requisitos

- VPS Linux com Docker Engine e Docker Compose;
- Nginx e Certbot instalados no host;
- registros DNS `A`/`AAAA` para `api.seu-dominio.com` e
  `crm.seu-dominio.com` apontando para a VPS;
- portas `80` e `443` liberadas no firewall.

Não exponha as portas `3306`, `3333` ou `8080` no firewall.

## Configuração

Na raiz do projeto, crie o arquivo local de produção:

```bash
cp deploy/.env.example deploy/.env.production
chmod 600 deploy/.env.production
```

Edite `deploy/.env.production` e substitua todos os exemplos. Para as senhas do
MySQL, prefira valores hexadecimais longos, que também são seguros dentro da URL
usada pelo Prisma:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

`PUBLIC_API_URL` deve conter a URL HTTPS pública da API, sem barra no final.
`CORS_ORIGINS` aceita uma ou mais origens web separadas por vírgula, por exemplo:

```dotenv
PUBLIC_API_URL=https://api.seu-dominio.com
CORS_ORIGINS=https://crm.seu-dominio.com,https://admin.seu-dominio.com
```

O aplicativo Android/iOS também deve ser compilado com
`EXPO_PUBLIC_API_URL=https://api.seu-dominio.com`. Essa URL é pública e é
incorporada ao bundle do Expo; ela não deve conter credenciais.

Valide a configuração antes de criar containers:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  config --quiet
```

## Primeira subida

```bash
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  up -d --build

docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  ps
```

O container da API espera o MySQL, aplica as migrations e executa o seed
idempotente antes de iniciar. Confirme o acesso local na própria VPS:

```bash
curl --fail http://127.0.0.1:3333/health
curl --fail http://127.0.0.1:3333/ready
```

## Proxy reverso e HTTPS

Copie o exemplo do Nginx e substitua os dois domínios:

```bash
sudo cp deploy/nginx/destiny-bistro.conf.example \
  /etc/nginx/sites-available/destiny-bistro
sudo ln -s /etc/nginx/sites-available/destiny-bistro \
  /etc/nginx/sites-enabled/destiny-bistro
sudo nginx -t
sudo systemctl reload nginx
```

Depois que o DNS estiver respondendo para a VPS, solicite os certificados e
ative o redirecionamento para HTTPS:

```bash
sudo certbot --nginx \
  -d api.seu-dominio.com \
  -d crm.seu-dominio.com \
  --redirect
```

Valide a API externamente:

```bash
curl --fail https://api.seu-dominio.com/health
curl --fail https://api.seu-dominio.com/ready
```

## Criar o estabelecimento e o primeiro owner

Não passe a senha como argumento nem grave-a no histórico do shell. Carregue-a
somente na sessão atual:

```bash
read -s USER_PROVISION_PASSWORD
export USER_PROVISION_PASSWORD
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  exec -e USER_PROVISION_PASSWORD api npm run establishment:provision
unset USER_PROVISION_PASSWORD
```

O comando cria o estabelecimento, o primeiro owner, as mesas e o catálogo
isolados dessa unidade. Para adicionar outros owners ou funcionários, carregue
uma nova senha da mesma forma e execute `npm run user:provision`; o comando
solicita em qual estabelecimento o usuário será cadastrado. Os cargos iniciais
são `OWNER`, `MANAGER`, `WAITER` e `KITCHEN`.

## Backup

Crie um backup antes de qualquer atualização:

```bash
mkdir -p backups
chmod 700 backups
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  exec -T mysql sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --routines --triggers -u root "$MYSQL_DATABASE"' \
  > "backups/destiny-bistro-$(date +%Y%m%d-%H%M%S).sql"
chmod 600 backups/*.sql
```

Guarde uma cópia fora da VPS e teste periodicamente a restauração em um banco
isolado.

## Atualização

Implante somente uma revisão revisada e aprovada. Depois de criar e conferir o
backup:

```bash
git pull --ff-only
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  up -d --build
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  ps
```

Para investigar uma falha sem imprimir o arquivo de ambiente:

```bash
docker compose \
  --env-file deploy/.env.production \
  -f compose.vps.yaml \
  logs --tail=200 api mysql web
```

Nunca execute a limpeza operacional na VPS sem um backup conferido.
