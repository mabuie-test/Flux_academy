const apiBase = '/api';
let authToken = localStorage.getItem('token') || '';

function showToast(text) {
  const zone = document.getElementById('feedback');
  if (zone) {
    zone.textContent = text;
    zone.classList.add('visible');
    setTimeout(() => zone.classList.remove('visible'), 2500);
  } else {
    alert(text);
  }
}

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
    authToken = '';
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  };
}

const orderForm = document.getElementById('order-form');
const materialsToggle = document.getElementById('has-materials');
if (materialsToggle) {
  materialsToggle.onchange = () => {
    const box = document.getElementById('materials-extra');
    if (box) box.style.display = materialsToggle.value === 'sim' ? 'block' : 'none';
  };
  materialsToggle.onchange();
}
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireAuth()) return;
    const raw = new FormData(orderForm);
    const payload = new FormData();
    payload.set('tipo', raw.get('workType'));
    payload.set('area', raw.get('area'));
    payload.set('nivel', raw.get('academicLevel'));
    payload.set('paginas', raw.get('pages'));
    payload.set('norma', raw.get('formatting'));
    payload.set('complexidade', raw.get('complexity'));
    payload.set('urgencia', raw.get('urgency'));
    payload.set('descricao', raw.get('description'));
    payload.set('prazo_entrega', raw.get('deliveryDeadline'));
    if (raw.get('hasMaterials') === 'sim') {
      payload.set('materiais_info', 'Materiais fornecidos pelo cliente');
      if (raw.get('materialsUsagePercent')) {
        payload.set('materiais_percentual', raw.get('materialsUsagePercent'));
      }
      const materialsField = document.getElementById('materialsFiles');
      if (materialsField?.files?.length) {
        Array.from(materialsField.files).forEach((file) => payload.append('materiais_uploads[]', file));
      }
    }
    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erro ao criar encomenda');
      orderForm.reset();
      showToast('Encomenda criada e fatura emitida.');
      setTimeout(() => {
        window.location.href = `/invoice.html?id=${data.order_id}`;
      }, 300);
    } catch (err) {
      showToast(err.message);
    }
  });
}

const quoteBtn = document.getElementById('simulate-quote');
if (quoteBtn) {
  quoteBtn.addEventListener('click', async () => {
    if (!requireAuth()) return;
    const raw = new FormData(orderForm);
    const body = {
      paginas: Number(raw.get('pages') || 0),
      nivel: raw.get('academicLevel'),
      complexidade: raw.get('complexity'),
      urgencia: raw.get('urgency'),
    };
    try {
      const res = await fetch(`${apiBase}/orders/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Não foi possível calcular');
      const zone = document.getElementById('quote-preview');
      if (zone) {
        zone.innerHTML = `<p><strong>Total estimado:</strong> ${data.total}</p><p>Base ${data.base} × ${body.paginas} páginas · nível x${data.levelFactor} · complexidade x${data.complexityFactor} · urgência x${data.urgencyFactor}</p>`;
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function loadOrders() {
  if (!requireAuth()) return;
  try {
    const res = await fetch(`${apiBase}/orders`, { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao carregar encomendas');
    const list = document.getElementById('orders-list');
    if (!list) return;
    list.innerHTML = '';
    data.orders.forEach((order) => {
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `
        <h4>${order.tipo} · ${order.area}</h4>
        <p>Estado: <strong>${order.estado}</strong></p>
        <p>Fatura: ${order.invoice_numero || '—'} (${order.invoice_estado || 'EMITIDA'})</p>
        <p>Total: ${order.valor_total || '—'}</p>
        ${order.final_file ? `<p class="success">Trabalho final disponível: <a href="${order.final_file}" target="_blank">baixar</a></p>` : ''}
        <div class="stacked-actions">
          <a class="primary" href="/invoice.html?id=${order.id}" target="_blank">Ver fatura</a>
        </div>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    showToast(err.message);
  }
}

if (document.getElementById('orders-list')) {
  loadOrders();
}
