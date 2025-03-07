// src/components/auth/ReauthenticationModal.jsx

import { useState } from 'react';
import useAccountsStore from '../../store/accountsStore';
import { Loader2, X } from 'lucide-react';

export default function ReauthenticationModal({ isOpen, onClose, account }) {
  const [credentials, setCredentials] = useState({
    password: '',
    totp: ''
  });

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { reauthenticateAccount } = useAccountsStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setError(null);
      setIsLoading(true);
      
      await reauthenticateAccount(
        account._id,
        credentials.password,
        credentials.totp
      );
      
      onClose();
    } catch (error) {
      console.error('Re-authentication failed:', error);
      setError(error.response?.data?.error || error.message || 'Re-authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Re-authenticate Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700">
              Your authentication for <span className="font-medium">{account.clientCode}</span> has expired. 
              Please re-enter your password and TOTP to continue.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                TOTP (Time-based One-Time Password)
              </label>
              <input
                type="text"
                value={credentials.totp}
                onChange={(e) => setCredentials(prev => ({ ...prev, totp: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 flex items-center"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Re-authenticate
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}