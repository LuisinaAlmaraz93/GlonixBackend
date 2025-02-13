const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // Conexión a la base de datos

const app = express();
app.use(bodyParser.json());

// Ruta de prueba para verificar que el servidor funciona
app.get("/", (req, res) => {
    res.send("✅ El servidor está funcionando correctamente.");
});

// Crear la tabla si no existe
async function createTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS subscriptions (
            id SERIAL PRIMARY KEY,
            paypal_id VARCHAR(50) UNIQUE NOT NULL,
            status VARCHAR(20) NOT NULL,
            plan_id VARCHAR(50),
            subscriber_email VARCHAR(100),
            start_time TIMESTAMP
        );
    `;
    await pool.query(query);
    console.log("✅ Tabla de suscripciones creada.");
}

createTable();

// Ruta para el webhook de PayPal
app.post("/paypal/webhook", async (req, res) => {
    console.log("⚡ Webhook recibido:", req.body);

    // Verificar el evento de PayPal
    const eventType = req.body.event_type;

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
        const data = req.body.resource;

        try {
            await pool.query(
                "INSERT INTO subscriptions (paypal_id, status, plan_id, subscriber_email, start_time) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (paypal_id) DO NOTHING",
                [data.id, data.status, data.plan_id, data.subscriber.email_address, data.start_time]
            );

            console.log("✅ Suscripción guardada en la base de datos.");
        } catch (error) {
            console.error("❌ Error guardando la suscripción:", error);
        }
    }

    res.sendStatus(200); // Confirmar recepción
});

// Iniciar el servidor en el puerto 8080 (Render usa este puerto)
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
