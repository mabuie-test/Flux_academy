const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';
const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');

function requireAuth() {
  if (!authToken) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

const logout = document.getElementById('logout');
if (logout) {
  logout.onclick = () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  };
}

async function loadInvoice() {
  if (!requireAuth() || !orderId) return;
  try {
    const res = await fetch(`${apiBase}/orders/${orderId}`, { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Não foi possível carregar a fatura');
    const order = data.order;
    const body = document.getElementById('invoice-body');
    body.innerHTML = `
      <p><strong>Fatura:</strong> ${order.invoice_numero || '—'}</p>
      <p><strong>Estado:</strong> ${order.invoice_estado || 'EMITIDA'}</p>
      <p><strong>Cliente:</strong> ${order.user_id}</p>
      <p><strong>Trabalho:</strong> ${order.tipo} (${order.area})</p>
      <p><strong>Nível:</strong> ${order.nivel} · Páginas: ${order.paginas}</p>
      <p><strong>Complexidade:</strong> ${order.complexidade} · Urgência: ${order.urgencia}</p>
      <p><strong>Valor:</strong> ${order.valor_total || '—'} MZN</p>
      <hr />
      <p><strong>Pagamento M-Pesa</strong></p>
      <p>Número: 851619970 · Titular: Maria António Chicavele</p>
      <p class="muted">Após pagar, envie o comprovativo para o suporte.</p>
    `;
  } catch (err) {
    alert(err.message);
  }
}

const refreshBtn = document.getElementById('refresh-invoice');
if (refreshBtn) refreshBtn.onclick = loadInvoice;
const backBtn = document.getElementById('back-dashboard');
if (backBtn) backBtn.onclick = () => (window.location.href = '/index.html');
const pdfBtn = document.getElementById('download-pdf');
if (pdfBtn) pdfBtn.onclick = () => alert('Download de PDF não disponível nesta versão PHP.');

loadInvoice();
