// src/components/common/Notification.jsx
import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function Notification({ type, message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />
  };

  const styles = {
    success: 'bg-green-50 text-green-800',
    error: 'bg-red-50 text-red-800',
    warning: 'bg-yellow-50 text-yellow-800'
  };

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${styles[type]}`}>
      <div className="flex items-center space-x-2">
        {icons[type]}
        <span>{message}</span>
      </div>
    </div>
  );
}