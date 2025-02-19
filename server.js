const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // Conexión a la base de datos
const jwt = require("jsonwebtoken"); // Importamos jsonwebtoken para los tokens
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// 🔹 Configurar CORS correctamente
const corsOptions = {
    origin: "*", // Prueba con esto primero, pero después restringe a dominios específicos
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Middleware para asegurar que las respuestas incluyan CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// 📌 **CONFIGURAR ARCHIVOS ESTÁTICOS**
app.use(express.static(path.join(__dirname, "Glonix")));

// 📌 **SERVIR LA PÁGINA PRINCIPAL (Suscribe.html)**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "Glonix", "Suscribe.html"));
});

// 📌 **Ruta de prueba para verificar que el servidor funciona**
app.get("/test", (req, res) => {
    res.send("✅ El servidor está funcionando correctamente.");
});

// 🔹 **Ver todas las rutas activas**
console.log("📌 Listado de rutas activas:");
app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
        console.log(`🛠 Ruta activa: ${r.route.path}`);
    }
});

// 🔹 **RUTA LOGIN**
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    console.log(`🔍 Intentando iniciar sesión con: ${email}`);

    try {
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
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            console.log(`❌ Contraseña incorrecta para el usuario ${email}`);
            return res.status(401).json({ message: "Contraseña incorrecta." });
        }

        const token = jwt.sign({ email: user.subscriber_email }, "mi_secreto_super_seguro", { expiresIn: "1h" });

        console.log(`✅ Inicio de sesión exitoso para: ${email}`);

        let redirectTo = "Members.html"; 
        if (!user.password.startsWith("$2b$")) {
            redirectTo = "change_password.html"; 
        }

        res.json({ message: "Inicio de sesión exitoso", token, redirectTo });

    } catch (error) {
        console.error("❌ Error en el login:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});

// 🔹 **RUTA PARA CAMBIAR CONTRASEÑA**
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
        const decoded = jwt.verify(token, "mi_secreto_super_seguro");
        const email = decoded.email;

        const userCheck = await pool.query("SELECT password FROM subscriptions WHERE subscriber_email = $1", [email]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        console.log(`🛠 Nueva contraseña encriptada para ${email}:`, hashedNewPassword);

        const result = await pool.query(
            "UPDATE subscriptions SET password = $1 WHERE subscriber_email = $2 RETURNING *",
            [hashedNewPassword, email]
        );

        if (result.rowCount === 0) {
            return res.status(500).json({ message: "No se pudo actualizar la contraseña." });
        }

        console.log(`✅ Contraseña actualizada en la BD para: ${email}`);
        res.json({ message: "Contraseña cambiada exitosamente. Inicia sesión con tu nueva contraseña.", redirectTo: "Suscribe.html" });

    } catch (error) {
        console.error("❌ Error al cambiar la contraseña:", error);
        res.status(500).json({ message: "Error en el servidor." });
    }
});

// 🔹 **RUTA PROTEGIDA PARA MEMBERS.HTML**
const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ message: "Acceso denegado: No tienes token." });
    }

    try {
        const decoded = jwt.verify(token, "mi_secreto_super_seguro");
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido o expirado." });
    }
};

app.get("/members", verificarToken, (req, res) => {
    res.sendFile(path.join(__dirname, "Glonix", "Members.html"));
});

// 🔹 **INICIAR SERVIDOR**
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});
