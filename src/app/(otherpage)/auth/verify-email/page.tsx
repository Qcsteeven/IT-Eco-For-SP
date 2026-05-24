'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import styles from './VerifyEmail.module.scss';

function ManualApprovalContent() {
  const searchParams = useSearchParams();
  const email = searchParams?.get('email') || '';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardLogo} aria-hidden="true">
          <Image
            src="/brand/cpcore-logo.png"
            alt=""
            width={979}
            height={546}
            priority
          />
        </div>

        <div className={styles.head}>
          <h2 className={styles.title}>Аккаунт ожидает подтверждения</h2>
          <p className={styles.description}>
            {email ? (
              <>
                Заявка для{' '}
                <a className={styles.emailLink} href={`mailto:${email}`}>
                  {email}
                </a>{' '}
                создана. Вход станет доступен после подтверждения
                администратором.
              </>
            ) : (
              'Подтверждение по email временно отключено. Вход станет доступен после подтверждения аккаунта администратором.'
            )}
          </p>
        </div>

        <div className={styles.linksRow}>
          <Link href="/auth/signin" className={styles.linkBtn}>
            Войти
          </Link>
          <Link href="/auth/signup" className={styles.linkBtn}>
            Регистрация
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className={styles.page}>Загрузка...</div>}>
      <ManualApprovalContent />
    </Suspense>
  );
}
