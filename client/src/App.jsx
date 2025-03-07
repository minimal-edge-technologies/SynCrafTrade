// src/App.jsx
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/dashboard/Dashboard';
import AccountsPage from './components/accounts/AccountsPage';  
import AccountDetails from './components/accounts/AccountDetails';
import AddAccountForm from './components/accounts/AddAccountForm';
import Navigation from './components/common/Navigation';
import ReauthenticationModal from './components/auth/ReauthenticationModal';
import useAccountsStore from './store/accountsStore';
import { wsService } from './services/websocket';

function App() {
  // Add accounts to the destructured variables from the store
  const { initialize, accounts, currentAccount } = useAccountsStore();
  const [accountNeedingAuth, setAccountNeedingAuth] = useState(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Now accounts is properly defined
  useEffect(() => {
    const checkAuthStatus = () => {
      // Don't show modal if one is already open
      if (accountNeedingAuth) return;
     
      // First check current account
      if (currentAccount?.authStatus === 'REQUIRES_AUTH') {
        setAccountNeedingAuth(currentAccount);
        return;
      }
     
      // Then check other accounts
      const needsAuth = accounts.find(acc => acc.authStatus === 'REQUIRES_AUTH');
      if (needsAuth) {
        setAccountNeedingAuth(needsAuth);
      }
    };
   
    // Check initially and every minute
    checkAuthStatus();
    const interval = setInterval(checkAuthStatus, 60000);
   
    return () => clearInterval(interval);
  }, [accounts, currentAccount, accountNeedingAuth]);

  // Add WebSocket connection management
  useEffect(() => {
    // Connect when account changes
    if (currentAccount?._id) {
      console.log('Establishing WebSocket connection for account:', currentAccount.clientCode);
      wsService.connect();
    }
    
    // Set up visibility change detection
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentAccount?._id) {
        console.log('Page became visible, checking WebSocket connection');
        // If socket is closed or closing, reconnect
        if (!wsService.socket || 
            wsService.socket.readyState === WebSocket.CLOSED || 
            wsService.socket.readyState === WebSocket.CLOSING) {
          wsService.connect();
        }
      }
    };
    
    // Handle online/offline events
    const handleOnline = () => {
      console.log('Browser came online, reconnecting WebSocket');
      if (currentAccount?._id) {
        wsService.connect();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      wsService.disconnect();
    };
  }, [currentAccount?._id]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/account-details/:id" element={<AccountDetails />} /> 
            <Route path="/add-account" element={<AddAccountForm />} />
          </Routes>
        </main>
        {/* Re-authentication Modal */}
        {accountNeedingAuth && (
          <ReauthenticationModal
            isOpen={true}
            onClose={() => setAccountNeedingAuth(null)}
            account={accountNeedingAuth}
          />
        )}
      </div>
    </Router>
  );
}

export default App;