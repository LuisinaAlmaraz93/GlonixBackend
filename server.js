const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // Conexión a la base de datos
const jwt = require("jsonwebtoken"); // Importamos jsonwebtoken para los tokens
const SECRET_KEY = "mi_secreto_super_seguro"; // 🔥 Cambia esto por una clave segura

const app = express();
app.use(bodyParser.json());


// Envío de correos con contraseñas a suscriptores

const nodemailer = require("nodemailer"); // Importamos nodemailer

// Configurar transporte de correo
const transporter = nodemailer.createTransport({
    service: "gmail",  // 🔹 Puedes cambiarlo si usas otro proveedor (ej: Outlook, Yahoo)
    auth: {
        user: "tuemail@gmail.com",  // 🔥 PON AQUÍ TU EMAIL
        pass: "tucontraseña"  // 🔥 PON AQUÍ TU CONTRASEÑA O APP PASSWORD
    }
});

// Función para enviar el correo con la contraseña
const enviarCorreo = async (email, password) => {
    const mailOptions = {
        from: "tuemail@gmail.com",
        to: email,
        subject: "Bienvenido a Glonixia - Tu contraseña de acceso",
        text: `Hola, gracias por suscribirte a Glonixia. Tu contraseña de acceso es: ${password}.
        
        Recuerda cambiarla cuando inicies sesión en la plataforma.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Correo enviado a ${email}`);
    } catch (error) {
        console.error("❌ Error enviando el correo:", error);
    }
};


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
            subscriber_email VARCHAR(100) UNIQUE NOT NULL,
            password TEXT,  -- Agregamos el campo de contraseña
            start_time TIMESTAMP
        );
    `;
    await pool.query(query);
    console.log("✅ Tabla de suscripciones creada o actualizada.");
}

createTable();

// ✅ **Ruta para el webhook de PayPal**
const crypto = require("crypto"); // Importamos crypto para generar contraseñas aleatorias

app.post("/paypal/webhook", async (req, res) => {
    console.log("⚡ Webhook recibido:", req.body);

    const eventType = req.body.event_type;

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
        const data = req.body.resource;
        const randomPassword = crypto.randomBytes(8).toString("hex"); // Generamos una contraseña aleatoria

        try {
            await pool.query(
                "INSERT INTO subscriptions (paypal_id, status, plan_id, subscriber_email, password, start_time) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (paypal_id) DO NOTHING",
                [data.id, data.status, data.plan_id, data.subscriber.email_address, randomPassword, data.start_time]
            );

            console.log(`✅ Suscripción guardada. Contraseña generada para ${data.subscriber.email_address}: ${randomPassword}`);

            // 📧 Enviar la contraseña por correo
         // 📧 Enviar la contraseña por correo a tu email real
await enviarCorreo("luisina.almaraz.3@gmail.com", randomPassword);
console.log(`📧 Contraseña enviada a luisina.almaraz.3@gmail.com`);


        } catch (error) {
            console.error("❌ Error guardando la suscripción o enviando correo:", error);
        }
    }

    res.sendStatus(200); // Confirmar recepción
});



// ✅ **Ruta para generar el token JWT**
app.post("/login", async (req, res) => {
    const { email } = req.body; // Recibe el email desde el frontend

    try {
        // Verificar si el email existe en la base de datos
        const result = await pool.query("SELECT * FROM subscriptions WHERE subscriber_email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Acceso denegado: No estás suscripto." });
        }

        // 🔹 Si el email existe, creamos el token JWT
        const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: "1h" });

        res.json({ token }); // Enviamos el token al usuario
    } catch (error) {
        console.error("❌ Error en el login:", error);
        res.status(500).json({ message: "Error en el servidor" });
    }
});

// ✅ **Ruta para que los usuarios configuren su contraseña**

const bcrypt = require("bcrypt"); // Importamos bcrypt para encriptar contraseñas

app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 🔹 Encriptamos la contraseña

        const result = await pool.query(
            "UPDATE subscriptions SET password = $1 WHERE subscriber_email = $2 RETURNING *",
            [hashedPassword, email]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        res.json({ message: "Contraseña actualizada con éxito." });
    } catch (error) {
        console.error("❌ Error en la actualización de contraseña:", error);
        res.status(500).json({ message: "Error en el servidor" });
    }
});

// ✅ **Middleware para verificar token**
const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ message: "Acceso denegado: No tienes token." });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY); // Verificamos el token
        req.user = decoded; // Guardamos la info del usuario en la petición
        next(); // 🔹 Si el token es válido, dejamos continuar la petición
    } catch (error) {
        return res.status(401).json({ message: "Token inválido o expirado." });
    }
};

// ✅ **Ruta protegida para `Members.html`**
app.get("/members", verificarToken, (req, res) => {
    res.sendFile(__dirname + "/Members.html"); // Envía el archivo Members.html si el token es válido
});

// ✅ NUEVA RUTA PARA VER LAS SUSCRIPCIONES DESDE EL NAVEGADOR
app.get("/ver-suscripciones", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM subscriptions");
        res.json(result.rows); // Muestra los datos en JSON
    } catch (error) {
        console.error("❌ Error consultando suscripciones:", error);
        res.status(500).send("Error consultando la base de datos");
    }
});

// 📌 Diagnóstico: Ver todas las rutas registradas en Express
app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
        console.log(`🛠 Ruta registrada: ${r.route.path}`);
    }
});



// Iniciar el servidor en el puerto 8080 (Render usa este puerto)
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
