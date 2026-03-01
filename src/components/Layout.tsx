import { Outlet, NavLink } from 'react-router-dom';
import { signOut } from '@/firebase/auth';
import styles from './Layout.module.css';

export default function Layout() {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>생기부 분석 프로그램</h1>
        <nav className={styles.nav}>
          <NavLink
            to="/rag"
            className={({ isActive }) => [styles.navLink, isActive ? styles.navActive : ''].filter(Boolean).join(' ')}
          >
            RAG
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) => [styles.navLink, isActive ? styles.navActive : ''].filter(Boolean).join(' ')}
          >
            생기부 업로드
          </NavLink>
          <NavLink
            to="/view"
            className={({ isActive }) => [styles.navLink, isActive ? styles.navActive : ''].filter(Boolean).join(' ')}
          >
            조회
          </NavLink>
        </nav>
        <button type="button" className={styles.logout} onClick={() => signOut()}>
          로그아웃
        </button>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
