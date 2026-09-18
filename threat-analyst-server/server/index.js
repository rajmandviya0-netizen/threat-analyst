require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const pool = require('./db');
const { runDetectionRules } = require('./ruleEngine');
const { triageAlert, triageSearch } = require('./triage.service');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:4200' }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/db-check', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ connected: true, time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY id DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs', async (req, res) => {
  const { source_ip, event_type, username, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO logs (source_ip, event_type, username, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [source_ip, event_type, username, status]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alerts ORDER BY id DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/:id/triage', async (req, res) => {
  try {
    const { id } = req.params;
    const alertResult = await pool.query('SELECT * FROM alerts WHERE id = $1', [id]);
    if (alertResult.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    const alert = alertResult.rows[0];
    const triage = await triageAlert(alert);
    await pool.query(
      'UPDATE alerts SET explanation = $1, mitre_id = $2, mitre_technique = $3 WHERE id = $4',
      [triage.explanation, triage.mitreId, triage.mitreTechnique, id]
    );
    res.json(triage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/search', async (req, res) => {
  try {
    const { query } = req.body;
    const triage = await triageSearch(query);
    const result = await pool.query(triage.sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('Frontend connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Frontend disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => runDetectionRules(io), 15000);