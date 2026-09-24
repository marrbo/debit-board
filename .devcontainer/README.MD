## Visão geral

Este `devcontainer`:

- Monta o código do host dentro do container (edita no Mac, HMR roda no container)
- Isola `node_modules` num volume (não conflita com o do Mac)
- Expõe o **inspector do Node** na porta 9229 para o VSCode fazer attach
- Reaproveita Mongo, Keycloak e cron do `docker-compose.yml` existente (sem duplicar)

## Estrutura de arquivos

```
.
├── .devcontainer/
│   ├── devcontainer.json          ← config principal
│   ├── docker-compose.extend.yml  ← overrides de dev (não toca no prod)
│   └── Dockerfile.dev             ← imagem com npm ci, sem build
├── .vscode/
│   ├── launch.json                ← como o VSCode atacha ao Node
│   ├── tasks.json                 ← tarefas auxiliares
│   └── settings.json              ← config do workspace
├── docker-compose.yml             ← Esse é de publicação. O do devcontainer herda este
└── ...
```

---

## 1. `.devcontainer/Dockerfile.dev`

Não builda o Next, só instala `node_modules`. O `next dev` roda em runtime.

```dockerfile
FROM node:20-alpine

# Ferramentas de debug e conveniências
RUN apk add --no-cache \
    bash \
    curl \
    git \
    vim \
    nano \
    tini \
    mongodb-tools \
    gettext \
    libc6-compat

# Usuário não-root (o VSCode prefere que o workspace tenha um owner previsível)
ARG USERNAME=node
ARG USER_UID=1000
ARG USER_GID=1000
RUN if [ "$(id -u $USERNAME)" != "$USER_UID" ]; then \
        deluser $USERNAME 2>/dev/null || true; \
        addgroup -g $USER_GID $USERNAME && \
        adduser -u $USER_UID -G $USERNAME -s /bin/bash -D $USERNAME; \
    fi

WORKDIR /app

# Permite `npm install` global sem sudo em dev
RUN mkdir -p /home/$USERNAME/.npm-global && \
    chown -R $USERNAME:$USERNAME /home/$USERNAME && \
    echo 'prefix=/home/'$USERNAME'/.npm-global' > /home/$USERNAME/.npmrc

USER $USERNAME

ENV PATH=/home/$USERNAME/.npm-global/bin:$PATH
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# O `tini` garante que sinais (SIGTERM) cheguem ao processo Node corretamente
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sleep", "infinity"]
```

O `CMD ["sleep", "infinity"]` mantém o container vivo — o VSCode atacha e você roda o `npm run dev` de dentro.

---

## 2. `.devcontainer/docker-compose.extend.yml`

Sobrescreve **apenas** o serviço `debitboard-app`. Os outros (Mongo, Keycloak, Keycloak-db, cron) continuam idênticos ao `docker-compose.yml` base.

```yaml
services:
  debitboard-app:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile.dev
      # args não são mais necessários: não buildamos Next aqui
    container_name: debitboard-app-dev
    restart: unless-stopped
    env_file:
      - ../.env.production.local
    environment:
      # Overrides que só fazem sentido dentro da rede Docker
      MONGODB_URI: "mongodb://debitboard-mongo-db:27017/debit-board?replicaSet=rs0"
      KEYCLOAK_ISSUER: "http://debitboard-keycloak:8080/realms/debit-board"
      NEXTAUTH_URL: "http://localhost:3001"
      DB_DUMPS_DIR: "/var/lib/debit-board/dumps"
      # 🔥 Inspector do Node escutando em todas as interfaces
      NODE_OPTIONS: "--inspect=0.0.0.0:9229"
      # Turbopack em Docker precisa disso para o HMR encontrar o host
      WATCHPACK_POLLING: "true"
    ports:
      - "3001:3000" # app
      - "9229:9229" # inspector do Node (para o VSCode atachar)
    volumes:
      # 🔥 Bind mount do código — HMR vê mudanças do host
      - ..:/app:cached
      # 🔥 node_modules e .next ficam em volumes isolados
      #    (evita conflito com o node_modules do Mac)
      - dev_node_modules:/app/node_modules
      - dev_next_cache:/app/.next
      - dumps_data:/var/lib/debit-board/dumps
    # Debugger precisa de ptrace; sem isso o attach falha silenciosamente
    cap_add:
      - SYS_PTRACE
    security_opt:
      - seccomp:unconfined
    depends_on:
      debitboard-mongo-db:
        condition: service_healthy
      debitboard-keycloak:
        condition: service_started
    networks:
      - debitboard-network
    command: sleep infinity

volumes:
  dev_node_modules:
  dev_next_cache:
```

