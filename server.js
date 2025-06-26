const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Générer une URL sécurisée si elle n'existe pas
const SECURE_PATH = process.env.SECURE_PATH || generateSecurePath();

function generateSecurePath() {
  return uuidv4() + '-' + uuidv4();
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialiser la base de données avec fichier persistant
const dbPath = process.env.NODE_ENV === 'production' ? '/app/data/tasks.db' : './tasks.db';

// Créer le dossier data s'il n'existe pas
if (process.env.NODE_ENV === 'production') {
  const dataDir = '/app/data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

const db = new sqlite3.Database(dbPath);

// Créer les tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#007bff',
    project_id INTEGER,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATE,
    assigned_to TEXT,
    status TEXT DEFAULT 'todo',
    category_id INTEGER,
    project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(project_id) REFERENCES projects(id)
  )`);

  // Vérifier s'il y a déjà des données, sinon ajouter des données d'exemple
  db.get("SELECT COUNT(*) as count FROM projects", (err, row) => {
    if (!err && row.count === 0) {
      // Données d'exemple seulement si la base est vide
      db.run("INSERT INTO projects (name, description) VALUES ('Projet Demo', 'Projet de démonstration avec tâches exemple')");
      db.run("INSERT INTO categories (name, color, project_id) VALUES ('Urgent', '#dc3545', 1)");
      db.run("INSERT INTO categories (name, color, project_id) VALUES ('Normal', '#28a745', 1)");
      db.run("INSERT INTO categories (name, color, project_id) VALUES ('Idées', '#6f42c1', 1)");
      db.run("INSERT INTO tasks (title, description, deadline, assigned_to, category_id, project_id) VALUES ('Configurer l\\'environnement', 'Mettre en place Docker et l\\'application', '2025-07-01', 'Admin', 1, 1)");
      db.run("INSERT INTO tasks (title, description, deadline, assigned_to, category_id, project_id, status) VALUES ('Créer les premières tâches', 'Ajouter des tâches de test dans l\\'interface', '2025-07-05', 'Utilisateur', 2, 1, 'in_progress')");
      db.run("INSERT INTO tasks (title, description, assigned_to, category_id, project_id, status) VALUES ('Tester l\\'application', 'Vérifier toutes les fonctionnalités', 'Testeur', 2, 1, 'todo')");
    }
  });
});

// Middleware de protection par URL
function protectRoute(req, res, next) {
  const requestPath = req.path.substring(1); // Enlever le premier /
  if (requestPath !== SECURE_PATH && !requestPath.startsWith(SECURE_PATH + '/')) {
    return res.status(404).send('Page non trouvée');
  }
  next();
}

// Routes API
app.get(`/${SECURE_PATH}/api/projects`, (req, res) => {
  db.all("SELECT * FROM projects ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post(`/${SECURE_PATH}/api/projects`, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom du projet est requis' });
  
  db.run("INSERT INTO projects (name, description) VALUES (?, ?)", [name, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, description });
  });
});

app.get(`/${SECURE_PATH}/api/categories/:projectId`, (req, res) => {
  const projectId = req.params.projectId;
  db.all("SELECT * FROM categories WHERE project_id = ? ORDER BY name", [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post(`/${SECURE_PATH}/api/categories`, (req, res) => {
  const { name, color, project_id } = req.body;
  if (!name || !project_id) return res.status(400).json({ error: 'Nom et projet requis' });
  
  db.run("INSERT INTO categories (name, color, project_id) VALUES (?, ?, ?)", [name, color || '#007bff', project_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, color, project_id });
  });
});

app.get(`/${SECURE_PATH}/api/tasks/:projectId`, (req, res) => {
  const projectId = req.params.projectId;
  db.all(`SELECT t.*, c.name as category_name, c.color as category_color 
          FROM tasks t 
          LEFT JOIN categories c ON t.category_id = c.id 
          WHERE t.project_id = ? 
          ORDER BY t.created_at DESC`, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post(`/${SECURE_PATH}/api/tasks`, (req, res) => {
  const { title, description, deadline, assigned_to, category_id, project_id } = req.body;
  if (!title || !project_id) return res.status(400).json({ error: 'Titre et projet requis' });
  
  db.run("INSERT INTO tasks (title, description, deadline, assigned_to, category_id, project_id) VALUES (?, ?, ?, ?, ?, ?)", 
    [title, description, deadline, assigned_to, category_id, project_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title, description, deadline, assigned_to, category_id, project_id });
  });
});

app.put(`/${SECURE_PATH}/api/tasks/:id`, (req, res) => {
  const { id } = req.params;
  const { title, description, deadline, assigned_to, status, category_id } = req.body;
  
  db.run("UPDATE tasks SET title = ?, description = ?, deadline = ?, assigned_to = ?, status = ?, category_id = ? WHERE id = ?", 
    [title, description, deadline, assigned_to, status, category_id, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete(`/${SECURE_PATH}/api/tasks/:id`, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM tasks WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Servir les fichiers statiques sur l'URL protégée
app.use(`/${SECURE_PATH}`, express.static('public'));

// Redirection racine vers l'URL sécurisée
app.get('/', (req, res) => {
  res.redirect(`/${SECURE_PATH}`);
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).send('Page non trouvée');
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🔐 URL sécurisée: http://localhost:${PORT}/${SECURE_PATH}`);
  console.log(`📊 Base de données: ${dbPath}`);
});
