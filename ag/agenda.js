/*
  =============================================================
  APP.JS — Lógica do Sistema
  • Vanilla JS, sem dependências
  • Armazena dados no localStorage
  • Telas: Login, Agenda, Clientes, Usuários, Financeiro, Config
  • Autenticação simples (hash fraco apenas para demo)
  =============================================================
*/
/* ==== Guard rails (coloque no topo do app.js) ==== */
// Chave do localStorage (mudei a versão para evitar choques com dados antigos)
const LS_KEY = 'app_agenda_v2';

// Helpers essenciais
const nowISO = () => new Date().toISOString();
const today  = () => new Date().toISOString().slice(0,10);
const toBRL  = (n) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0));
const uid    = () => Math.random().toString(36).slice(2,10);
const hash   = (str) => { let h=0; for (let i=0;i<str.length;i++){ h=(h<<5)-h+str.charCodeAt(i); h|=0; } return 'h'+Math.abs(h); };
const parseHM = (t) => { const [h,m]=t.split(':').map(Number); return h*60+m; };
const pad2    = (n) => String(n).padStart(2,'0');
const hm      = (min) => `${pad2(Math.floor(min/60))}:${pad2(min%60)}`;
function buildSlots(hIni='08:00', hFim='18:00', step=30){
  const a=parseHM(hIni), b=parseHM(hFim); const out=[];
  for(let m=a; m<=b; m+=Number(step||30)) out.push(hm(m));
  return out;
}

// ----------------- Utilidades Básicas -----------------
// ----------------- Calendário (mês) -----------------
const WEEK_LABELS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const toISO = (d)=> new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
function firstDayOfMonth(dateStr){
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(dateStr, delta){
  const d = dateStr ? new Date(dateStr) : new Date();
  const n = new Date(d.getFullYear(), d.getMonth()+delta, 1);
  return toISO(n);
}
function monthMatrix(dateStr){
  // Semana começa na segunda-feira
  const first = firstDayOfMonth(dateStr);
  const year = first.getFullYear(), month = first.getMonth();
  const last = new Date(year, month+1, 0);
  const firstWeekdayMon0 = (first.getDay()+6)%7; // 0=Seg..6=Dom
  // início do grid: segunda da semana do dia 1
  const start = new Date(year, month, 1 - firstWeekdayMon0);
  const cells = [];
  for(let i=0;i<42;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    cells.push({
      dateObj: d,
      iso: toISO(d),
      inMonth: d.getMonth()===month,
      isToday: toISO(new Date())===toISO(d)
    });
  }
  return { year, month, firstISO: toISO(first), lastISO: toISO(last), cells };
}

// ----------------- Estado / Persistência -----------------
function readState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.warn('Falha ao ler storage', e); }
  // Estado inicial de fábrica com 1 admin padrão
  const adminId = uid();
  return {
    auth: { userId: null },
    users: [{ id: adminId, nome: 'Admin', email: 'admin@local', role: 'admin', passwordHash: hash('admin123'), createdAt: nowISO() }],
    clients: [],
    bookings: [],
    finance: [],
    config: { agendaInicio:'08:00', agendaFim:'18:00', step:30 },
  };
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function commit(){ saveState(); render(); }
let state = readState();

// ----------------- Permissões -----------------
function me(){ return state.users.find(u=>u.id===state.auth.userId)||null; }
function isLogged(){ return !!me(); }
function isAdmin(){ return me()?.role === 'admin'; }

// ----------------- Navegação / Shell -----------------
const TABS = [
  { id:'agenda', label:'Agenda', roles:['admin','atendente'] },
  { id:'clients', label:'Clientes', roles:['admin','atendente'] },
  { id:'finance', label:'Financeiro', roles:['admin','atendente'] },
  { id:'users', label:'Usuários', roles:['admin'] },
  { id:'config', label:'Config', roles:['admin'] },
];
let currentTab = 'agenda';

