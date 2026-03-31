import React from 'react';

// Определяем базовые стили для центрирования и улучшения внешнего вида
const styles: { [key: string]: React.CSSProperties } = {
  main: {
    display: 'flex',
    justifyContent: 'center', // Центрирование по горизонтали
    alignItems: 'center', // Центрирование по вертикали
    minHeight: '100vh', // Занимаем всю высоту вьюпорта
    textAlign: 'center',
    fontSize: '24px', // Увеличиваем размер текста для заметности
    color: '#333', // Немного более мягкий цвет текста
    backgroundColor: '#f4f4f4', // Светлый фон
    padding: '20px',
  },
  message: {
    padding: '40px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
};

const BasePage: React.FC = () => {
  return (
    <main style={styles.main}>
      <div style={styles.message}>
        <h1>Пока ничего не знаем</h1>
        <p>
          Информация находится в процессе подготовки. Пожалуйста, зайдите позже.
        </p>
      </div>
    </main>
  );
};

export default BasePage;
