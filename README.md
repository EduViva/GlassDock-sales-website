# Site do GlassDock

Página de vendas, entrega do download e programa de indicação (50% por venda).

- **Cloudflare Worker**: serve as páginas de `public/` e a API (`src/worker.js`)
- **Supabase**: banco (pedidos, indicadores, comissões, PIX enviados) e o `GlassDock.exe` num bucket privado
- **Mercado Pago**: Checkout Pro com PIX e cartão

## Páginas

| Rota | O que é |
|---|---|
| `/` | Página de vendas |
| `/indique` | Cadastro do indicador, link curto e painel com visitas, vendas e o próximo PIX |
| `/fulano` | A página de vendas com "Fulano te indicou o GlassDock" (guarda a indicação por 60 dias) |
| `/obrigado?pedido=…` | Confirma o pagamento e libera o download. O link é do cliente para sempre |
| `/baixar/<pedido>` | Baixa o .exe (só para pedido pago) por um link assinado de 5 minutos |
| `/admin` | Vendas, indicadores e a lista de PIX da semana (pede a `ADMIN_KEY`) |

## Como a compra funciona

1. O botão Comprar chama `POST /api/checkout`, que cria o pedido no Supabase e uma preferência no Mercado Pago com `external_reference` = id do pedido.
2. O cliente paga no Mercado Pago e volta para `/obrigado?pedido=…`.
3. A confirmação chega por dois caminhos, o que vier primeiro:
   - o aviso (webhook) do Mercado Pago em `/api/webhook`, conferido pela assinatura `x-signature`;
   - a própria página de obrigado, que pergunta ao Mercado Pago (`/v1/payments/search`) se o aviso ainda não chegou.

   Nos dois casos o servidor lê o pagamento direto da API do Mercado Pago e nunca confia no corpo do aviso.
4. Reembolso ou contestação (`refunded`, `charged_back`) cancela o pedido e a comissão que ainda não foi paga.

## Comissões

- Cada venda pelo link vale 50% para quem indicou (R$ 4,45).
- A comissão espera 7 dias, que é o prazo de arrependimento, e entra no PIX da **primeira segunda-feira depois desses 7 dias**. Exemplo: compra na segunda 9/11, 7 dias em 16/11, PIX na segunda 23/11. Compras de terça 10/11 a domingo 15/11 também caem em 23/11.
- Não tem valor mínimo.
- Compra feita com o mesmo e-mail do indicador não gera comissão.

### Como o PIX sai

O Mercado Pago não oferece para contas comuns uma API para mandar PIX a terceiros, então o envio é feito por você:

1. Na segunda, abra `/admin`. A seção **PIX desta semana** mostra cada indicador com o valor e a chave PIX, com botões de copiar.
   Antes de montar a lista, o servidor confere no Mercado Pago se alguma dessas vendas foi devolvida.
2. Mande o PIX pelo app do banco ou do Mercado Pago.
3. Clique em **Paguei**. As comissões viram pagas e aparecem no painel do indicador.

Toda a lógica fica no banco (`gd_due` e `gd_pay`). Se um dia houver uma API de envio de PIX liberada, basta chamar `gd_pay` depois de cada envio para automatizar.

## Banco (Supabase)

A migração está em `supabase/migrations/20261110000000_init.sql` e já foi aplicada no projeto `GlassDock`. Ela cria:

| Objeto | Para quê |
|---|---|
| `referrers` | Indicadores: nome, e-mail, chave PIX, link (`slug`) e o segredo do painel |
| `orders` | Pedidos, com o pagamento do Mercado Pago |
| `commissions` | Uma linha por venda indicada, com a segunda-feira em que deve ser paga (`payout_on`) |
| `payouts` | Os PIX enviados |
| `gd_due` | Visão do que vence até hoje, um total por indicador |
| `gd_mark_paid`, `gd_mark_refunded`, `gd_pay` | Funções que alteram tudo de uma vez, sem pagar ou contar duas vezes |
| bucket `releases` | Bucket privado do `GlassDock.exe` |

Todas as tabelas têm RLS ligado e nenhuma policy: só o servidor, com a chave secreta, lê e escreve.

## Publicar

### 1. Mercado Pago

1. Em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app), crie uma aplicação do tipo Checkout Pro.
2. Copie o **Access Token de produção**.
3. Em **Webhooks**, cadastre `https://SEU-DOMINIO/api/webhook` com o evento **Pagamentos** e copie a **assinatura secreta**.
4. Confira se a conta tem uma chave PIX cadastrada, senão o PIX não aparece no checkout.

### 2. Supabase

Envie o `GlassDock.exe` para o bucket **releases** em Storage. Para lançar uma versão nova, substitua o arquivo com o mesmo nome: todos os clientes passam a baixar a nova pelo mesmo link.

### 3. Cloudflare

```bash
npm install
```

```bash
npx wrangler login
```

Guarde os segredos (cada comando pede o valor):

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
```

```bash
npx wrangler secret put MP_ACCESS_TOKEN
```

```bash
npx wrangler secret put MP_WEBHOOK_SECRET
```

```bash
npx wrangler secret put ADMIN_KEY
```

`SUPABASE_SECRET_KEY` é a Secret key do projeto (Project Settings › API Keys). `ADMIN_KEY` é uma senha longa que você inventa para o `/admin`.

```bash
npx wrangler deploy
```

Depois, em Workers › glassdock › Domínios, ligue o seu domínio. Os links de indicação ficam `seudominio.com.br/nome`.

## Testar no seu computador

Crie um `.dev.vars`:

```
FAKE_PAY=1
ADMIN_KEY=uma-chave-local-com-16-letras
SUPABASE_SECRET_KEY=sb_secret_...
```

```bash
npm run dev
```

Com `FAKE_PAY=1` o botão Comprar marca o pedido como pago na hora, sem passar pelo Mercado Pago. Nunca ponha `FAKE_PAY` em produção.

O teste de ponta a ponta roda o worker no Node contra o Supabase de verdade, usando um indicador e pedidos com nomes de teste:

```bash
SUPABASE_SECRET_KEY=sb_secret_... node test/e2e.mjs
```

## Ajustes em `wrangler.toml`

| Variável | Padrão | Para quê |
|---|---|---|
| `PRICE_CENTS` | 890 | Preço cobrado |
| `COMMISSION_PERCENT` | 50 | Comissão do indicador |
| `HOLD_DAYS` | 7 | Dias de espera antes da segunda-feira de pagamento |
| `EXE_KEY` | GlassDock.exe | Nome do arquivo no bucket `releases` |
