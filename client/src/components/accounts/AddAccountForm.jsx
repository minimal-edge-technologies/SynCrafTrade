// src/components/accounts/AddAccountForm.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAccountsStore from '../../store/accountsStore';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '../../constants/accountTypes';

export default function AddAccountForm() {
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES.CHILD);
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    clientCode: '',
    password: '',
    totp: '',
    apiKey: ''
  });

  const [localError, setLocalError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { addAccount, error: storeError } = useAccountsStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLocalError(null);
      setIsLoading(true);
        
      const newAccount = await addAccount({
        ...credentials,
        accountType 
      });
  
      if (newAccount?._id) {
        navigate(`/account-details/${newAccount._id}`);
      } else {
        navigate('/accounts');
      }
    } catch (error) {
      console.error('Failed to add account:', error);
      setLocalError(error.message || 'Failed to add account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show either local error or store error
  const displayError = localError || storeError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Add Angel One Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connect your Angel One trading account to enable copy trading
          </p>
        </div>
        
        {displayError && (
          <div className="bg-red-50 text-red-500 p-4 rounded-md text-sm">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Account Type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={ACCOUNT_TYPES.PARENT}>{ACCOUNT_TYPE_LABELS[ACCOUNT_TYPES.PARENT]}</option>
                <option value={ACCOUNT_TYPES.CHILD}>{ACCOUNT_TYPE_LABELS[ACCOUNT_TYPES.CHILD]}</option>
              </select>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Client Code
            </label>
            <input
              type="text"
              value={credentials.clientCode}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                clientCode: e.target.value
              }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                password: e.target.value
              }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              TOTP
            </label>
            <input
              type="text"
              value={credentials.totp}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                totp: e.target.value
              }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              type="text"
              value={credentials.apiKey}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                apiKey: e.target.value
              }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                Adding Account...
              </>
            ) : (
              'Add Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}