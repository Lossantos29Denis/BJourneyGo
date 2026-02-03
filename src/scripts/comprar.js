// Sample tickets data (placeholder). Replace with API data later.
const sampleTickets = [
  {from: 'Madrid', to: 'Barcelona', price: 29.99, datetime: '2025-12-15T09:30', seats: 42, desc: 'Billete estándar. Servicio con wifi y baño a bordo.'},
  {from: 'Madrid', to: 'Valencia', price: 19.5, datetime: '2025-12-16T14:00', seats: 23, desc: 'Servicio exprés, asiento incluido.'},
  {from: 'Sevilla', to: 'Madrid', price: 39.0, datetime: '2025-12-20T08:15', seats: 10, desc: 'Ruta nocturna con literas.'},
  {from: 'Barcelona', to: 'Zaragoza', price: 15.0, datetime: '2025-12-18T11:00', seats: 50, desc: 'Servicio local, paradas frecuentes.'},
  {from: 'Madrid', to: 'Barcelona', price: 49.99, datetime: '2025-12-15T16:45', seats: 5, desc: 'Billete premium con mesita y reclinable.'},
  {from: 'Valencia', to: 'Barcelona', price: 12.0, datetime: '2025-12-19T10:00', seats: 60, desc: 'Servicio económico.'}
];

const ticketsGrid = document.getElementById('ticketsGrid');
const noResults = document.getElementById('noResults');

function formatDateTime(dt) {
  try {
    const d = new Date(dt);
    return d.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) + ' · ' + d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  } catch(e) {
    return dt;
  }
}

function renderTickets(tickets) {
  ticketsGrid.innerHTML = '';
  if (!tickets || tickets.length === 0) {
    noResults.style.display = 'block';
    return;
  }
  noResults.style.display = 'none';
  tickets.forEach(t => {
    const article = document.createElement('article');
    article.className = 'ticket-card';

    article.innerHTML = `
      <div class="ticket-row">
        <div class="route">${t.from} → ${t.to}</div>
        <div class="price">€${t.price.toFixed(2)}</div>
      </div>
      <div class="ticket-row small">
        <div class="datetime">${formatDateTime(t.datetime)}</div>
        <div class="seats">Plazas: ${t.seats}</div>
      </div>
      <p class="ticket-desc">${t.desc}</p>
      <div class="ticket-actions">
        <button class="btn btn--ghost" disabled>Detalles</button>
        <button class="btn btn--primary" aria-disabled="true">Comprar (Próximamente)</button>
      </div>
    `;

    ticketsGrid.appendChild(article);
  });
}

// Initial render
renderTickets(sampleTickets);

// Filtering
const form = document.getElementById('searchForm');
const resetBtn = document.getElementById('resetBtn');

function applyFilter(e) {
  if (e) e.preventDefault();
  const from = document.getElementById('from').value.trim().toLowerCase();
  const to = document.getElementById('to').value.trim().toLowerCase();
  const date = document.getElementById('date').value; // yyyy-mm-dd
  const maxPriceVal = document.getElementById('maxPrice').value;
  const maxPrice = maxPriceVal ? parseFloat(maxPriceVal) : Infinity;

  const filtered = sampleTickets.filter(t => {
    if (from && !t.from.toLowerCase().includes(from)) return false;
    if (to && !t.to.toLowerCase().includes(to)) return false;
    if (date) {
      // compare date portion only
      const dd = new Date(t.datetime).toISOString().slice(0,10);
      if (dd !== date) return false;
    }
    if (t.price > maxPrice) return false;
    return true;
  });

  renderTickets(filtered);
}

form.addEventListener('submit', applyFilter);
resetBtn.addEventListener('click', () => {
  form.reset();
  renderTickets(sampleTickets);
});

// Live-filter as user types (optional): debounce
let debounceTimer;
['from','to','maxPrice','date'].forEach(id => {
  const el = document.getElementById(id);
  el?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilter(), 250);
  });
});