**Pontos-chave:**

| Item                                  | Por quê                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NODE_OPTIONS=--inspect=0.0.0.0:9229` | Faz o inspector escutar em todas as interfaces; `127.0.0.1` só escutaria dentro do container            |
| `WATCHPACK_POLLING=true`              | O filesystem do Docker no Mac não propaga eventos `inotify`; polling resolve o HMR                      |
| `..:/app:cached`                      | Bind mount do código. `cached` otimiza leitura no Mac                                                   |
| `dev_node_modules:/app/node_modules`  | Volume nomeado **por cima** do bind mount. Sem isso, o `node_modules` do Mac sobrescreve o do container |
| `SYS_PTRACE` + `seccomp:unconfined`   | Sem isso, o attach do debugger falha com `EPERM`                                                        |
| `command: sleep infinity`             | Container fica vivo; você roda `npm run dev` de dentro                                                  |

---

## 3. `.devcontainer/devcontainer.json`

Combina os dois composes e aponta para o serviço `debitboard-app`.

```jsonc
{
  "name": "Debit Board (dev)",
  "dockerComposeFile": ["../docker-compose.yml", "docker-compose.extend.yml"],
  "service": "debitboard-app",
  "workspaceFolder": "/app",
  "runServices": [
    "debitboard-mongo-db",
    "debitboard-keycloak-db",
    "debitboard-keycloak",
  ],
  "shutdownAction": "stopCompose",

  // Extensões que fazem sentido no container
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-azuretools.vscode-docker",
        "mongodb.mongodb-vscode",
        "orta.vscode-jest",
        "vitest.explorer",
        "sanity-io.vscode-sanity",
        "eamodio.gitlens",
      ],
      "settings": {
        "typescript.tsdk": "node_modules/typescript/lib",
        "typescript.enablePromptUseWorkspaceTsdk": true,
        "editor.formatOnSave": true,
        "editor.defaultFormatter": "esbenp.prettier-vscode",
        "files.watcherExclude": {
          "**/.next/**": true,
          "**/node_modules/**": true,
          "**/.git/**": true,
        },
      },
    },
  },

  // Setup inicial: instala deps dentro do volume nomeado
  "postCreateCommand": "npm ci",

  // Sobe o dev server automaticamente ao anexar
  "postStartCommand": "npm run dev:docker",

  // Redirecionamento de portas para o browser do host
  "forwardPorts": [3000, 9229],
  "portsAttributes": {
    "3000": { "label": "Next.js", "onAutoForward": "notify" },
    "9229": { "label": "Node Inspector", "onAutoForward": "silent" },
  },

  // O debugger roda por padrão no usuário node (não-root)
  "remoteUser": "node",

  // Aguarda o `npm ci` do postCreateCommand antes de considerar pronto
  "waitFor": "postCreateCommand",
}
```

**Ponto crítico:** o `postCreateCommand` roda **uma vez** na criação do volume `dev_node_modules`. Como o volume é nomeado e persiste, só roda quando o volume é novo.

---

## 4. `.vscode/launch.json`

Duas configs: uma para atachar ao processo em execução (mais simples), outra para lançar o `npm run dev` e já atachar.

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: attach (container)",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "restart": true,
      "skipFiles": ["<node_internals>/**", "node_modules/**"],
      "remoteRoot": "/app",
      "localRoot": "${workspaceFolder}",
      "sourceMaps": true,
      "resolveSourceMapLocations": [
        "${workspaceFolder}/**",
        "!**/node_modules/**",
      ],
      "autoAttachChildProcesses": true,
    },
    {
      "name": "Next.js: launch + attach",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:docker"],
      "port": 9229,
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "restart": true,
      "skipFiles": ["<node_internals>/**", "node_modules/**"],
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "openExternally",
      },
    },
    {
      "name": "Next.js: server-side only",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"],
      "remoteRoot": "/app",
      "localRoot": "${workspaceFolder}",
      "sourceMaps": true,
    },
  ],
}
```

**Como usar:** com o container rodando e o `npm run dev:docker` já executado (o `postStartCommand` faz isso automaticamente), abra **Run and Debug** → escolha **"Next.js: attach (container)"** → F5. O debugger conecta.

Para parar em um breakpoint no server (route handlers, server components), coloque o ponto no arquivo e clique em **Run**. Você não precisa reiniciar — o Turbopack recompila e o attach continua.

---

## 5. `.vscode/tasks.json`

