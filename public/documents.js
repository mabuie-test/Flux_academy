const apiBase = '/api';
let token = localStorage.getItem('token') || '';
let refreshTimer = null;

const modal = document.getElementById('confirm-overlay');
const modalTitle = document.getElementById('confirm-title');
const modalText = document.getElementById('confirm-text');
const modalOk = document.getElementById('confirm-ok');
const modalCancel = document.getElementById('confirm-cancel');

function toast(message) {
  modalTitle.textContent = 'Aviso';
  modalText.textContent = message;
  modal.classList.remove('hidden');
  const close = () => modal.classList.add('hidden');
  modalOk.onclick = close;
  modalCancel.onclick = close;
}

function updateNav() {
  document.querySelectorAll('.anon-only').forEach((el) => (el.style.display = token ? 'none' : 'inline-flex'));
  document.querySelectorAll('.auth-only').forEach((el) => (el.style.display = token ? 'inline-flex' : 'none'));
  if (!token) window.location.href = '/login.html';
  if (token && !refreshTimer) {
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      loadCollections(true);
    }, 8000);
  }
}

const logoutBtn = document.getElementById('logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    token = '';
    localStorage.removeItem('token');
    if (refreshTimer) clearInterval(refreshTimer);
    window.location.href = '/login.html';
  });
}

async function loadCollections(silent = false) {
  const res = await fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) {
    if (!silent) toast(data.message || 'Não foi possível carregar dados');
    return;
  }
  renderInvoices(data.orders, data.invoices);
  renderDocuments(data.orders, data.invoices);
  renderFeedback(data.orders, data.invoices);
}

function renderInvoices(orders, invoices) {
  const holder = document.getElementById('invoice-collection');
  holder.innerHTML = '';
  invoices.forEach((inv) => {
    const order = orders.find((o) => o._id === inv.order) || {};
    const row = document.createElement('div');
    row.classList.add('list-row');
    row.innerHTML = `
      <div>
        <p><strong>Fatura #${inv.invoiceNumber}</strong> — ${inv.status}</p>
        <p class="muted">${order.workType || 'Pedido'} · Total ${inv.amount} · Prazo ${new Date(inv.dueDate).toLocaleString()}</p>
      </div>
      <div class="row-actions">
        <a class="ghost" target="_blank" rel="noopener" href="/invoice.html?id=${order._id}">Abrir página</a>
        <button data-oid="${order._id}" data-num="${inv.invoiceNumber}">PDF</button>
      </div>
    `;
    row.querySelector('button').addEventListener('click', () => downloadInvoicePdf(order._id, inv.invoiceNumber));
    holder.appendChild(row);
  });
  if (!invoices.length) holder.innerHTML = '<p class="muted">Nenhuma fatura emitida ainda.</p>';
}

function renderDocuments(orders, invoices) {
  const holder = document.getElementById('documents-collection');
  holder.innerHTML = '';
  orders
    .filter((o) => {
      const inv = invoices.find((i) => i.order === o._id);
      return o.status === 'CONCLUIDA' && inv?.status === 'PAGA' && o.finalFile;
    })
    .forEach((o) => {
      const inv = invoices.find((i) => i.order === o._id) || {};
      const row = document.createElement('div');
      row.classList.add('list-row');
      row.innerHTML = `
        <div>
          <p><strong>${o.workType}</strong> — ${o.area}</p>
          <p class="muted">Fatura #${inv.invoiceNumber || 'N/A'} · Entrega final pronta</p>
        </div>
        <div class="row-actions">
          <a class="primary" href="/uploads/trabalhos/${o.finalFile}" download>Baixar documento</a>
        </div>
      `;
      holder.appendChild(row);
    });
  if (!holder.childElementCount) holder.innerHTML = '<p class="muted">Ainda não existem documentos finais disponíveis.</p>';
}

async function renderFeedback(orders, invoices) {
  const holder = document.getElementById('feedback-collection');
  if (!holder) return;
  holder.innerHTML = '';
  const eligible = orders.filter((o) => {
    const inv = invoices.find((i) => i.order === o._id);
    return o.status === 'CONCLUIDA' && inv?.status === 'PAGA' && o.finalFile;
  });
  if (!eligible.length) {
    holder.innerHTML = '<p class="muted">Envie o comprovativo e aguarde a conclusão para avaliar.</p>';
    return;
  }

  await Promise.all(
    eligible.map(async (order) => {
      const inv = invoices.find((i) => i.order === order._id) || {};
      const res = await fetch(`${apiBase}/orders/${order._id}/feedback`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const feedback = data.feedback || {};

      const row = document.createElement('div');
      row.classList.add('list-row');
      row.innerHTML = `
        <div>
          <p><strong>${order.workType}</strong> — ${order.area}</p>
          <p class="muted">Fatura #${inv.invoiceNumber || 'N/A'} · Trabalhos finais disponíveis</p>
          <form class="feedback-form" data-order="${order._id}">
            <label>Classificação (1-5)</label>
            <input type="number" name="rating" min="1" max="5" value="${feedback.rating || ''}" />
            <label>Nota obtida / observação</label>
            <input type="text" name="gradeReceived" value="${feedback.gradeReceived || ''}" />
            <label>Comentário</label>
            <textarea name="comment" rows="2">${feedback.comment || ''}</textarea>
            <div class="row-actions"><button type="submit">Guardar feedback</button></div>
          </form>
        </div>
        <div class="feedback-thread" id="thread-${order._id}">
          <p class="muted">Conversa com a equipa</p>
        </div>
      `;
      holder.appendChild(row);

      const thread = row.querySelector(`#thread-${order._id}`);
      if (feedback.replies && feedback.replies.length) {
        feedback.replies.forEach((r) => {
          const bubble = document.createElement('div');
          bubble.classList.add('bubble', r.from === 'admin' ? 'bubble-admin' : 'bubble-client');
          bubble.innerHTML = `<p>${r.message}</p><span>${new Date(r.createdAt).toLocaleString()}</span>`;
          thread.appendChild(bubble);
        });
      }

      const replyForm = document.createElement('form');
      replyForm.classList.add('inline-form');
      replyForm.innerHTML = `
        <input type="text" name="message" placeholder="Responder" required />
        <button type="submit" class="ghost">Enviar</button>
      `;
      replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = replyForm.message.value;
        const resp = await fetch(`${apiBase}/orders/${order._id}/feedback/reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        });
        if (!resp.ok) {
          const err = await resp.json();
          return toast(err.message || 'Erro ao responder');
        }
        loadCollections(true);
      });
      thread.appendChild(replyForm);

      const form = row.querySelector('.feedback-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());
        const resp = await fetch(`${apiBase}/orders/${order._id}/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const body = await resp.json();
        if (resp.ok) {
          toast('Feedback guardado.');
          loadCollections(true);
        } else {
          toast(body.message || 'Erro ao guardar feedback');
        }
      });
    })
  );
}

async function downloadInvoicePdf(orderId, invoiceNumber) {
  try {
    const res = await fetch(`${apiBase}/orders/${orderId}/invoice/pdf`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const data = await res.json();
      return toast(data.message || 'Não foi possível gerar o PDF');
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
    toast('Erro ao baixar PDF');
  }
}

updateNav();
loadCollections();

document.getElementById('refresh-invoices').addEventListener('click', () => loadCollections());
document.getElementById('refresh-docs').addEventListener('click', () => loadCollections());
document.getElementById('refresh-feedback').addEventListener('click', () => loadCollections());
