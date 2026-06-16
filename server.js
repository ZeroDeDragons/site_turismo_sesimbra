import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/send-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    console.log('📧 Enviando email para:', email);

    // Configuração com SEU EMAIL
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // false para porta 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS  // ← SENHA DE APP
      },
      tls: {
        rejectUnauthorized: false // Pode remover em produção
      }
    });

    // Token de teste
    const token = Math.random().toString(36).substring(2, 15);
    const resetLink = `http://localhost:5173/reset?token=${token}`;

    // Enviar email REAL
    const info = await transporter.sendMail({
      from: `"Castelo Sesimbra" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: '🔐 Recuperação de senha - Castelo Sesimbra',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h1 style="color: #979d23;">🔐 Recuperação de senha</h1>
          <p style="color: #4b5563; font-size: 16px;">
            Olá! Recebemos uma solicitação para redefinir sua senha.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: #979d23; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              🔑 Redefinir senha
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            ⏰ Este link expira em 1 hora.<br>
            Se você não solicitou, ignore este email.
          </p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Castelo Sesimbra - Turismo, História e Natureza
          </p>
        </div>
      `
    });

    console.log('✅ Email enviado com sucesso!');

    res.json({
      success: true,
      message: 'Email enviado com sucesso!'
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({
      error: 'Erro ao enviar email',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📧 Email configurado: ${process.env.SMTP_USER}\n`);
});