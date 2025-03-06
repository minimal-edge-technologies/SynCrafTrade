// src/components/orders/OrdersTable.jsx
import { useEffect, useRef } from 'react';
import useOrderStore from '../../store/orderStore';
import useAccountsStore from '../../store/accountsStore';
import { Loader2 } from 'lucide-react';

export default function OrdersTable() {
  const { orders, isLoading, error, fetchOrders: fetchOrdersFromStore } = useOrderStore();
  const { currentAccount } = useAccountsStore();

  // Use a ref to track if we've already fetched for this account
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Reset fetch state when account changes
    fetchedRef.current = false;
    
    if (!currentAccount?.tokens?.jwtToken) return;
  
    const loadOrders = async () => {
      if (fetchedRef.current) return; // Skip if already fetched for this account
      
      try {
        console.log('Loading orders for:', currentAccount.clientCode, 'with ID:', currentAccount._id);
        fetchedRef.current = true; // Set this BEFORE the async call
        await fetchOrdersFromStore();
      } catch (err) {
        console.error('Error loading orders:', err);
        fetchedRef.current = false; // Reset on error so we can try again
      }
    };
    
    loadOrders();
  
    // No cleanup function that resets fetchedRef
  }, [currentAccount?._id, fetchOrdersFromStore]);


  if (!currentAccount) {
    return (
      <div className="text-center p-4">
        Please select an account to view orders
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        {error}
      </div>
    );
  }
  
  const ordersList = Array.isArray(orders?.data) ? orders.data : 
                    Array.isArray(orders) ? orders : [];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Orders</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ordersList.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No orders found
                </td>
              </tr>
            ) : (
              ordersList.map((order) => (
                <tr key={order.orderId || `${order.symbol}-${order.timestamp}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.timestamp ? new Date(order.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.symbol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.transactionType === 'BUY' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {order.transactionType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {order.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    ₹{order.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === 'COMPLETE' ? 'bg-green-100 text-green-800' :
                      order.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      order.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}