// src/lib/email/sendEmail.js

import nodemailer from 'nodemailer';

// Настройте транспорт Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail', // Или 'smtp.sendgrid.net', 'smtp.yandex.ru' и т.д.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (toEmail, subject, text, html) => {
  try {
    const mailOptions = {
      from: `Ваш Бот <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      text: text, // Текстовая версия письма
      html: html, // HTML версия письма
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Письмо успешно отправлено:', info.response);
    return true;
  } catch (error) {
    console.error('Ошибка отправки письма:', error);
    return false;
  }
};