function renderTabs(){
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  if(!isLogged()) return; // sem tabs no login

  // Info do usuário logado e botão sair
  const userInfo = document.createElement('div');
  userInfo.className = 'row';
  userInfo.style.alignItems = 'center';
  const name = document.createElement('span');
  name.className = 'small muted';
  name.textContent = `Olá, ${me().nome}`;
  const btnOut = document.createElement('button');
  btnOut.className = 'btn';
  btnOut.textContent = 'Sair';
  btnOut.onclick = logout;

  // Tabs por permissão
  TABS.forEach(t=>{
    if(!t.roles.includes(me().role)) return;
    const b = document.createElement('button');
    b.className = 'tab'+(currentTab===t.id?' active':'');
    b.textContent = t.label;
    b.onclick = ()=>{ currentTab = t.id; render(); };
    nav.appendChild(b);
  });
  nav.appendChild(name);
  nav.appendChild(btnOut);
}

function render(){
  renderTabs();
  const mount = document.getElementById('view');
  if(!isLogged()){ mount.innerHTML = viewLogin(); return; }
  if(currentTab==='agenda') mount.innerHTML = viewAgenda();
  if(currentTab==='clients') mount.innerHTML = viewClients();
  if(currentTab==='users') mount.innerHTML = viewUsers();
  if(currentTab==='finance') mount.innerHTML = viewFinance();
  if(currentTab==='config') mount.innerHTML = viewConfig();
}

// ----------------- Autenticação -----------------
function viewLogin(){
  return `
    <div class="grid">
      <div class="card" style="max-width:520px;margin:40px auto">
        <h3>Entrar</h3>
        <p class="small muted">Use o usuário padrão: <strong>admin@local</strong> / senha <strong>admin123</strong> (alterável em Usuários).</p>
        <form onsubmit="login(event)">
          <div class="row">
            <div style="flex:1"><label>E-mail</label><input id="lg_email" type="email" required placeholder="email@exemplo.com" /></div>
          </div>
          <div class="row">
            <div style="flex:1"><label>Senha</label><input id="lg_pass" type="password" required placeholder="Sua senha" /></div>
          </div>
          <div class="between" style="margin-top:8px">
            <button class="btn primary" type="submit">Entrar</button>
            <button class="btn ghost" type="button" onclick="seedDemo()">Gerar Dados Demo</button>
          </div>
        </form>
      </div>
    </div>`;
}
function login(ev){
  ev.preventDefault();
  const email = document.getElementById('lg_email').value.trim();
  const pass = document.getElementById('lg_pass').value;
  const u = state.users.find(x=> x.email.toLowerCase()===email.toLowerCase());
  if(!u){ alert('Usuário não encontrado.'); return; }
  if(u.passwordHash !== hash(pass)){ alert('Senha incorreta.'); return; }
  state.auth.userId = u.id;
  commit();
}
function logout(){ state.auth.userId = null; commit(); }

