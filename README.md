# Flux Academy (PHP/MySQL)

Plataforma web em PHP 8.1+ com MySQL para encomendas académicas, cálculo automático de preço, emissão de faturas com dados M-Pesa e painel administrativo.

## Requisitos
- PHP 8.1 ou superior (CLI/servidor)
- Composer
- MySQL 8+

## Configuração rápida
1. Copie o ficheiro de exemplo:
   ```bash
   cp php-app/.env.example php-app/.env
   ```
2. Edite `php-app/.env` com as credenciais MySQL, dados SMTP (PHPMailer) e, se quiser restringir o registo de administradores, defina `ADMIN_SETUP_TOKEN`.
3. Instale dependências PHP:
   ```bash
   cd php-app
   composer install
   ```
4. Crie a base de dados e aplique o esquema:
   ```bash
   mysql -u <user> -p < db_password
   source schema.sql;
   ```
5. Arranque localmente para desenvolvimento:
   ```bash
   php -S localhost:8080 -t public
   ```
6. Aponte o webroot do seu hosting PHP para `php-app/public/`. As páginas HTML e a API REST vivem no mesmo directório; tudo sem Node.js.

## API principal (todas em `/api`)
- `POST /api/auth/register` — registo de cliente (JSON: name, email, password, opcional referred_by)
- `POST /api/auth/login` — autenticação (JSON: email, password)
- `POST /api/auth/admin-register` — registo de administrador (JSON: name, email, password, setupToken)
- `POST /api/orders/quote` — cálculo de preço (JSON: paginas, nivel, complexidade, urgencia)
- `POST /api/orders` — criação de encomenda + fatura (form-data; requer Bearer token)
- `POST /api/orders/proof` — upload de comprovativo de pagamento (form-data)
- `GET  /api/orders/deliveries` — documentos finais disponíveis para o cliente
- `GET  /api/notifications` — alertas pessoais (auditoria filtrada por utilizador)
- `POST /api/orders/feedback` — avaliação pós-entrega (rating, nota, comentário)
- `GET  /api/affiliates/summary` — comissões, saldo e pedidos de levantamento do afiliado
- `POST /api/affiliates/request-payout` — solicitar levantamento do saldo aprovado
- `POST /api/services` — pedidos de serviços especializados (revisão, estatística, apresentações, CV, plágio)
- `GET  /api/orders` — listar encomendas do cliente autenticado
- `GET  /api/orders/{id}` — detalhe de encomenda (cliente dono ou admin)
- `GET  /api/admin/orders` — lista completa para administradores
- `POST /api/admin/invoices/approve` — marcar fatura como paga (admin)
- `POST /api/admin/invoices/reject` — rejeitar um pagamento/prova (admin)
- `POST /api/admin/orders/final-upload` — envio do documento final para o cliente
- `GET/POST /api/admin/users` — listagem e ativação/desativação de contas
- `GET /api/admin/metrics` — totais, somas de faturação, receita mensal, top serviços e ranking de afiliados
- `GET /api/admin/commissions` — acompanhamento das comissões de afiliados
- `GET /api/admin/payouts` — pedidos de levantamento dos afiliados
- `POST /api/admin/payouts/update` — aprovar ou rejeitar levantamentos
- `GET /api/admin/audits` — registo recente de operações sensíveis
- `GET/POST /api/admin/chat` — estação interna para admins trocarem notas e anexos (pode associar a um pedido)
- `GET/POST /api/admin/services` — acompanhar pedidos de serviços especializados e atualizar estado

Autenticação: envie `Authorization: Bearer <token>` devolvido no login/registo.

### Programa de afiliados por link
- Cada utilizador recebe um `referral_code` único e partilhável (ex.: `https://seu-dominio/register.html?ref=ABCD1234`).
- Se o visitante chegar com `?ref=CODE`, o código fica guardado no navegador e é aplicado automaticamente no registo.
- Depois de registado, todas as encomendas desse cliente usam o `referred_by` guardado, garantindo 18% de comissão contínua para o dono do link em cada pagamento validado.
- No painel do cliente, o bloco de afiliados mostra o link pronto para copiar e acompanhar saldos/levantamentos.

Preço base actual: **35 MZN** por página (configurável via `BASE_PRICE_PER_PAGE` no `.env`). Multiplicadores seguem o helper `php-app/src/helpers/pricing.php`.

## Estrutura
- `php-app/public/` — páginas HTML/JS/CSS e front controller `index.php` que serve a API e os assets estáticos.
- `php-app/src/` — configuração, controladores, modelos, helpers (JWT, auditoria, mailer, pricing).
- `php-app/schema.sql` — tabelas MySQL (users, orders, invoices, audits, afiliados/payouts, etc.).
- Tabelas adicionais: `affiliate_commissions` para créditos de referência (18%), `feedbacks` para avaliações pós-entrega e `admin_messages` para o chat interno.
- Campos recentes: `orders.referred_by_code` guarda o código usado em cada pedido; `affiliate_payouts` tem método, notas e responsável pela aprovação.
- Nova tabela `service_requests` acompanha revisões linguísticas, estatística, apresentações, CV/cartas e verificação de plágio (com anexos opcionais) com fluxo de estado para o admin.
- `registo.txt` — guia rápido de registo de administradores via API.

## Serviços especializados disponíveis
- Revisão linguística com normalização (APA, ABNT, MLA, Chicago, Vancouver, IEEE).
- Consultoria estatística (SPSS/R/Python) e visualização de dados.
- Preparação de apresentações e defesas (slides e roteiros).
- Criação/otimização de CV, cartas de candidatura e portfólios.
- Verificação de plágio e otimização de referências bibliográficas.

### Ideias adicionais sugeridas
- Coaching para métodos de pesquisa e desenho experimental.
- Workshops rápidos sobre ferramentas de produtividade académica (LaTeX, gestores de referências).
- Mentoria de carreira académica (bolsas, candidaturas a mestrado/doutoramento).

## Notas
- Node.js foi removido; todo o backend e frontend são servidos em PHP para funcionar em ambientes de alojamento apenas-PHP.
- Emails usam PHPMailer; configure host, utilizador e remetente no `.env`.
- A aplicação serve as páginas estáticas e a API do mesmo `index.php`; mantenha o webroot em `php-app/public/`.
- Contactos destacados no frontend: +258 851 619 970 (Chamadas/WhatsApp), suporte@fluxosoftwares.com e links sociais; copyright © 2024 Fluxosoftwares.
