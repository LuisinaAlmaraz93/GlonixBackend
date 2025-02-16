const nodemailer = require("nodemailer");

// Configurar transporte de correo
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "luisina.almaraz.3@gmail.com",
        pass: "aogzqohrgkogfzjl"
    }
});

// Opciones del correo
const mailOptions = {
    from: "luisina.almaraz.3@gmail.com",
    to: "luisina.almaraz.3@gmail.com", // Te lo envías a ti misma
    subject: "Prueba de correo Nodemailer",
    text: "Este es un correo de prueba enviado desde Node.js con Nodemailer."
};

// Enviar el correo
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("❌ Error enviando el correo:", error);
    } else {
        console.log("📧 Correo enviado con éxito:", info.response);
    }
});

