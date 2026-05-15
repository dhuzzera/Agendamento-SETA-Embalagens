# Deploy — SETA Embalagens Agendamento

Este projeto suporta três plataformas de deploy. O build padrão (`npm run build`) continua sendo para **Cloudflare Workers** (plataforma original do Lovable).

---

## Variáveis de Ambiente (todas as plataformas)

| Variável | Onde usar | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend + SSR | URL pública do projeto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend + SSR | Chave anon/pública do Supabase |
| `SUPABASE_URL` | Servidor | URL do Supabase (server-side) |
| `SUPABASE_PUBLISHABLE_KEY` | Servidor | Chave anon (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor | Chave service_role (**secreta**, nunca expor) |
| `DEPLOY_TARGET` | Build | `cloudflare` \| `vercel` \| `render` |

---

## Vercel

### Configuração automática
O arquivo `vercel.json` já está configurado. Basta:

1. Conectar o repositório no [Vercel Dashboard](https://vercel.com/dashboard)
2. Adicionar as variáveis de ambiente no painel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEPLOY_TARGET` = `vercel`
3. O Vercel usará automaticamente `npm run build:vercel`

### Como funciona
- Build: `cross-env DEPLOY_TARGET=vercel vite build`
- O plugin Nitro com preset `vercel` gera o output no formato esperado pelo Vercel
- SSR completo via Vercel Functions (escala automática)

---

## Render

### Configuração automática
O arquivo `render.yaml` já está configurado. Basta:

1. Conectar o repositório no [Render Dashboard](https://dashboard.render.com)
2. Render detecta o `render.yaml` automaticamente
3. Preencher os valores das variáveis marcadas com `sync: false`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Como funciona
- Build: `npm install && npm run build:render`
- Start: `node .output/server/index.mjs`
- O plugin Nitro com preset `node-server` gera um servidor Node.js standalone
- Porta: `10000` (padrão do Render Free)

---

## Cloudflare Workers (padrão Lovable)

```bash
npm run build
npx wrangler deploy
```

Variáveis configuradas via `wrangler.jsonc` ou no painel do Cloudflare Workers.

---

## Scripts disponíveis

| Script | Plataforma |
|---|---|
| `npm run build` | Cloudflare Workers |
| `npm run build:vercel` | Vercel |
| `npm run build:render` | Render / Node.js |
| `npm run start` | Iniciar servidor Node.js (após build:render) |
| `npm run dev` | Desenvolvimento local |
