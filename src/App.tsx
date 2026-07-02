import { useState, useEffect } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Contacts from './pages/Contacts';
import CallLogs from './pages/CallLogs';
import SystemSettings from './pages/SystemSettings';
import TelesaleWorkspace from './pages/TelesaleWorkspace';
import MessagingWorkspace from './pages/MessagingWorkspace';
import { auth, onAuthStateChanged, loginWithEmail, registerWithEmail } from './lib/firebase';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthLoading(false);
      } else {
        // Try anonymous login first
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        } catch (err: any) {
          console.warn("Anonymous login not allowed or failed, trying developer login:", err);
          const devEmail = "dev@telesale.com";
          const devPassword = "password123";
          
          try {
            await loginWithEmail(devEmail, devPassword);
          } catch (loginErr: any) {
            const errStr = String(loginErr.message || loginErr);
            if (errStr.includes("auth/user-not-found") || errStr.includes("user-not-found") || errStr.includes("USER_NOT_FOUND")) {
              try {
                await registerWithEmail(devEmail, devPassword);
              } catch (regErr) {
                console.error("Failed to register developer login:", regErr);
                setAuthLoading(false);
              }
            } else {
              console.error("Failed to login developer login:", loginErr);
              setAuthLoading(false);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'campaigns-callbot':
        return <Campaigns />;
      case 'campaigns-telesale':
        return <TelesaleWorkspace />;
      case 'campaigns-messages':
        return <MessagingWorkspace />;
      case 'contacts':
        return <Contacts />;
      case 'logs':
        return <CallLogs />;
      case 'system':
        return <SystemSettings />;
      default:
        return <Dashboard />;
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-50 font-sans">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600 mb-4" />
        <p className="text-zinc-600 font-medium">Đang khởi tạo hệ thống bảo mật & kết nối Firebase...</p>
      </div>
    );
  }

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderPage()}
    </Layout>
  );
}

