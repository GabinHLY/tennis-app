const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup upload folder
const upload = multer({ dest: path.join(__dirname, 'uploads') });
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// SQLite DB
const db = new sqlite3.Database('db.sqlite');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS complexes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT,
    adresse TEXT,
    surface TEXT,
    nombre_terrains INTEGER,
    lat REAL,
    lng REAL,
    photo TEXT,
    valide INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS terrains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complexe_id INTEGER,
    numero INTEGER,
    occupe INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(complexe_id) REFERENCES complexes(id)
  )`);
});

// PUBLIC : Liste des complexes validés avec leurs terrains
app.get('/complexes', (req, res) => {
  db.all(`SELECT * FROM complexes WHERE valide = 1`, [], (err, complexes) => {
    if (err) return res.status(500).json({ error: err.message });
    const ids = complexes.map(c => c.id);
    if (ids.length === 0) return res.json([]);
    db.all(`SELECT * FROM terrains WHERE complexe_id IN (${ids.map(() => '?').join(',')})`, ids, (err2, terrains) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const byComplexe = {};
      complexes.forEach(c => byComplexe[c.id] = { ...c, terrains: [] });
      terrains.forEach(t => byComplexe[t.complexe_id]?.terrains.push(t));
      res.json(Object.values(byComplexe));
    });
  });
});

// PUBLIC : Ajouter un complexe (et ses terrains)
app.post('/complexes', upload.single('photo'), (req, res) => {
  const { nom, adresse, surface, nombre_terrains, lat, lng } = req.body;
  const photo = req.file ? req.file.filename : null;
  db.run('INSERT INTO complexes (nom, adresse, surface, nombre_terrains, lat, lng, photo) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nom, adresse, surface, nombre_terrains, lat, lng, photo], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const complexeId = this.lastID;
      const stmt = db.prepare('INSERT INTO terrains (complexe_id, numero) VALUES (?, ?)');
      for (let i = 1; i <= Number(nombre_terrains); i++) {
        stmt.run(complexeId, i);
      }
      stmt.finalize();
      res.json({ id: complexeId });
    });
});

// PUBLIC : Changer l'état d'un terrain (libre/occupé)
app.post('/terrains/:id/occupation', (req, res) => {
  db.get('SELECT occupe FROM terrains WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const newState = row && row.occupe ? 0 : 1;
    db.run('UPDATE terrains SET occupe = ?, timestamp = CURRENT_TIMESTAMP WHERE id = ?', [newState, req.params.id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true, occupe: newState });
    });
  });
});

// ADMIN : Liste tous les complexes (validés ou non) avec terrains
app.get('/admin/complexes', (req, res) => {
  db.all(`SELECT * FROM complexes`, [], (err, complexes) => {
    if (err) return res.status(500).json({ error: err.message });
    const ids = complexes.map(c => c.id);
    if (ids.length === 0) return res.json([]);
    db.all(`SELECT * FROM terrains WHERE complexe_id IN (${ids.map(() => '?').join(',')})`, ids, (err2, terrains) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const byComplexe = {};
      complexes.forEach(c => byComplexe[c.id] = { ...c, terrains: [] });
      terrains.forEach(t => byComplexe[t.complexe_id]?.terrains.push(t));
      res.json(Object.values(byComplexe));
    });
  });
});

// ADMIN : Valider un complexe
app.patch('/admin/complexes/:id/valider', (req, res) => {
  db.run('UPDATE complexes SET valide = 1 WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ADMIN : Modifier un complexe
app.put('/admin/complexes/:id', upload.single('photo'), (req, res) => {
  const { nom, adresse, surface, nombre_terrains, lat, lng } = req.body;
  const photo = req.file ? req.file.filename : null;
  let query = 'UPDATE complexes SET nom = ?, adresse = ?, surface = ?, nombre_terrains = ?, lat = ?, lng = ?';
  let params = [nom, adresse, surface, nombre_terrains, lat, lng];
  if (photo) {
    query += ', photo = ?';
    params.push(photo);
  }
  query += ' WHERE id = ?';
  params.push(req.params.id);
  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ADMIN : Supprimer un complexe (et ses terrains)
app.delete('/admin/complexes/:id', (req, res) => {
  db.run('DELETE FROM terrains WHERE complexe_id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM complexes WHERE id = ?', [req.params.id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// ADMIN : Modifier/supprimer un terrain individuel
app.put('/admin/terrains/:id', (req, res) => {
  const { numero } = req.body;
  db.run('UPDATE terrains SET numero = ? WHERE id = ?', [numero, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});
app.delete('/admin/terrains/:id', (req, res) => {
  db.run('DELETE FROM terrains WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`)); 