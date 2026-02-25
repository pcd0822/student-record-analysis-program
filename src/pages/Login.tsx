import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGooglePopup, signInWithGoogleRedirect, handleRedirectResult, isUserAllowed } from '@/firebase/auth';
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

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      const user = await signInWithGooglePopup();
      if (!user) {
        setLoading(false);
        return;
      }
      const allowed = await isUserAllowed(user);
      if (allowed) {
        navigate('/', { replace: true });
      } else {
        setError('이 계정은 사용 승인이 되지 않았습니다. 관리자에게 이메일로 사용 권한을 요청하세요.');
        setLoading(false);
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError('팝업이 차단되었습니다. 브라우저에서 팝업을 허용하거나 아래 "리다이렉트로 로그인"을 사용하세요.');
        setLoading(false);
        return;
      }
      setError(err?.message ?? '로그인에 실패했습니다.');
      setLoading(false);
    }
  }

  function handleGoogleLoginRedirect() {
    setError(null);
    setLoading(true);
    signInWithGoogleRedirect();
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
        <button
          type="button"
          className={styles.redirectBtn}
          onClick={handleGoogleLoginRedirect}
          disabled={loading}
        >
          팝업이 안 되면 리다이렉트로 로그인
        </button>
      </div>
    </div>
  );
}
