## Banco de dados

O schema base do projeto esta em [`supabase-schema.sql`](./supabase-schema.sql).

Esta etapa prepara o banco para operacao real com:

- `condominiums`: base para multi-condominio.
- `units`: unidades por condominio.
- `residents`: cadastro de moradores.
- `deliveries`: encomendas, agora com colunas de vinculacao e auditoria.
- `delivery_status_history`: trilha de mudanca de status.
- `notification_attempts`: historico de tentativas de notificacao.

Para aplicar no Supabase:

```sql
-- execute o conteudo de supabase-schema.sql
```

Em 22/04/2026 este schema foi aplicado no projeto Supabase remoto via MCP e registrado nas migrations remotas como:

- `20260422204101_initial_delivery_management_schema`
- `20260422204111_harden_set_updated_at_search_path`

Observacao: as tabelas operacionais ficam com RLS habilitado e policy de bloqueio direto para `anon/authenticated`, porque o app atual usa `service role` apenas no backend.

Observacao: o app atual grava auditoria em `delivery_status_history`, registra tentativas de notificacao em `notification_attempts` e ja opera com contexto explicito de condominio na interface.

Observacao: o fluxo principal de encomendas ja pode vincular `resident_id` e `unit_id` quando a base operacional do condominio estiver cadastrada.

Observacao: esta versao inclui operadores autenticados, memberships por condominio, sessao por cookie e retirada por QR com auditoria.

## Operacao autenticada

- `app/login/page.tsx`: acesso do operador
- `app/definir-senha/page.tsx`: definição inicial de senha por link enviado ao cliente
- `app/primeiro-acesso/page.tsx`: configuração inicial do condomínio após o primeiro login
- `app/retirada/page.tsx`: leitura e validacao de retirada por QR
- `app/q/[token]/page.tsx`: QR apresentado ao morador

## Verificacao e go-live

- Matriz funcional: [`docs/functional-audit.md`](./docs/functional-audit.md)
- Checklist operacional: [`docs/go-live-checklist.md`](./docs/go-live-checklist.md)

## Aplicacao

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Deploy na VPS com Docker

Este projeto foi preparado para subir em um container isolado, sem afetar os outros servicos ja rodando na VPS.

### Arquivos adicionados

- [`Dockerfile`](./Dockerfile)
- [`docker-compose.vps.yml`](./docker-compose.vps.yml)
- [`.dockerignore`](./.dockerignore)

### Passo a passo

1. Copie o projeto para a VPS em uma pasta separada.
2. Crie um arquivo `.env.production` com as mesmas chaves da `.env.example`.
3. Suba com uma porta nova, sem conflitar com os containers atuais:

```bash
docker compose --env-file .env.production -f docker-compose.vps.yml up -d --build
```

### Porta usada

- Container interno: `3000`
- Porta exposta na VPS: `3001`

Se voce quiser publicar em outro dominio ou colocar nginx/traefik na frente, aponte para `127.0.0.1:3001`.