// ----------------- Agenda -----------------
function hasConflict(date, time){
  return state.bookings.some(b=> b.date===date && b.time===time);
}
function viewAgenda(){
  const cfg = state.config;
  const params = new URLSearchParams(location.hash.slice(1));
  const d = params.get('date') || today();

  // Matriz do mês e mapa de contagem de agendamentos por dia
  const mm = monthMatrix(d);
  const bookingsByDay = state.bookings.reduce((acc,b)=>{
    acc[b.date] = (acc[b.date]||0)+1; return acc;
  },{});

  const slots = buildSlots(cfg.agendaInicio, cfg.agendaFim, Number(cfg.step)||30);
  const bookings = state.bookings
    .filter(b=> b.date===d)
    .sort((a,b)=> parseHM(a.time)-parseHM(b.time));

  const rows = slots.map(time=>{
    const found = bookings.find(b=> b.time===time);
    if(found){
      const cliente = found.clientId ? (state.clients.find(c=>c.id===found.clientId)?.nome||'—') : (found.clientNameLivre||'—');
      const usuario = state.users.find(u=>u.id===found.userId)?.nome||'—';
      return `<tr>
        <td class="mono">${time}</td>
        <td>${cliente}</td>
        <td class="small muted">${found.obs||''}</td>
        <td class="small">${usuario}</td>
        <td><span class="pill neutral">Agendado</span></td>
        <td class="between">
          <button class="btn warn" onclick="editBooking('${found.id}')">Editar</button>
          <button class="btn danger" onclick="deleteBooking('${found.id}')">Excluir</button>
        </td>
      </tr>`;
    }
    return `<tr>
      <td class="mono">${time}</td>
      <td colspan="3" class="muted small">Livre</td>
      <td><span class="pill ok">Disponível</span></td>
      <td><button class="btn primary" onclick="openNewBooking('${d}','${time}')">Agendar</button></td>
    </tr>`;
  }).join('');

  // Cabeçalho mês/ano
  const monthName = new Date(mm.year, mm.month, 1).toLocaleDateString('pt-BR',{month:'long', year:'numeric'});

  // Calendário (42 células, começa na segunda)
  const calDays = mm.cells.map(cell=>{
    const classes = ['cal-day'];
    if(!cell.inMonth) classes.push('out');
    if(cell.isToday) classes.push('today');
    if(cell.iso===d) classes.push('selected');
    if(bookingsByDay[cell.iso]) classes.push('has-booking');
    const count = bookingsByDay[cell.iso]||0;
    return `<button class="${classes.join(' ')}" title="${count? count+' agend.' : ''}"
              onclick="changeAgendaDate('${cell.iso}')">
              <span class="cal-num">${String(cell.dateObj.getDate())}</span>
              ${count? `<span class="cal-dot" aria-hidden="true"></span>`:''}
            </button>`;
  }).join('');

  return `
  <div class="grid grid-2">
    <!-- Calendário mensal -->
    <div class="card">
      <div class="between">
        <h3>Calendário</h3>
        <div class="row" style="align-items:center;gap:6px">
          <button class="btn" onclick="changeAgendaDate('${addMonths(d,-1)}')">◀</button>
          <div class="small" style="min-width:150px;text-align:center;font-weight:700">${monthName}</div>
          <button class="btn" onclick="changeAgendaDate('${addMonths(d,1)}')">▶</button>
        </div>
      </div>
      <div class="calendar">
        <div class="cal-weeklabels">${WEEK_LABELS.map(w=>`<div class="cal-w">${w}</div>`).join('')}</div>
        <div class="cal-grid">${calDays}</div>
      </div>
      <div class="row" style="margin-top:10px">
        <input type="date" id="ag_data" value="${d}" onchange="changeAgendaDate(this.value)" />
        <span class="small muted">Dica: clique nas datas para ver as vagas.</span>
      </div>
    </div>

    <!-- Vagas do dia + formulário -->
    <div class="grid">
      <div class="card">
        <div class="between">
          <h3>Vagas em ${d}</h3>
          <div class="pill ${bookings.length? 'neutral' : 'ok'}">${bookings.length||0} agendamentos</div>
        </div>
        <table>
          <thead><tr><th>Hora</th><th>Cliente</th><th>Obs.</th><th>Usuário</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="card" id="bookingFormWrap">
        <h3>Novo / Editar Agendamento</h3>
        <p class="small muted">Agende com cliente cadastrado ou informe um nome livre.</p>
        <form onsubmit="saveBooking(event)">
          <div class="row">
            <div style="flex:1"><label>Data</label><input type="date" id="bk_date" value="${d}" required /></div>
            <div style="flex:1"><label>Hora</label><select id="bk_time">${slots.map(s=>`<option>${s}</option>`).join('')}</select></div>
            <div style="flex:1"><label>Duração</label><select id="bk_dur"><option value="30">30 min</option><option value="60">60 min</option></select></div>
          </div>
          <div class="row">
            <div style="flex:1"><label>Cliente (cadastrado)</label><select id="bk_client"><option value="">— Selecionar —</option>${state.clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
            <div style="flex:1"><label>ou Nome (sem cadastro)</label><input id="bk_client_free" placeholder="Ex.: Maria da Silva" /></div>
          </div>
          <div class="row">
            <div style="flex:1"><label>Usuário responsável</label><select id="bk_user" required>${state.users.map(u=>`<option value="${u.id}">${u.nome} (${u.role})</option>`).join('')}</select></div>
          </div>
          <div class="row"><div style="flex:1"><label>Observações</label><textarea id="bk_obs" rows="3" placeholder="Informações adicionais"></textarea></div></div>
          <input type="hidden" id="bk_id" />
          <div class="between"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" onclick="resetBookingForm()">Limpar</button></div>
        </form>
      </div>
    </div>
  </div>`;
}

