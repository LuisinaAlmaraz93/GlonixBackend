const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // Conexión a la base de datos
const jwt = require("jsonwebtoken"); // Importamos jsonwebtoken para los tokens
const SECRET_KEY = "mi_secreto_super_seguro"; // 🔥 Cambia esto por una clave segura
const bcrypt = require("bcrypt");

const app = express();
app.use(bodyParser.json());

// 🔹 Configurar CORS de manera más permisiva temporalmente 

const cors = require("cors");

const corsOptions = {
    origin: "*", // 🔥 Esto permite cualquier origen (prueba con esto primero)
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));


// Middleware extra para CORS (si es necesario)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // ⚠️ Permitir cualquier dominio (cambiar en producción)
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});



// Envío de correos con contraseñas a suscriptores

const nodemailer = require("nodemailer"); // Importamos nodemailer

// Configurar transporte de correo
const transporter = nodemailer.createTransport({
    service: "gmail",  
    auth: {
        user: "luisina.almaraz.3@gmail.com",
        pass: "aogzqohrgkogfzjl"
    }
});

// 🔹 Verificamos si el transporte de nodemailer está configurado correctamente
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ Error en la configuración de nodemailer:", error);
    } else {
        console.log("✅ Nodemailer está listo para enviar correos.");
    }
});



// Función para enviar el correo con la contraseña


const enviarCorreo = async (email, password) => {
    console.log(`📤 Intentando enviar correo a: ${email}`); 

    const mailOptions = {
        from: "luisina.almaraz.3@gmail.com",
        to: email,
        subject: "Bienvenido a Glonix - Tu contraseña de acceso",
        text: `Hola, gracias por suscribirte a Glonix. Tu contraseña de acceso es: ${password}.
        
        Recuerda cambiarla cuando inicies sesión en la plataforma.`
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`📧 Correo enviado a ${email} con respuesta: ${info.response}`);
    } catch (error) {
        console.error("❌ Error enviando el correo:", error);
    }
};


const path = require("path");

// Ruta para servir la página de inicio (suscribe.html)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Glonix", "Suscribe.html"));
});

// Ruta de prueba para ver si el servidor sigue funcionando
app.get("/test", (req, res) => {
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
            const hashedPassword = await bcrypt.hash(randomPassword, 10); // Encripta la contraseña
        
            console.log("🔍 Verificando datos antes de guardar en BD:");
            console.log("📌 Contraseña original:", randomPassword);
            console.log("🔒 Contraseña cifrada:", hashedPassword);
            console.log("📌 ID de PayPal:", data.id);
            console.log("📌 Email:", data.subscriber.email_address);
            console.log("📌 Plan ID:", data.plan_id);
            console.log("📌 Fecha de inicio:", data.start_time);
            console.log("📌 Tipo de dato de hashedPassword:", typeof hashedPassword); // 🔥 Esto nos dirá si está bien formado
            
            
            // ❗ Verificar si hashedPassword es `null` o `undefined`
            if (!hashedPassword || typeof hashedPassword !== "string") {
                console.error("❌ ERROR: hashedPassword es nulo, indefinido o no es un string");
                return res.status(500).json({ error: "No se pudo generar la contraseña cifrada" });
            }
            
            // Guardar en la base de datos
           
            const result = await pool.query(
                `INSERT INTO subscriptions (paypal_id, status, plan_id, subscriber_email, password, start_time) 
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (subscriber_email) 
                 DO UPDATE SET 
                    password = EXCLUDED.password,
                    status = EXCLUDED.status, 
                    plan_id = EXCLUDED.plan_id, 
                    start_time = EXCLUDED.start_time
                 RETURNING *`,
                [data.id, data.status, data.plan_id, data.subscriber.email_address, hashedPassword, data.start_time]
            );
            
           
            
    
            console.log(`✅ Suscripción guardada. Contraseña generada para ${data.subscriber.email_address}: ${randomPassword}`);
    
            // 📧 Enviar la contraseña por correo al usuario
            await enviarCorreo(data.subscriber.email_address, randomPassword);
            console.log(`✅ Correo enviado exitosamente a ${data.subscriber.email_address}`);

            // 📧 Enviar una copia del correo a tu dirección personal (opcional)
            await enviarCorreo("luisina.almaraz.3@gmail.com", `Contraseña generada para ${data.subscriber.email_address}: ${randomPassword}`);
            console.log("✅ Copia de correo enviada a admin.");
    
        } catch (error) {
            console.error("❌ Error guardando la suscripción o enviando correo:", error);
        }
    }

    res.sendStatus(200); // Confirmar recepción del webhook
});




