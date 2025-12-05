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
  downloadPdf.addEventListener('click', () => downloadInvoicePdf(order._id, invoice.invoiceNumber));
}

const backBtn = document.getElementById('back-dashboard');
if (backBtn) backBtn.addEventListener('click', () => window.history.back());
const refreshBtn = document.getElementById('refresh-invoice');
if (refreshBtn) refreshBtn.addEventListener('click', loadInvoice);

ensureAuth();
if (orderId) {
  loadInvoice();
}

async function downloadInvoicePdf(orderId, invoiceNumber) {
  try {
    const res = await fetch(`${apiBase}/orders/${orderId}/invoice/pdf`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.message || 'Erro ao gerar PDF');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatura-${invoiceNumber || orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Falha ao descarregar fatura');
  }
}