function changeAgendaDate(v){ const params=new URLSearchParams(location.hash.slice(1)); params.set('date', v); location.hash=params.toString(); render(); }
function openNewBooking(date,time){ currentTab='agenda'; render(()=>{}); setTimeout(()=>{ document.getElementById('bk_date').value=date; document.getElementById('bk_time').value=time; resetBookingForm(); },0); }
function editBooking(id){ const b=state.bookings.find(x=>x.id===id); if(!b) return; render(()=>{}); setTimeout(()=>{ document.getElementById('bk_id').value=b.id; document.getElementById('bk_date').value=b.date; document.getElementById('bk_time').value=b.time; document.getElementById('bk_dur').value=b.duration; document.getElementById('bk_user').value=b.userId; document.getElementById('bk_client').value=b.clientId||''; document.getElementById('bk_client_free').value=b.clientNameLivre||''; document.getElementById('bk_obs').value=b.obs||''; },0); }
function deleteBooking(id){ if(!confirm('Excluir este agendamento?')) return; state.bookings = state.bookings.filter(b=>b.id!==id); commit(); }
function resetBookingForm(){ ['bk_id','bk_client_free','bk_obs'].forEach(id=>document.getElementById(id).value=''); document.getElementById('bk_client').value=''; }
function saveBooking(ev){
  ev.preventDefault();
  const id = document.getElementById('bk_id').value || uid();
  const date = document.getElementById('bk_date').value;
  const time = document.getElementById('bk_time').value;
  const duration = Number(document.getElementById('bk_dur').value||30);
  const userId = document.getElementById('bk_user').value;
  const clientId = document.getElementById('bk_client').value || null;
  const clientNameLivre = (document.getElementById('bk_client_free').value||'').trim();
  const obs = document.getElementById('bk_obs').value;
  if(!clientId && !clientNameLivre){ alert('Informe um cliente cadastrado OU um nome livre.'); return; }
  const existed = state.bookings.find(b=>b.id===id);
  const changedSlot = !existed || existed.date!==date || existed.time!==time;
  if(changedSlot && hasConflict(date,time)){ alert('Já existe agendamento para este horário.'); return; }
  const booking = { id, date, time, duration, userId, clientId, clientNameLivre: clientId? '' : clientNameLivre, obs };
  if(existed) Object.assign(existed, booking); else state.bookings.push(booking);
  commit(); resetBookingForm();
}

