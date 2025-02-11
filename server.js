const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// Ruta de prueba para verificar que el servidor funciona
app.get("/", (req, res) => {
    res.send("✅ El servidor está funcionando correctamente.");
});

// Ruta para el webhook de PayPal
app.post("/paypal/webhook", (req, res) => {
    console.log("⚡ Webhook recibido:", req.body);

    // Verificar el evento de PayPal
    const eventType = req.body.event_type;

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
        console.log("✅ Nueva suscripción activada:", req.body);
        // Aquí puedes guardar el usuario en la base de datos
    }

    res.sendStatus(200); // Confirmar recepción
});

// Iniciar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
