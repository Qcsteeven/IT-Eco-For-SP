// src/lib/email/sendEmail.js

import nodemailer from 'secure-nodemailer';

let transporter;
let verificationStarted = false;

function hasHeaderInjection(value) {
  return typeof value !== 'string' || /[\r\n]/.test(value);
}

function isSafeEmailAddress(value) {
  return (
    typeof value === 'string' &&
    !hasHeaderInjection(value) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

// Проверка переменных окружения
function validateEmailConfig() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(
      '⚠️ EMAIL_USER и EMAIL_PASS не настроены. Отправка писем невозможна.',
    );
    return false;
  }

  if (!isSafeEmailAddress(process.env.EMAIL_USER)) {
    console.error(
      '[Email] EMAIL_USER должен быть валидным email без переносов строк.',
    );
    return false;
  }

  return true;
}

function getTransporter() {
  if (transporter) return transporter;

  // Настройте транспорт Nodemailer
  // Явно указываем host/port вместо service-ярлыка, чтобы можно было
  // задать family:4 — Render (и многие облачные провайдеры) не маршрутизируют
  // исходящий IPv6, а Node.js по умолчанию предпочитает его при резолве.
  const useCustomSmtp = Boolean(process.env.EMAIL_SMTP_HOST);
  transporter = nodemailer.createTransport({
    ...(useCustomSmtp
      ? {
          host: process.env.EMAIL_SMTP_HOST,
          port: process.env.EMAIL_SMTP_PORT
            ? parseInt(process.env.EMAIL_SMTP_PORT)
            : 587,
          secure: process.env.EMAIL_SMTP_SECURE === 'true',
        }
      : {
          // Gmail — явный host вместо service:'gmail', чтобы сработал family:4
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
        }),
    // Принудительно IPv4: предотвращает ENETUNREACH на хостах без IPv6-маршрутизации
    family: 4,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  if (!verificationStarted) {
    verificationStarted = true;
    transporter.verify((error) => {
      if (error) {
        console.error('[Email] Ошибка подключения к SMTP:', error.message);
      } else {
        console.log('[Email] SMTP сервер готов к отправке писем');
      }
    });
  }

  return transporter;
}

export const sendEmail = async (toEmail, subject, text, html) => {
  if (!validateEmailConfig()) {
    return false;
  }

  if (!isSafeEmailAddress(toEmail) || hasHeaderInjection(subject)) {
    console.warn(
      '[Email] Отклонена попытка отправки письма с некорректными заголовками.',
    );
    return false;
  }

  try {
    const mailOptions = {
      from: `"IT-Eco-For-SP" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      text: text, // Текстовая версия письма
      html: html, // HTML версия письма
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[Email] Письмо отправлено на ${toEmail}:`, info.messageId);
    return true;
  } catch (error) {
    console.error(
      `[Email] Ошибка отправки письма на ${toEmail}:`,
      error.message,
    );
    return false;
  }
};
