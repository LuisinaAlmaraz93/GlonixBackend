require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Error conectando a la base de datos:", err.message, err.stack);
  } else {
    console.log("✅ Conexión exitosa a PostgreSQL. Hora actual:", res.rows[0].now);
  }
});

module.exports = pool;
