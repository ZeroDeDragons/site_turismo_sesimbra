// netlify/functions/send-reset-email.js
import nodemailer from 'nodemailer';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email é obrigatório' }) };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const token = Math.random().toString(36).substring(2, 15);
    const resetLink = `${process.env.APP_URL || 'https://seu-site.netlify.app'}/reset?token=${token}`;

    await transporter.sendMail({
      from: `"Castelo Sesimbra" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: '🔐 Recuperação de senha - Castelo Sesimbra',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h1 style="color: #979d23;">🔐 Recuperação de senha</h1>
          <p style="color: #4b5563;">Clique no botão abaixo para redefinir sua senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: #979d23; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
              🔑 Redefinir senha
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">⏰ Este link expira em 1 hora.</p>
        </div>
      `
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Email enviado com sucesso!' })
    };

  } catch (error) {
    console.error('Erro:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao enviar email' })
    };
  }
};