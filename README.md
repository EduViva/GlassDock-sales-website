# Site do GlassDock

Página de vendas, entrega do download e programa de indicação (50% por venda).

- **Cloudflare Worker**: serve as páginas de `public/` e a API (`src/worker.js`)
- **Supabase**: banco (pedidos, indicadores, comissões, PIX enviados) e o `GlassDock.exe` num bucket privado
- **Mercado Pago**: Checkout Transparente (API Orders), só PIX, com o QR code dentro do próprio site

## Páginas

| Rota | O que é |
|---|---|
| `/` | Página de vendas |
| `/indique` | Cadastro do indicador, link curto e painel com visitas, vendas e o próximo PIX |
| `/fulano` | A página de vendas com "Fulano te indicou o GlassDock" (guarda a indicação por 60 dias) |
| `/obrigado?pedido=…` | Mostra o QR code e o PIX copia e cola, confirma o pagamento e libera o download |
| `/baixar` | Baixar de novo: o cliente põe o e-mail da compra e recebe um link novo |
| `/baixar/<token>` | Link temporário de download (24 h). Expirado, leva para `/baixar` |
| `/admin` | Vendas, reembolso e reenvio do link por pedido, indicadores e a lista de PIX da semana (pede a `ADMIN_KEY`) |

## Como a compra funciona

1. O botão Comprar pede o e-mail (o Mercado Pago exige) e chama `POST /api/checkout`.
2. O servidor cria o pedido no Supabase e uma order Pix no Mercado Pago (`POST /v1/orders`, `processing_mode: automatic`, PIX válido por 30 minutos) com `external_reference` = id do pedido.
3. O cliente vai para `/obrigado?pedido=…`, que mostra o QR code e o copia e cola e fica esperando.
4. A confirmação chega por dois caminhos, o que vier primeiro:
   - o aviso (webhook, tópico **Order**) em `/api/webhook`, conferido pela assinatura `x-signature`;
   - a própria página, que consulta `GET /v1/orders/{id}` a cada 3 segundos.

   Nos dois casos o servidor lê a order direto da API do Mercado Pago e nunca confia no corpo do aviso. Paga = `processed` / `accredited`.
5. `refunded`, `charged_back` ou reembolso parcial cancelam o pedido e a comissão que ainda não foi paga. PIX vencido (`canceled`, `expired`, `failed`) marca o pedido como expirado.

## Download

- Quando o pagamento é confirmado, o servidor cria um link `/baixar/<token>` que vale por 24 horas (`DOWNLOAD_HOURS`). Ele aparece na página de pagamento e vai por e-mail: pelo Gmail (sem domínio próprio) ou pelo [Resend](https://resend.com) (com domínio próprio).
- Expirado, o link leva para `/baixar`. Ali o cliente põe o e-mail da compra e recebe um link novo. A resposta é a mesma com ou sem compra, para não revelar quem comprou, e sai no máximo um e-mail a cada 2 minutos.
- No `/admin`, **Reenviar link** gera um link novo, manda por e-mail e copia o link para você.

### Configurar o e-mail

**Sem domínio próprio (Gmail):** use uma conta Gmail só para o GlassDock.
1. Ative a verificação em duas etapas da conta em myaccount.google.com › Segurança.
2. Crie uma senha de app em myaccount.google.com/apppasswords (nome: GlassDock). Ela tem 16 letras.
3. No Cloudflare, adicione os secrets `GMAIL_USER` (o endereço Gmail) e `GMAIL_APP_PASSWORD` (a senha de app).

O Gmail manda até cerca de 500 e-mails por dia.

**Com domínio próprio (Resend):** verifique o domínio no Resend e adicione `RESEND_API_KEY` e `EMAIL_FROM` (ex.: `GlassDock <download@seudominio.com.br>`). Se os dois estiverem configurados, o Gmail tem prioridade: apague `GMAIL_USER` para passar a usar o Resend.

## Reembolso

No `/admin`, cada pedido pago tem **Reembolsar**. O servidor:

1. lê a order no Mercado Pago e só segue se ela estiver `processed` / `accredited`;
2. chama `POST /v1/orders/{id}/refund` sem corpo (reembolso total), com um `X-Idempotency-Key` novo a cada tentativa. Clique duplo não reembolsa duas vezes, porque o Mercado Pago recusa um segundo reembolso da mesma order;
3. lê a order de novo e, se ficou reembolsada (`refunded`, ou `processed` com detalhe `refunded`), marca o pedido como reembolsado, desliga o download e cancela a comissão que ainda não foi paga.

No PIX o valor volta para a conta de quem pagou. O reembolso sai do **saldo disponível** da sua conta Mercado Pago: sem saldo, o Mercado Pago recusa com `422 Post processing rejected the operation`, e o admin mostra esse motivo.

## Comissões

- Cada venda pelo link vale 50% para quem indicou (R$ 5,95).
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

1. Em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app), crie uma aplicação de **Pagamentos online** com **Checkout Transparente** (API Orders).
2. Em **Credenciais › Produção**, ative o ambiente de produção e copie o **Access Token**.
3. Em **Webhooks**, no modo **Produção**, cadastre `https://SEU-DOMINIO/api/webhook` com o evento **Order (Mercado Pago)** e copie a **assinatura secreta**.
4. Confira se a conta tem uma chave PIX cadastrada, senão o PIX não é gerado.

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
| `PRICE_CENTS` | 1190 | Preço cobrado |
| `COMMISSION_PERCENT` | 50 | Comissão do indicador |
| `HOLD_DAYS` | 7 | Dias de espera antes da segunda-feira de pagamento |
| `DOWNLOAD_HOURS` | 24 | Validade de cada link de download |
| `PIX_EXPIRATION` | PT30M | Validade do QR code (ISO 8601, mínimo 30 minutos) |
| `MP_TEST` | (vazio) | `1` com credenciais de teste: o Mercado Pago aprova o PIX sozinho |
| `EXE_KEY` | GlassDock.exe | Nome do arquivo no bucket `releases` |