Tarefas que o VSCode pode rodar de dentro do container.

```jsonc
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev: reiniciar servidor",
      "type": "shell",
      "command": "pkill -f 'next dev' || true; sleep 1; npm run dev:docker",
      "problemMatcher": [],
      "presentation": {
        "reveal": "always",
        "panel": "dedicated",
      },
    },
    {
      "label": "db: sincronizar secrets do Keycloak",
      "type": "shell",
      "command": "bash scripts/keycloak-sync-secrets.sh",
      "problemMatcher": [],
    },
    {
      "label": "db: restore dump (último)",
      "type": "shell",
      "command": "ls -t /var/lib/debit-board/dumps | head -1 | xargs -I {} echo 'Run restore manualmente pelo /settings/admin/db-tools: {}'",
      "problemMatcher": [],
    },
    {
      "label": "build: type check",
      "type": "shell",
      "command": "npx tsc --noEmit",
      "problemMatcher": ["$tsc"],
    },
    {
      "label": "test: watch",
      "type": "shell",
      "command": "npm run test:watch",
      "isBackground": true,
      "problemMatcher": [],
    },
  ],
}
```

---

## 6. `.vscode/settings.json`

Ajustes para o devcontainer funcionar suavemente.

```jsonc
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
  },
  "files.watcherExclude": {
    "**/.next/**": true,
    "**/node_modules/**": true,
    "**/.git/**": true,
    "**/dumps/**": true,
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dumps": true,
  },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[javascript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[jsonc]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
}
```

---

## 7. Adicione o script `dev:docker` ao `package.json`

Dentro do container, o `next dev` precisa do inspector na porta exposta:

```jsonc
{
  "scripts": {
    "dev:docker": "node --inspect=0.0.0.0:9229 ./node_modules/.bin/next dev --turbopack --hostname 0.0.0.0 --port 3000",
  },
}
```

Se preferir reaproveitar o `dev` existente sem criar outro script, exporte `NODE_OPTIONS` (já está no compose) e rode `npm run dev`. O problema é que o script atual tem `--experimental-https`, que **não** funciona bem no Docker (a flag gera certificados no host, não no container). Por isso o script dedicado.

---

## 8. Ajustar o `.gitignore`

Adicione volumes locais do devcontainer:

```gitignore
.devcontainer/dev_node_modules/
.vscode/.debug/
```

---

## Passo a passo para rodar

### 1. Criar os arquivos

Salve os 6 arquivos acima nas pastas indicadas.

### 2. Ajustar o `.env.production.local`

**Só o que o Edge Runtime precisa em build** (build não roda no devcontainer, mas o runtime do Next ainda lê):

```bash
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<mesmo do .env.local>
NEXT_PUBLIC_ADMIN_EMAIL=ayslanjohnson@debitboard.com
KEYCLOAK_ISSUER=http://debitboard-keycloak:8080/realms/debit-board
KEYCLOAK_CLIENT_ID=debit-board
KEYCLOAK_CLIENT_SECRET=<valor real>
KEYCLOAK_ADMIN_CLIENT_ID=debitboard-admin-api
KEYCLOAK_ADMIN_CLIENT_SECRET=<valor real>
KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=<valor real>
CRON_TOKEN=<valor real>
```

**Sem `MONGODB_URI`** — essa vai no `environment:` do compose (o `docker-compose.extend.yml` já a define).

### 3. Instalar a extensão **Dev Containers** no VSCode

`Cmd+Shift+X` → buscar "Dev Containers" (ms-vscode-remote.remote-containers) → instalar.

### 4. Abrir o projeto no devcontainer

1. `Cmd+Shift+P` → **"Dev Containers: Reopen in Container"**
2. O VSCode vai:
   - Buildar a imagem `Dockerfile.dev`
   - Subir Mongo, Keycloak, Keycloak-db
   - Montar o código no container
   - Rodar `npm ci` (na primeira vez, ~2 min)
   - Rodar `npm run dev:docker`
3. Quando terminar, o terminal integrado abre dentro do container.

### 5. Verificar que subiu

No terminal do VSCode:

```bash
# Está no container?
hostname
# → debitboard-app-dev

# O dev server está rodando?
curl -s http://localhost:3000 | head -5

# O inspector está escutando?
curl -s http://localhost:9229/json | jq '.[0].title'
```

### 6. Atachar o debugger

1. **Run and Debug** (`Cmd+Shift+D`)
2. Selecione **"Next.js: attach (container)"** no dropdown
3. **F5**