// ----------------- Clientes -----------------
function viewClients(){
  const list = state.clients.slice().sort((a,b)=> a.nome.localeCompare(b.nome));
  const rows = list.map(c=>`<tr>
    <td>${c.nome}</td>
    <td class="small">${c.telefone||'—'}</td>
    <td class="small">${c.email||'—'}</td>
    <td class="small muted">${c.observacoes||''}</td>
    <td class="between">
      <button class="btn warn" onclick="editClient('${c.id}')">Editar</button>
      <button class="btn danger" onclick="deleteClient('${c.id}')">Excluir</button>
    </td>
  </tr>`).join('');
  return `
    <div class="grid grid-2">
      <div class="card">
        <h3>Clientes</h3>
        <table>
          <thead><tr><th>Nome</th><th>Telefone</th><th>Email</th><th>Obs.</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted small">Nenhum cliente cadastrado.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>Novo / Editar Cliente</h3>
        <form onsubmit="saveClient(event)">
          <div class="row"><div style="flex:1"><label>Nome</label><input id="cl_nome" required placeholder="Ex.: João Pereira" /></div></div>
          <div class="row"><div style="flex:1"><label>Telefone</label><input id="cl_tel" placeholder="(xx) xxxxx-xxxx" /></div><div style="flex:1"><label>Email</label><input id="cl_mail" type="email" placeholder="email@exemplo.com" /></div></div>
          <div class="row"><div style="flex:1"><label>Observações</label><textarea id="cl_obs" rows="3"></textarea></div></div>
          <input type="hidden" id="cl_id" />
          <div class="between"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" onclick="resetClientForm()">Limpar</button></div>
        </form>
      </div>
    </div>`;
}
function editClient(id){ const c=state.clients.find(x=>x.id===id); if(!c) return; setTimeout(()=>{ document.getElementById('cl_id').value=c.id; document.getElementById('cl_nome').value=c.nome; document.getElementById('cl_tel').value=c.telefone||''; document.getElementById('cl_mail').value=c.email||''; document.getElementById('cl_obs').value=c.observacoes||''; },0); }
function deleteClient(id){ if(!confirm('Excluir este cliente?')) return; state.clients = state.clients.filter(c=>c.id!==id); state.bookings = state.bookings.map(b=> (b.clientId===id? {...b, clientId:null} : b)); commit(); }
function resetClientForm(){ ['cl_id','cl_nome','cl_tel','cl_mail','cl_obs'].forEach(id=> document.getElementById(id).value=''); }
function saveClient(ev){ ev.preventDefault(); const id=document.getElementById('cl_id').value||uid(); const nome=document.getElementById('cl_nome').value.trim(); const telefone=document.getElementById('cl_tel').value.trim(); const email=document.getElementById('cl_mail').value.trim(); const observacoes=document.getElementById('cl_obs').value.trim(); const existed=state.clients.find(x=>x.id===id); const c={id,nome,telefone,email,observacoes}; if(existed) Object.assign(existed,c); else state.clients.push(c); commit(); resetClientForm(); }

// ----------------- Usuários (apenas admin) -----------------
function viewUsers(){
  if(!isAdmin()) return `<div class="card"><p>Somente administradores podem acessar esta área.</p></div>`;
  const rows = state.users.map(u=>`<tr>
    <td>${u.nome}</td>
    <td class="small">${u.email}</td>
    <td><span class="pill ${u.role==='admin'?'ok':'neutral'}">${u.role}</span></td>
    <td class="between">
      <button class="btn warn" onclick="editUser('${u.id}')">Editar</button>
      <button class="btn danger" onclick="deleteUser('${u.id}')" ${me().id===u.id?'disabled':''}>Excluir</button>
    </td>
  </tr>`).join('');
  return `
  <div class="grid grid-2">
    <div class="card">
      <h3>Usuários</h3>
      <table>
        <thead><tr><th>Nome</th><th>Email</th><th>Papel</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Novo / Editar Usuário</h3>
      <form onsubmit="saveUser(event)">
        <div class="row"><div style="flex:1"><label>Nome</label><input id="us_nome" required /></div><div style="flex:1"><label>Email</label><input id="us_mail" type="email" required /></div></div>
        <div class="row"><div style="flex:1"><label>Papel</label><select id="us_role"><option value="admin">admin</option><option value="atendente">atendente</option></select></div></div>
        <div class="row"><div style="flex:1"><label>Senha (deixe vazio para manter)</label><input id="us_pass" type="password" placeholder="••••••" /></div></div>
        <input type="hidden" id="us_id" />
        <div class="between"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" onclick="resetUserForm()">Limpar</button></div>
      </form>
    </div>
  </div>`;
}
function editUser(id){ const u=state.users.find(x=>x.id===id); if(!u) return; setTimeout(()=>{ document.getElementById('us_id').value=u.id; document.getElementById('us_nome').value=u.nome; document.getElementById('us_mail').value=u.email; document.getElementById('us_role').value=u.role; document.getElementById('us_pass').value=''; },0); }
function deleteUser(id){ if(!confirm('Excluir este usuário?')) return; if(me().id===id){ alert('Você não pode excluir a si mesmo.'); return; } state.users = state.users.filter(u=>u.id!==id); state.bookings = state.bookings.map(b=> (b.userId===id? {...b, userId: (state.users[0]?.id || null)} : b)); if(state.auth.userId===id) state.auth.userId=null; commit(); }
function resetUserForm(){ ['us_id','us_nome','us_mail','us_pass'].forEach(i=>document.getElementById(i).value=''); }
function saveUser(ev){
  ev.preventDefault();
  const id=document.getElementById('us_id').value||uid();
  const nome=document.getElementById('us_nome').value.trim();
  const email=document.getElementById('us_mail').value.trim();
  const role=document.getElementById('us_role').value;
  const pass=document.getElementById('us_pass').value;
  const existed=state.users.find(x=>x.id===id);
  if(existed){
    existed.nome=nome; existed.email=email; existed.role=role;
    if(pass) existed.passwordHash = hash(pass);
  }else{
    state.users.push({ id, nome, email, role, passwordHash: pass? hash(pass) : hash('123456'), createdAt: nowISO() });
  }
  commit(); resetUserForm();
}

