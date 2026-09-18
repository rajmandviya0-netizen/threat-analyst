const pool = require('./db');

async function checkBruteForce(io) {
  const query = `
    SELECT source_ip, COUNT(*) as attempts
    FROM logs
    WHERE event_type = 'login_attempt'
      AND status = 'failure'
      AND created_at > NOW() - INTERVAL '2 minutes'
    GROUP BY source_ip
    HAVING COUNT(*) >= 3
  `;
  const result = await pool.query(query);

  for (const row of result.rows) {
    const exists = await pool.query(
      `SELECT id FROM alerts WHERE rule_name = 'Brute Force Attempt' AND description LIKE '%' || $1 || '%' AND created_at > NOW() - INTERVAL '2 minutes'`,
      [row.source_ip]
    );
    if (exists.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO alerts (rule_name, severity, description) VALUES ($1, $2, $3) RETURNING *`,
        ['Brute Force Attempt', 'high', `${row.attempts} failed login attempts from ${row.source_ip} in the last 2 minutes`]
      );
      console.log(`ALERT: Brute Force from ${row.source_ip}`);
      if (io) io.emit('newAlert', inserted.rows[0]);
    }
  }
}

async function checkPortScan(io) {
  const query = `
    SELECT source_ip, COUNT(*) as attempts
    FROM logs
    WHERE event_type = 'port_scan'
      AND created_at > NOW() - INTERVAL '2 minutes'
    GROUP BY source_ip
    HAVING COUNT(*) >= 3
  `;
  const result = await pool.query(query);

  for (const row of result.rows) {
    const exists = await pool.query(
      `SELECT id FROM alerts WHERE rule_name = 'Port Scan Detected' AND description LIKE '%' || $1 || '%' AND created_at > NOW() - INTERVAL '2 minutes'`,
      [row.source_ip]
    );
    if (exists.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO alerts (rule_name, severity, description) VALUES ($1, $2, $3) RETURNING *`,
        ['Port Scan Detected', 'medium', `${row.attempts} port scan events from ${row.source_ip} in the last 2 minutes`]
      );
      console.log(`ALERT: Port Scan from ${row.source_ip}`);
      if (io) io.emit('newAlert', inserted.rows[0]);
    }
  }
}

async function runDetectionRules(io) {
  try {
    await checkBruteForce(io);
    await checkPortScan(io);
  } catch (err) {
    console.error('Detection rule error:', err.message);
  }
}

module.exports = { runDetectionRules };