app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    console.log(`🔍 Intentando iniciar sesión con: ${email}`);

    try {
        // Buscar usuario en la base de datos
        const result = await pool.query("SELECT * FROM subscriptions WHERE subscriber_email = $1", [email]);

        if (result.rows.length === 0) {
            console.log(`❌ Usuario no encontrado: ${email}`);
            return res.status(404).json({ message: "El usuario no está registrado." });
        }

        const user = result.rows[0];

        if (!user.password) {
            console.log(`❌ Error: Usuario ${email} no tiene contraseña almacenada.`);
            return res.status(500).json({ message: "Error del servidor. Contacta soporte." });
        }

        console.log(`🔍 Comparando contraseña ingresada con la almacenada en BD para ${email}`);
        
        // Comparar contraseña con bcrypt
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            console.log(`❌ Contraseña incorrecta para el usuario ${email}`);
            return res.status(401).json({ message: "Contraseña incorrecta." });
        }

        // ✅ Generar token JWT
        const token = jwt.sign({ email: user.subscriber_email }, SECRET_KEY, { expiresIn: "1h" });

        console.log(`✅ Inicio de sesión exitoso para: ${email}`);
        
        // Redirigir según si la contraseña es la predeterminada o ya fue cambiada
        let redirectTo = "Members.html"; // Si ya cambió la contraseña, va a members
        if (user.password.startsWith("$2b$")) {
            redirectTo = "change_password.html"; // Si aún tiene la contraseña generada, debe cambiarla
        }

        res.json({ message: "Inicio de sesión exitoso", token, redirectTo });

    } catch (error) {
        console.error("❌ Error en el login:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});


// ✅ **Ruta para que los usuarios configuren su contraseña**



app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // 🔹 Encriptamos la contraseña

        let result = await pool.query(
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

// 🔹 Prueba de envío de correo al iniciar el servidor
async function testEmail() {
    try {
        const randomPassword = crypto.randomBytes(8).toString("hex"); // Genera una contraseña aleatoria
await enviarCorreo("luisina.almaraz.3@gmail.com", randomPassword);

        console.log("✅ Prueba de correo enviada");
    } catch (error) {
        console.error("❌ Error en la prueba de correo:", error);
    }
}

testEmail(); // 🔹 Llamamos la función al iniciar el servidor



// 🔍 Diagnóstico: Ver todas las rutas registradas en Express
console.log("📌 Listado de rutas activas:");
app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
        console.log(`🛠 Ruta activa: ${r.route.path}`);
    }
});



// Iniciar el servidor en el puerto 8080 (Render usa este puerto)
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});

// Ruta para recuperar contraseña
app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    try {
        // Buscar al usuario en la base de datos
        const result = await pool.query("SELECT * FROM subscriptions WHERE subscriber_email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Este correo no está registrado." });
        }

        // Generar una nueva contraseña aleatoria
        const randomPassword = crypto.randomBytes(8).toString("hex");
        const hashedPassword = await bcrypt.hash(randomPassword, 10);  // Encriptar la nueva contraseña

        // Actualizar la base de datos con la nueva contraseña
        await pool.query("UPDATE subscriptions SET password = $1 WHERE subscriber_email = $2", [hashedPassword, email]);

        // Enviar la nueva contraseña por correo
        await enviarCorreo(email, randomPassword);

        res.json({ message: "Te hemos enviado un enlace para recuperar tu contraseña." });
    } catch (error) {
        console.error("❌ Error recuperando contraseña:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});


// Ruta para cambiar la contraseña
app.post("/change-password", async (req, res) => {
    const { newPassword, confirmPassword } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ message: "No tienes permiso para cambiar la contraseña." });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Las contraseñas no coinciden." });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const email = decoded.email;

        // Verificar si el usuario existe en la base de datos
        const userCheck = await pool.query("SELECT password FROM subscriptions WHERE subscriber_email = $1", [email]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        // Encriptar la nueva contraseña
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        console.log(`🛠 Nueva contraseña encriptada para ${email}:`, hashedNewPassword);

        // Actualizar la base de datos con la nueva contraseña
        const result = await pool.query(
            "UPDATE subscriptions SET password = $1 WHERE subscriber_email = $2 RETURNING *",
            [hashedNewPassword, email]
        );

        if (result.rowCount === 0) {
            return res.status(500).json({ message: "No se pudo actualizar la contraseña." });
        }

        console.log(`✅ Contraseña actualizada en la BD para: ${email}`);

        // ✅ Responder con un mensaje de éxito y redirigir al login
        res.json({ message: "Contraseña cambiada exitosamente. Inicia sesión con tu nueva contraseña.", redirectTo: "suscribe.html" });

    } catch (error) {
        console.error("❌ Error al cambiar la contraseña:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});