// ----------------- Financeiro -----------------
function viewFinance(){
  const list = state.finance.slice().sort((a,b)=> a.data.localeCompare(b.data));
  const total = list.reduce((acc,i)=> acc + (i.tipo==='entrada'? +i.valor : -i.valor), 0);
  const rows = list.map(f=>`<tr>
    <td class="small mono">${f.data}</td>
    <td>${f.descricao||'—'}</td>
    <td>${f.tipo==='entrada'? '<span class="pill ok">Entrada</span>' : '<span class="pill bad">Saída</span>'}</td>
    <td class="mono">${toBRL(f.valor)}</td>
    <td class="small mono">${f.vinculoBookingId? f.vinculoBookingId.slice(0,6)+'…':'—'}</td>
    <td class="between"><button class="btn warn" onclick="editFinance('${f.id}')">Editar</button><button class="btn danger" onclick="deleteFinance('${f.id}')">Excluir</button></td>
  </tr>`).join('');
  return `
    <div class="grid grid-2">
      <div class="card">
        <div class="between"><h3>Lançamentos</h3><div class="pill ${total>=0?'ok':'bad'}">Saldo: <strong>${toBRL(total)}</strong></div></div>
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Vínculo</th><th>Ações</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="muted small">Nenhum lançamento.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>Novo / Editar Lançamento</h3>
        <form onsubmit="saveFinance(event)">
          <div class="row"><div style="flex:1"><label>Data</label><input id="fi_data" type="date" value="${today()}" required /></div>
          <div style="flex:1"><label>Tipo</label><select id="fi_tipo"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div></div>
          <div class="row"><div style="flex:1"><label>Valor</label><input id="fi_valor" type="number" step="0.01" min="0" required /></div></div>
          <div class="row"><div style="flex:1"><label>Descrição</label><input id="fi_desc" placeholder="Ex.: Pagamento consulta" /></div></div>
          <div class="row"><div style="flex:1"><label>Vincular a Agendamento (opcional)</label><select id="fi_book"><option value="">— Nenhum —</option>${state.bookings.map(b=>`<option value="${b.id}">${b.date} ${b.time} • ${b.clientId? (state.clients.find(c=>c.id===b.clientId)?.nome||'Cliente'): (b.clientNameLivre||'Cliente')}</option>`).join('')}</select></div></div>
          <input type="hidden" id="fi_id" />
          <div class="between"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" onclick="resetFinanceForm()">Limpar</button></div>
        </form>
      </div>
    </div>`;
}
function editFinance(id){ const f=state.finance.find(x=>x.id===id); if(!f) return; setTimeout(()=>{ document.getElementById('fi_id').value=f.id; document.getElementById('fi_data').value=f.data; document.getElementById('fi_tipo').value=f.tipo; document.getElementById('fi_valor').value=f.valor; document.getElementById('fi_desc').value=f.descricao||''; document.getElementById('fi_book').value=f.vinculoBookingId||''; },0); }
function deleteFinance(id){ if(!confirm('Excluir este lançamento?')) return; state.finance = state.finance.filter(f=>f.id!==id); commit(); }
function resetFinanceForm(){ ['fi_id','fi_valor','fi_desc'].forEach(i=>document.getElementById(i).value=''); document.getElementById('fi_book').value=''; document.getElementById('fi_data').value=today(); document.getElementById('fi_tipo').value='entrada'; }
function saveFinance(ev){ ev.preventDefault(); const id=document.getElementById('fi_id').value||uid(); const data=document.getElementById('fi_data').value; const tipo=document.getElementById('fi_tipo').value; const valor=parseFloat(document.getElementById('fi_valor').value||'0'); const descricao=(document.getElementById('fi_desc').value||'').trim(); const vinc=document.getElementById('fi_book').value||null; const existed=state.finance.find(x=>x.id===id); const item={id,data,tipo,valor,descricao,vinculoBookingId:vinc}; if(existed) Object.assign(existed,item); else state.finance.push(item); commit(); resetFinanceForm(); }

