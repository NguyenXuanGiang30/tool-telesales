import { useState } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Contacts from './pages/Contacts';
import CallLogs from './pages/CallLogs';
import SystemSettings from './pages/SystemSettings';
import TelesaleWorkspace from './pages/TelesaleWorkspace';
import MessagingWorkspace from './pages/MessagingWorkspace';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');

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

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {renderPage()}
    </Layout>
  );
}
