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
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail', // Или 'smtp.sendgrid.net', 'smtp.yandex.ru' и т.д.
    host: process.env.EMAIL_SMTP_HOST, // Опционально для кастомных SMTP
    port: process.env.EMAIL_SMTP_PORT
      ? parseInt(process.env.EMAIL_SMTP_PORT)
      : undefined,
    secure: process.env.EMAIL_SMTP_SECURE === 'true', // true для 465, false для других портов
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