// ----------------- Config -----------------
function viewConfig(){
  if(!isAdmin()) return `<div class="card"><p>Somente administradores podem acessar esta área.</p></div>`;
  const c = state.config;
  return `
    <div class="grid">
      <div class="card">
        <h3>Configurações da Agenda</h3>
        <form onsubmit="saveConfig(event)">
          <div class="row">
            <div style="flex:1"><label>Início do expediente</label><input id="cfg_ini" type="time" value="${c.agendaInicio}" required /></div>
            <div style="flex:1"><label>Fim do expediente</label><input id="cfg_fim" type="time" value="${c.agendaFim}" required /></div>
            <div style="flex:1"><label>Intervalo (min)</label><select id="cfg_step"><option value="30" ${c.step==30?'selected':''}>30</option><option value="60" ${c.step==60?'selected':''}>60</option></select></div>
          </div>
          <div class="between" style="margin-top:10px"><button class="btn primary" type="submit">Salvar Configurações</button><button class="btn danger" type="button" onclick="wipeAll()">Apagar Tudo</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Exportar / Importar (Backup)</h3>
        <div class="row">
          <button class="btn" onclick="exportData()">Exportar JSON</button>
          <label class="btn ghost" style="cursor:pointer">Importar JSON<input id="import_file" type="file" accept="application/json" class="hide" onchange="importData(event)" /></label>
        </div>
        <p class="small muted">O arquivo contém usuários, clientes, agendamentos e financeiro.</p>
      </div>
    </div>`;
}
function saveConfig(ev){ ev.preventDefault(); const ini=document.getElementById('cfg_ini').value; const fim=document.getElementById('cfg_fim').value; const step=Number(document.getElementById('cfg_step').value); state.config={agendaInicio:ini, agendaFim:fim, step}; commit(); alert('Configurações salvas.'); }
function wipeAll(){ if(!confirm('Tem certeza que deseja APAGAR TODOS os dados?')) return; localStorage.removeItem(LS_KEY); state = readState(); render(); }
function exportData(){ const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='backup_agenda.json'; a.click(); URL.revokeObjectURL(url); }
function importData(ev){ const file = ev.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (e)=>{ try{ const data=JSON.parse(e.target.result); state=data; commit(); alert('Importado com sucesso. Faça login novamente, se necessário.'); }catch(err){ alert('Arquivo inválido.'); } }; reader.readAsText(file); }

// ----------------- Dados Demo (opcional) -----------------
function seedDemo(){
  const u1 = state.users[0];
  const c1 = { id:uid(), nome:'Maria Souza', telefone:'(11) 99999-1111', email:'maria@exemplo.com', observacoes:'' };
  const c2 = { id:uid(), nome:'Carlos Lima', telefone:'(21) 98888-2222', email:'carlos@exemplo.com', observacoes:'VIP' };
  state.clients.push(c1,c2);
  state.bookings.push({ id:uid(), date:today(), time:'09:00', duration:60, userId:u1.id, clientId:c1.id, clientNameLivre:'', obs:'Retorno' });
  state.finance.push({ id:uid(), data:today(), tipo:'entrada', valor:200, descricao:'Consulta Maria', vinculoBookingId: state.bookings[0].id });
  commit();
}

// ----------------- Bootstrap -----------------
window.addEventListener('hashchange',()=>{ if(currentTab==='agenda') render(); });
render();
