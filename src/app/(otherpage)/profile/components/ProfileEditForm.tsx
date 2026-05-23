import type { FormEvent } from 'react';

import type { UserData } from '../types';

interface ProfileEditFormProps {
  userData: UserData;
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function ProfileEditForm({
  userData,
  saving,
  onSubmit,
}: ProfileEditFormProps) {
  return (
    <>
      <h1>Изменение личных данных</h1>
      <form className="edit-form" onSubmit={onSubmit}>
        <label htmlFor="name">ФИО</label>
        <input
          type="text"
          id="name"
          name="full_name"
          defaultValue={userData.full_name || ''}
          disabled={saving}
        />

        <label htmlFor="phone">Телефон</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          defaultValue={userData.phone || ''}
          disabled={saving}
        />

        <div className="form-section-title">
          <h3>Смена пароля</h3>
          <p>Заполните только для изменения пароля</p>
        </div>

        <label htmlFor="oldPassword">Старый пароль</label>
        <input
          type="password"
          id="oldPassword"
          name="oldPassword"
          placeholder="Текущий пароль"
          disabled={saving}
        />

        <label htmlFor="newPassword">Новый пароль</label>
        <input
          type="password"
          id="newPassword"
          name="newPassword"
          placeholder="Новый пароль"
          disabled={saving}
        />

        <div className="btn-save-container">
          <button type="submit" className="btn-save" disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </>
  );
}