O VSCode mostra no status bar inferior: `Auto Attach: On` ou a barra laranja de "Debugger attached".

### 7. Testar um breakpoint

Abra qualquer route handler (`app/api/stats/route.ts`) e coloque um breakpoint na primeira linha da função `GET`. Faça uma requisição que a execute (ex.: acesse a página que a chama). O VSCode pausa na linha.

---

## Debugando cada parte

### Server Components / Route Handlers

Breakpoint normal funciona. Coloque o ponto em:

- `app/api/**/route.ts` — handlers de API
- `app/**/page.tsx` no corpo do componente — server component
- `lib/**` — funções chamadas pelo servidor

### Client Components

Só funcionam no **browser**, não no Node. Use o DevTools do Chrome normalmente:

- `F12` → Sources → Breakpoints
- Ou configure `debugger;` no código

Se quiser, o `launch.json` acima também pode ter uma config `type: "chrome"`:

```jsonc
{
  "name": "Next.js: Chrome (cliente)",
  "type": "chrome",
  "request": "launch",
  "url": "http://localhost:3001",
  "webRoot": "${workspaceFolder}",
}
```

### Console.log no server

Os `console.log` do server aparecem no **Terminal do VSCode** (não no Console do browser). Se estiver debugando via attach, também aparecem no **Debug Console**.

### Mongo dentro do devcontainer

O VSCode pode rodar comandos `mongosh` direto:

```bash
mongosh "mongodb://debitboard-mongo-db:27017/debit-board?replicaSet=rs0" \
  --eval "db.observations.countDocuments()"
```

Ou use a extensão **MongoDB for VSCode** (já incluída nas extensões) → Connect → cole a URI.

### Keycloak

Acesse de dentro do container:

```bash
curl -s http://debitboard-keycloak:8080/realms/debit-board/.well-known/openid-configuration | jq .issuer
```

Do host (fora do container):

```
http://localhost:8080
```

---

## Troubleshooting

### "npm run dev:docker: command not found"

Você não adicionou o script ao `package.json`. Confira a seção 7.

### HMR não detecta mudanças

O `WATCHPACK_POLLING=true` deve resolver. Se ainda assim não funcionar, verifique se o bind mount está correto:

```bash
# Dentro do container
ls -la /app/package.json
# Deve mostrar o mesmo arquivo que está no Mac
```

### Attach do debugger falha com `EPERM`

Falta `SYS_PTRACE` + `seccomp:unconfined` no `docker-compose.extend.yml`. Adicione e faça rebuild:

```bash
docker compose -f docker-compose.yml -f .devcontainer/docker-compose.extend.yml up -d --build debitboard-app
```

### `npm ci` demora demais toda vez

O volume `dev_node_modules` só é populado na primeira criação. Se ele foi apagado, o `postCreateCommand` roda de novo. Não apague o volume sem motivo.

Para reconstruir de propósito:

```bash
docker volume rm debit-board_dev_node_modules
# Depois: Dev Containers: Rebuild and Reopen in Container
```

### Erro de permissão nos arquivos

O container roda como `node` (UID 1000). No Mac, seu usuário normalmente também é 1000 — arquivos criados pelo container ficam com owner correto. Em Linux, ajuste o `USER_UID` no `Dockerfile.dev` para o `id -u` do seu host.

### `MONGODB_URI: connect ECONNREFUSED 127.0.0.1`

O `.env.production.local` ainda tem `MONGODB_URI` com valor de dev. Remova — o `environment:` do compose passa o valor certo.

### `unauthorized_client` no login

O secret do Keycloak divergiu. Rode a task do VSCode **"db: sincronizar secrets do Keycloak"** (ou o script direto).

---

## Resumo

| Feature                              | Onde está                                | Como usar                   |
| ------------------------------------ | ---------------------------------------- | --------------------------- |
| Container de dev com Node + debugger | `Dockerfile.dev`                         | Auto                        |
| Compose com bind mount + inspector   | `docker-compose.extend.yml`              | Auto                        |
| VSCode attach ao Node                | `.vscode/launch.json`                    | F5 com "attach (container)" |
| Tarefas rápidas                      | `.vscode/tasks.json`                     | `Cmd+Shift+P → Run Task`    |
| Dev server auto-start                | `devcontainer.json` → `postStartCommand` | Auto ao anexar              |

Depois de configurado, o fluxo é: **abre o VSCode → Reopen in Container → F5 → breakpoint funcionando**. Sem `docker compose up` manual, sem editar `.env` a cada mudança, sem adivinhar por que o container não enxerga o Mongo.
