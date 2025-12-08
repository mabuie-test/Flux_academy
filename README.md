# Flux Academy

Plataforma Node.js + MongoDB para encomenda de trabalhos académicos com cálculo automático de preço, faturação com dados de pagamento M-Pesa e validação manual de comprovativos.

## Requisitos
- Node.js 18+
- MongoDB Atlas (string de ligação)

## Configuração
1. Copie `.env.example` para `.env` e defina as variáveis:
```
PORT=4000
MONGODB_URI=sua_string_atlas
JWT_SECRET=chave_segura
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Flux Academy <no-reply@flux.academy>"
ADMIN_SETUP_TOKEN=
```
2. Instale dependências:
```
npm install
```
3. Inicie em desenvolvimento:
```
npm run dev
```
Ou produção:
```
npm start
```

## Estrutura
- `src/server.js` – servidor Express e ligação MongoDB.
- `src/models` – esquemas User, Order e Invoice.
- `src/controllers` – lógica de autenticação, encomendas e painel admin.
- `src/routes` – rotas de API para auth, cliente e admin.
- `src/utils/pricing.js` – cálculo reutilizável do preço total.
- Preço base atual: 35 MZN por página (ajustável em `src/utils/pricing.js`).
- `public/` – frontend HTML/CSS/JS simples para cliente e admin.
- `uploads/` – comprovativos e trabalhos finais enviados via multer.
- Materiais didáticos fornecidos pelo cliente (percentagem e múltiplos ficheiros) ficam registados na encomenda e acessíveis ao admin.
- `/api/orders/quote` – endpoint para simular preços em tempo real.
- Uploads protegidos com limites (5MB comprovativos, 15MB trabalhos finais) e formatos validados (pdf/jpg/png para comprovativos; pdf/doc/docx para trabalhos).
- Emails automáticos cobrem criação/alteração de faturas, recuperação de senha por token, entrega final, pedidos especiais e disparo em massa pelo admin.
- Termos e Condições disponíveis em `/terms.html`; aceitação obrigatória nos formulários de login/registo.
- Pedidos especiais de TCC e projetos práticos com faturação manual e trilha de auditoria.
- Página dedicada de faturas com link de download em PDF e atalhos rápidos a partir do painel do cliente.
- Página extra `/documents.html` para visualizar todas as faturas em nova aba e descarregar documentos finais enviados pelo admin.
- Programa de afiliados: código único por utilizador, 18% de comissão por pedidos pagos de clientes indicados (campo opcional no formulário e resumo em `/` > “Programa de afiliados”).
- Levantamentos de afiliados: clientes pedem pagamentos, admin aprova/paga (modelo `AffiliatePayout`) e vê totais pagos/pedentes no painel.
- Painel admin reforçado: gestão de utilizadores (ativar/desativar/alterar role), gráficos de faturas/receita e secção dedicada de afiliação.
- Feedback pós-entrega: clientes classificam o trabalho e registam a nota obtida em `/documents.html`, com thread de respostas visível e respondida pelo admin.
- Registo de administradores via `/api/auth/admin/signup` (opcionalmente protegido pelo cabeçalho `x-admin-setup-token` com o valor de `ADMIN_SETUP_TOKEN`). Consulte `registo.txt` para instruções passo-a-passo.

## Fluxo principal
1. Cliente regista/login.
2. Cria encomenda -> preço calculado e fatura gerada com dados M-Pesa (Número 851619970, Titular Maria António Chicavele).
3. Cliente envia comprovativo -> estados passam para validação.
4. Admin valida ou rejeita pagamento (com histórico de motivos); após validado, pode subir o ficheiro final.
5. Cliente descarrega o trabalho final apenas quando encomenda está `CONCLUIDA` e fatura `PAGA`.
6. Prazos expirados podem marcar faturas como `EXPIRADA` e encomendas como `CANCELADA`.
