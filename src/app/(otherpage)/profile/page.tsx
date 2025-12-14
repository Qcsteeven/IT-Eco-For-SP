// src/app/(otherpage)/profile/page.tsx
import './profile.scss';

import React from 'react';

const ProfilePage: React.FC = () => {
  return (
    <main>
      <section id="profile" style={{ display: 'block' }}>
        <div className="profile-header">
          <h2>Иванов Иван</h2>
          <div className="rating">1428</div>
          <div className="rating-label">Рейтинг в системе БЦСП</div>
        </div>

        <h1>Вход в внешние системы</h1>
        <div className="systems-links">
          <a
            href="https://codeforces.com/enter"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в Codeforces
          </a>
          <a
            href="https://contest.yandex.ru/enter"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в Yandex.Contest
          </a>
          <a
            href="https://atcoder.jp/login"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в AtCoder
          </a>
          <a
            href="https://leetcode.com/accounts/login/"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в LeetCode
          </a>
          <a
            href="https://icpc.global/login"
            target="_blank"
            rel="noopener noreferrer"
            className="system-link"
          >
            Вход в ICPC
          </a>
        </div>

        <h1>История участия и изменения кармы</h1>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Соревнование</th>
              <th>Платформа</th>
              <th>Результат</th>
              <th>Изменение рейтинга</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>15.11.2025</td>
              <td>ICPC Siberian Regional</td>
              <td>ICPC</td>
              <td>
                7 место <span className="manual-tag">вручную</span>
              </td>
              <td className="rating-change">-32</td>
            </tr>
            <tr>
              <td>10.11.2025</td>
              <td>Байкал Код Осень 2025</td>
              <td>Байкал Код</td>
              <td>1 место</td>
              <td className="rating-change">+215</td>
            </tr>
            <tr>
              <td>01.11.2025</td>
              <td>Codeforces Round 915</td>
              <td>Codeforces</td>
              <td>1247 → 1428</td>
              <td className="rating-change">+181</td>
            </tr>
            <tr>
              <td>07.12.2025</td>
              <td>Weekly Contest 479</td>
              <td>LeetCode</td>
              <td>Участие</td>
              <td className="rating-change negative">-15</td>
            </tr>
          </tbody>
        </table>

        <h1>Изменение личных данных</h1>
        <form className="edit-form">
          <label htmlFor="name">ФИО</label>
          <input
            type="text"
            id="name"
            defaultValue="Иванов Иван"
            placeholder="Введите ФИО"
          />

          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            defaultValue="ivan@example.com"
            placeholder="Введите email"
          />

          <label htmlFor="password">Новый пароль</label>
          <input
            type="password"
            id="password"
            placeholder="Введите новый пароль"
          />

          <label htmlFor="phone">Телефон</label>
          <input
            type="tel"
            id="phone"
            defaultValue="+7 (999) 123-45-67"
            placeholder="Введите телефон"
          />

          <button type="submit" className="btn-save">
            Сохранить изменения
          </button>
        </form>
      </section>
    </main>
  );
};

export default ProfilePage;
