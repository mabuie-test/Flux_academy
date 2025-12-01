const apiBase = '/api';
const params = new URLSearchParams(window.location.search);
const orderId = params.get('id');
let authToken = localStorage.getItem('token') || '';

function ensureAuth() {
  const logoutBtn = document.getElementById('logout');
  if (logoutBtn) {
    logoutBtn.style.display = authToken ? 'inline-flex' : 'none';
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    });
  }
  if (!authToken) window.location.href = '/login.html';
}

async function loadInvoice() {
  try {
    const res = await fetch(`${apiBase}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Erro ao carregar fatura');
      return;
    }
    renderInvoice(data.order, data.invoice);
  } catch (err) {
    alert('Falha ao obter fatura');
  }
}

function renderInvoice(order, invoice) {
  const title = document.getElementById('invoice-title');
  title.textContent = `Fatura #${invoice.invoiceNumber}`;
  const body = document.getElementById('invoice-body');
  body.innerHTML = `
    <p><strong>Serviço:</strong> ${invoice.summary}</p>
    <p><strong>Valor:</strong> ${invoice.amount}</p>
    <p><strong>Estado:</strong> ${invoice.status}</p>
    <p><strong>Prazo:</strong> ${new Date(invoice.dueDate).toLocaleString()}</p>
    <p>Pagamento via M-Pesa: <strong>Número 851619970</strong> | Titular <strong>Maria António Chicavele</strong></p>
    <p>Base/página ${invoice.priceFactors.basePerPage} | Nível ${invoice.priceFactors.levelFactor} | Complexidade ${invoice.priceFactors.complexityFactor} | Urgência ${invoice.priceFactors.urgencyFactor}</p>
    ${invoice.rejectionReason ? `<p class="alert">Motivo de rejeição: ${invoice.rejectionReason}</p>` : ''}
    ${order.finalFile ? `<p>Trabalho final: disponível após pagamento.</p>` : ''}
  `;
  const downloadPdf = document.getElementById('download-pdf');
  downloadPdf.addEventListener('click', () => {
    window.open(`${apiBase}/orders/${order._id}/invoice/pdf`, '_blank');
  });
}

const backBtn = document.getElementById('back-dashboard');
if (backBtn) backBtn.addEventListener('click', () => window.history.back());

ensureAuth();
if (orderId) loadInvoice();
