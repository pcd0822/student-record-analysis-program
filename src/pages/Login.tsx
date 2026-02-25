import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, handleRedirectResult, isUserAllowed } from '@/firebase/auth';
import styles from './Login.module.css';

export default function Login() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    handleRedirectResult()
      .then((user) => {
        if (user) {
          return isUserAllowed(user).then((allowed) => {
            if (allowed) navigate('/', { replace: true });
            else {
              setError('이 계정은 사용 승인이 되지 않았습니다. 관리자에게 이메일로 사용 권한을 요청하세요.');
              setLoading(false);
            }
          });
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '로그인에 실패했습니다.');
        setLoading(false);
      });
  }, [navigate]);

  function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    signInWithGoogle();
    // 페이지가 구글 로그인으로 리다이렉트되므로 여기서 더 진행하지 않음
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>생기부 분석 프로그램</h1>
        <p className={styles.sub}>
          구글 로그인 후 사용 가능합니다. 허용된 이메일만 사용할 수 있습니다.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? '처리 중…' : 'Google로 로그인'}
        </button>
      </div>
    </div>
  );
}
