// src/lib/email/sendEmail.js

const UNISENDER_GO_API_URL =
  'https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json';

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

function getSenderEmail() {
  return process.env.UNISENDER_GO_SENDER_EMAIL;
}

function getSenderName() {
  return process.env.UNISENDER_GO_SENDER_NAME || 'IT-Eco-For-SP';
}

function validateEmailConfig() {
  if (!process.env.UNISENDER_GO_API_KEY) {
    console.warn(
      '[Email] UNISENDER_GO_API_KEY не настроен. Отправка через Unisender Go невозможна.',
    );
    return false;
  }

  if (!isSafeEmailAddress(getSenderEmail())) {
    console.error(
      '[Email] UNISENDER_GO_SENDER_EMAIL должен быть валидным email без переносов строк.',
    );
    return false;
  }

  return true;
}

async function sendViaUnisenderGo(toEmail, subject, text, html) {
  const body = {};

  if (typeof text === 'string' && text.trim()) {
    body.plaintext = text;
  }

  if (typeof html === 'string' && html.trim()) {
    body.html = html;
  }

  if (!body.plaintext && !body.html) {
    body.plaintext = subject;
  }

  const payload = {
    message: {
      recipients: [{ email: toEmail }],
      body,
      subject,
      from_email: getSenderEmail(),
      from_name: getSenderName(),
      global_language: 'ru',
      template_engine: 'none',
    },
  };

  const response = await fetch(UNISENDER_GO_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'X-API-KEY': process.env.UNISENDER_GO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Unisender Go API вернул ${response.status}: ${responseText.slice(0, 500)}`,
    );
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { message: responseText };
  }

  if (result?.failed_emails?.[toEmail]) {
    throw new Error(
      `Unisender Go не принял адрес ${toEmail}: ${result.failed_emails[toEmail]}`,
    );
  }

  return result;
}

export const sendEmail = async (toEmail, subject, text, html) => {
  if (
    !isSafeEmailAddress(toEmail) ||
    hasHeaderInjection(subject) ||
    hasHeaderInjection(getSenderName())
  ) {
    console.warn(
      '[Email] Отклонена попытка отправки письма с некорректными заголовками.',
    );
    return false;
  }

  if (!validateEmailConfig()) {
    return false;
  }

  try {
    const info = await sendViaUnisenderGo(toEmail, subject, text, html);

    console.log(
      `[Email] Письмо отправлено на ${toEmail} через Unisender Go:`,
      info.job_id || info,
    );
    return true;
  } catch (error) {
    console.error(
      `[Email] Ошибка отправки письма на ${toEmail} через Unisender Go:`,
      error.message,
    );
    return false;
  }
};
