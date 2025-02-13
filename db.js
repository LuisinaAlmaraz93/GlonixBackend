const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Usa la variable de Render
  ssl: { rejectUnauthorized: false } // Necesario para Render
});

// Verificar conexión
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Error conectando a la base de datos:", err);
  } else {
    console.log("✅ Conexión exitosa a PostgreSQL. Hora actual:", res.rows[0].now);
  }
});

module.exports = pool;
