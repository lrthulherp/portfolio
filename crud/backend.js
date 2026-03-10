const express = require('express');
const fs = require('fs');
const path = require('path');

const server = express();

// -------- Config --------
server.use(express.json());

// Serve the same front-end files without changing visuals
server.use(express.static(__dirname));

// Resolve DB path robustly (supports ./data/db.json or ./db.json)
const DB_PATH = (() => {
  const p1 = path.join(__dirname, 'data', 'db.json');
  const p2 = path.join(__dirname, 'db.json');
  if (fs.existsSync(p1)) return p1;
  if (fs.existsSync(p2)) return p2;
  // fallback to original relative path if you insist, but we'll create db.json here
  return p2;
})();

function ensureSchema(obj) {
  if (!obj || typeof obj !== 'object') return { db_Client: [] };
  if (!Array.isArray(obj.db_Client)) obj.db_Client = [];
  return obj;
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { db_Client: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), 'utf-8');
    return init;
  }
  const content = fs.readFileSync(DB_PATH, 'utf-8');
  try {
    return ensureSchema(JSON.parse(content));
  } catch (e) {
    // If file is corrupted, do not silently destroy it; throw a clear error.
    throw new Error(`DB JSON inválido em ${DB_PATH}: ${e.message}`);
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

function newId() {
  // Prefer crypto.randomUUID when available (Node 14.17+ has crypto.randomUUID in 'crypto')
  try {
    const crypto = require('crypto');
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  // fallback
  return Math.random().toString(32).slice(2, 11);
}

// -------- API --------
// Return only the array (front expects array)
server.get('/clients', (req, res) => {
  const db = readDb();
  res.json(db.db_Client);
});

server.post('/clients', (req, res) => {
  const { nome, email, celular, cidade } = req.body || {};
  if (!nome || !email) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email' });
  }

  const db = readDb();
  const id = newId();

  const client = { id, nome, email, celular: celular || '', cidade: cidade || '' };
  db.db_Client.push(client);

  writeDb(db);
  res.status(201).json(client);
});

server.put('/clients/:id', (req, res) => {
  const { id } = req.params;
  const { nome, email, celular, cidade } = req.body || {};

  const db = readDb();
  const idx = db.db_Client.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' });

  const current = db.db_Client[idx];
  const updated = {
    ...current,
    nome: (nome !== undefined && nome !== null && nome !== '') ? nome : current.nome,
    email: (email !== undefined && email !== null && email !== '') ? email : current.email,
    celular: (celular !== undefined && celular !== null) ? celular : current.celular,
    cidade: (cidade !== undefined && cidade !== null) ? cidade : current.cidade,
  };

  db.db_Client[idx] = updated;
  writeDb(db);
  res.json(updated);
});

server.delete('/clients/:id', (req, res) => {
  const { id } = req.params;

  const db = readDb();
  const idx = db.db_Client.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' });

  db.db_Client.splice(idx, 1);
  writeDb(db);
  res.json({ ok: true });
});

// Convenience: keep old root behavior (optional)
server.get('/db', (req, res) => {
  const db = readDb();
  res.json(db);
});

// -------- Start --------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`server rodando em http://localhost:${PORT}`));
