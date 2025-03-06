// src/components/common/AccountActionMenu.jsx
import { useState } from 'react';
import { MoreVertical, Unlink, Power } from 'lucide-react';
import useAccountsStore from '../../store/accountsStore';

export default function AccountActionMenu({ account }) {
  const [isOpen, setIsOpen] = useState(false);
  const { updateAccount } = useAccountsStore();

  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect this account?')) {
      try {
        await updateAccount(account._id, {
          parentAccount: null,
          copyTradingEnabled: false
        });
      } catch (error) {
        console.error('Failed to disconnect account:', error);
      }
    }
  };

  const toggleCopyTrading = async () => {
    try {
      await updateAccount(account._id, {
        copyTradingEnabled: !account.copyTradingEnabled
      });
    } catch (error) {
      console.error('Failed to toggle copy trading:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-full hover:bg-gray-100"
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <button
              onClick={toggleCopyTrading}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Power className="w-4 h-4 mr-2" />
              {account.copyTradingEnabled ? 'Pause Copy Trading' : 'Resume Copy Trading'}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Disconnect Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}