// ==================== Config & Storage Keys ====================
const STORAGE_STATE = 'comutacao-links:state';
const STORAGE_HISTORY = 'comutacao-links:history';
const HISTORY_MAX = 100;

// TROQUE ESTA SENHA PELO SEU VALOR (apenas para demonstração; ideal é validar no backend)
const ADMIN_PASSWORD = '123456';

// ==================== Drag & Drop ====================
function onDragStart(event) {
  event.dataTransfer.setData('text/plain', event.target.id);
  event.currentTarget.style.opacity = '0.6';
}

function onDragOver(event) {
  event.preventDefault();
  if (event.currentTarget.classList.contains('dropzone')) {
    event.currentTarget.classList.add('highlight');
  }
}

async function onDrop(event) {
  event.preventDefault();
  const id = event.dataTransfer.getData('text');
  const el = document.getElementById(id);
  const destinoZone = event.currentTarget;
  if (!destinoZone.classList.contains('dropzone')) return;

  const origem = el.closest('.dropzone')?.dataset.zona || 'Indefinido';
  const destino = destinoZone.dataset.zona || 'Indefinido';

  // Evita "drop" em si mesmo
  if (origem === destino) {
    cleanupDrag(event, destinoZone, el);
    return;
  }

  // Confirmação inicial
  const ok = confirm(`Deseja realmente fazer a comutação?\n\n${el.textContent.trim()}\n${origem}  →  ${destino}`);
  if (!ok) {
    cleanupDrag(event, destinoZone, el);
    return;
  }

  // Autorização por senha (modal)
  const authorized = await askPassword();
  if (!authorized) {
    alert('Comutação cancelada: senha inválida.');
    cleanupDrag(event, destinoZone, el);
    return;
  }

  // Efetiva
  destinoZone.appendChild(el);
  cleanupDrag(event, destinoZone, el);

  // Atualiza status, persiste estado e registra histórico
  updateStatus();
  persistState();
  pushHistory({ item: el.textContent.trim(), from: origem, to: destino, at: new Date().toISOString() });
}

function cleanupDrag(event, zone, el){
  zone.classList.remove('highlight');
  el.style.opacity = '1';
  event.dataTransfer.clearData();
}

document.querySelectorAll('.dropzone').forEach(z => {
  z.addEventListener('dragleave', () => z.classList.remove('highlight'));
});

// ==================== Modal de Senha ====================
function askPassword(){
  return new Promise(resolve => {
    const overlay = document.getElementById('authModal');
    const form = document.getElementById('authForm');
    const input = document.getElementById('authPassword');
    const btnCancel = document.getElementById('btnCancelAuth');

    // abre modal
    overlay.classList.add('active');
    input.value = '';
    setTimeout(() => input.focus(), 50);

    function cleanup(){
      overlay.classList.remove('active');
      form.removeEventListener('submit', onSubmit);
      btnCancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onEsc);
    }

    function onSubmit(e){
      e.preventDefault();
      const ok = input.value === ADMIN_PASSWORD;
      cleanup();
      resolve(ok);
    }

    function onCancel(){
      cleanup();
      resolve(false);
    }

    function onOverlay(e){
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    }

    function onEsc(e){
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    }

    form.addEventListener('submit', onSubmit);
    btnCancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onEsc);
  });
}

// ==================== Status Panel ====================
function updateStatus() {
  const ul = document.getElementById('status-list');
  ul.innerHTML = '';

  document.querySelectorAll('.dropzone').forEach(z => {
    const zona = z.dataset.zona;
    z.querySelectorAll('.draggable').forEach(d => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${d.textContent.trim()} → <strong>${zona}</strong></span>`;
      ul.appendChild(li);
    });
  });
}

// ==================== History ====================
function pushHistory(entry){
  const hist = getHistory();
  hist.unshift(entry);                 // adiciona no topo
  if (hist.length > HISTORY_MAX) hist.pop();
  localStorage.setItem(STORAGE_HISTORY, JSON.stringify(hist));
  renderHistory();
}

function renderHistory(){
  const ul = document.getElementById('history-list');
  ul.innerHTML = '';
  const hist = getHistory();
  if (!hist.length){
    const li = document.createElement('li');
    li.textContent = 'Sem comutações registradas.';
    ul.appendChild(li);
    return;
  }

  hist.forEach(h => {
    const li = document.createElement('li');
    const when = formatDateTime(h.at);
    li.innerHTML = `
      <span>${h.item}: <strong>${h.from}</strong> → <strong>${h.to}</strong></span>
      <span class="meta">${when}</span>
    `;
    ul.appendChild(li);
  });
}

function getHistory(){
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY)) || []; }
  catch { return []; }
}

function clearHistory(){
  localStorage.removeItem(STORAGE_HISTORY);
  renderHistory();
}

// ==================== Persistence (State) ====================
function persistState(){
  const data = {};
  document.querySelectorAll('.dropzone').forEach(z => {
    data[z.dataset.zona] = Array.from(z.querySelectorAll('.draggable')).map(d => d.id);
  });
  localStorage.setItem(STORAGE_STATE, JSON.stringify(data));
}

function restoreState(){
  const raw = localStorage.getItem(STORAGE_STATE);
  if (!raw) {
    updateStatus(); renderHistory();
    return;
  }
  try {
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([zona, ids]) => {
      const zoneEl = document.querySelector(`.dropzone[data-zona="${zona}"]`);
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && zoneEl && el.parentElement !== zoneEl) zoneEl.appendChild(el);
      });
    });
  } catch {}
  updateStatus(); renderHistory();
}

function resetState(){
  localStorage.removeItem(STORAGE_STATE);
  const sumicity = document.querySelector('.dropzone[data-zona="Sumicity"]');
  const internexa = document.querySelector('.dropzone[data-zona="Internexa"]');
  ['item-ptt'].forEach(id => sumicity.appendChild(document.getElementById(id)));
  ['item-lumen','item-isaip'].forEach(id => internexa.appendChild(document.getElementById(id)));
  updateStatus(); persistState();
}

// ==================== Utilities ====================
function pad2(n){ return `${n}`.padStart(2,'0'); }
function formatDateTime(iso){
  const d = new Date(iso);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth()+1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

// ==================== Boot & Listeners ====================
document.getElementById('btnReset')?.addEventListener('click', resetState);
document.getElementById('btnClearHistory')?.addEventListener('click', clearHistory);
restoreState();
