import { useState } from 'react';
import { signInWithGoogle } from '@/firebase/auth';
import styles from './Login.module.css';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>생기부 분석 프로그램</h1>
        <p className={styles.sub}>구글 로그인 후 사용 가능합니다. (승인된 계정만)</p>
        {error && <p className={styles.error}>{error}</p>}
        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? '로그인 중…' : 'Google로 로그인'}
        </button>
      </div>
    </div>
  );
}
