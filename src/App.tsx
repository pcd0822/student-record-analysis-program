import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initFirebase } from '@/firebase/config';
import { subscribeAuth, isUserAllowed, handleRedirectResult } from '@/firebase/auth';
import type { User } from 'firebase/auth';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Upload from '@/pages/Upload';
import View from '@/pages/View';
import Dashboard from '@/pages/Dashboard';
import Rag from '@/pages/Rag';

initFirebase();

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const applyUser = async (u: User | null) => {
      if (cancelled) return;
      setUser(u);
      if (!u) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      const ok = await isUserAllowed(u);
      if (cancelled) return;
      setAllowed(ok);
      setLoading(false);
    };

    const run = async () => {
      // 리다이렉트 후 돌아온 경우 결과를 먼저 처리 (onAuthStateChanged가 null로 먼저 올 수 있음)
      const redirectUser = await handleRedirectResult();
      if (cancelled) return;
      if (redirectUser) {
        // 리다이렉트로 받은 유저는 즉시 사용 (콜백 순서에 의존하지 않음)
        await applyUser(redirectUser);
        if (cancelled) return;
        unsub = subscribeAuth((u) => {
          if (cancelled) return;
          setUser(u);
          if (u) isUserAllowed(u).then((ok) => { if (!cancelled) setAllowed(ok); });
          else setAllowed(false);
        });
        return;
      }
      unsub = subscribeAuth(applyUser);
    };
    run().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        로그인 확인 중…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!allowed) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p>이 계정은 사용 승인이 되지 않았습니다.</p>
        <p>관리자에게 사용 권한 요청을 해 주세요.</p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="rag" element={<Rag />} />
          <Route path="upload" element={<Upload />} />
          <Route path="view" element={<View />} />
          <Route path="dashboard/:studentId" element={<Dashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
