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
- `/api/orders/quote` – endpoint para simular preços em tempo real.
- Uploads protegidos com limites (5MB comprovativos, 15MB trabalhos finais) e formatos validados (pdf/jpg/png para comprovativos; pdf/doc/docx para trabalhos).
- Emails automáticos cobrem criação/alteração de faturas, recuperação de senha por token, entrega final, pedidos especiais e disparo em massa pelo admin.
- Pedidos especiais de TCC e projetos práticos com faturação manual e trilha de auditoria.
- Página dedicada de faturas com link de download em PDF e atalhos rápidos a partir do painel do cliente.

## Fluxo principal
1. Cliente regista/login.
2. Cria encomenda -> preço calculado e fatura gerada com dados M-Pesa (Número 851619970, Titular Maria António Chicavele).
3. Cliente envia comprovativo -> estados passam para validação.
4. Admin valida ou rejeita pagamento (com histórico de motivos); após validado, pode subir o ficheiro final.
5. Cliente descarrega o trabalho final apenas quando encomenda está `CONCLUIDA` e fatura `PAGA`.
6. Prazos expirados podem marcar faturas como `EXPIRADA` e encomendas como `CANCELADA`.
