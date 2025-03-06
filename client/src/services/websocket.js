// src/services/websocket.js
import useAccountsStore from '../store/accountsStore';
import useOrderStore from '../store/orderStore';
import usePositionStore from '../store/positionStore';
import { toast } from 'react-hot-toast'; // For notifications

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = 1000;
    this.wsUrl = import.meta.env.VITE_WS_URL || 
    `ws://${window.location.hostname}:${window.location.port}`;
    this.isConnecting = false;
    this.pendingOrders = new Map(); // Track pending copy trades
    
    // Add heartbeat tracking
    this.lastPingTime = null;
    this.heartbeatMissed = 0;
    this.maxMissedHeartbeats = 3;
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const currentAccount = useAccountsStore.getState().currentAccount;
    if (!currentAccount) {
      console.log('No current account, skipping WebSocket connection');
      return;
    }

    this.isConnecting = true;
    console.log('Attempting WebSocket connection...');

    try {
      this.socket = new WebSocket(this.wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.heartbeatMissed = 0;
        this.lastPingTime = Date.now();
        this.authenticate();

         // Set up heartbeat checker
         this.setupHeartbeatChecker();

      };

      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleDisconnect.bind(this);
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleDisconnect();
    }
  }

  authenticate() {
    const currentAccount = useAccountsStore.getState().currentAccount;
    if (!currentAccount) {
      console.error('No current account available for authentication');
      return;
    }

    try {
      console.log('Sending WebSocket auth for account:', currentAccount.clientCode);
      this.socket.send(JSON.stringify({
        type: 'auth',
        tokens: {
          jwtToken: currentAccount.tokens.jwtToken,
          clientCode: currentAccount.clientCode,
          apiKey: currentAccount.credentials?.apiKey,
          password: currentAccount.credentials?.password,
          totp: currentAccount.credentials?.totp
        }
      }));
    } catch (error) {
      console.error('Failed to send authentication message:', error);
      this.handleDisconnect();
    }
  }

  // Add heartbeat checking
  setupHeartbeatChecker() {
    // Clear any existing checker
    if (this.heartbeatChecker) {
      clearInterval(this.heartbeatChecker);
    }
    
    // Check every 10 seconds if we've received a ping recently
    this.heartbeatChecker = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        clearInterval(this.heartbeatChecker);
        return;
      }
      
      const now = Date.now();
      
      // If no ping in 30 seconds, count as missed heartbeat
      if (this.lastPingTime && (now - this.lastPingTime > 30000)) {
        this.heartbeatMissed++;
        console.log(`[WS CLIENT] Missed heartbeat: ${this.heartbeatMissed}/${this.maxMissedHeartbeats}`);
        
        // If too many missed, reconnect
        if (this.heartbeatMissed >= this.maxMissedHeartbeats) {
          console.log('[WS CLIENT] Too many missed heartbeats, reconnecting...');
          this.socket.close();
          this.connect();
        }
      }
    }, 10000);
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);

      // Handle ping messages specially
      if (data.type === 'ping') {
        this.lastPingTime = Date.now();
        this.heartbeatMissed = 0;
        
        // Respond with pong
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({
            type: 'pong', 
            timestamp: Date.now(),
            clientTimestamp: data.timestamp
          }));
        }
        return;
      }

      
      switch (data.type) {
        case 'auth':
          this.handleAuthResponse(data);
          break;
        
          case 'data':
            this.handleDataUpdate(data.data);
            break;
    
          case 'copy_trade_success':
            console.log('[WS CLIENT] Copy trade success:', data.data);
            this.handleCopyTradeSuccess(data.data);
            break;
    
          case 'copy_trade_error':
            console.log('[WS CLIENT] Copy trade error:', data.data);
            this.handleCopyTradeError(data.data);
            break;

            case 'order_update':
              console.log('[WS CLIENT] Order update:', data.data);
              this.handleOrderUpdate(data.data);
              break;
      
            case 'error':
              console.error('[WS CLIENT] Error:', data.error);
              this.handleError(data);
              break;
              
            default:
              console.log('[WS CLIENT] Unknown message type:', data);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  handleAuthResponse(data) {
    if (data.status === 'success') {
      console.log('WebSocket authentication successful');
      toast.success('Connected to trading feed');
    } else {
      console.error('WebSocket authentication failed:', data.message);
      toast.error('Failed to connect to trading feed');
    }
  }

  handleDataUpdate(data) {
    const orderStore = useOrderStore.getState();
    const positionStore = usePositionStore.getState();
    const accountsStore = useAccountsStore.getState();
    
    if (Array.isArray(data?.orders)) {
      orderStore.updateOrders(data.orders);
    }
    if (Array.isArray(data?.positions)) {
      positionStore.updatePositions(data.positions);
    }
    if (data?.balance && accountsStore.currentAccount) {
      accountsStore.updateBalance(accountsStore.currentAccount._id, data.balance);
    }
  }

  handleCopyTradeSuccess(data) {
    const { parentOrder, childOrder } = data;
    const orderStore = useOrderStore.getState();
    
    // Update orders store
    orderStore.updateOrders(prevOrders => [...prevOrders, childOrder]);
    
    // Remove from pending orders
    this.pendingOrders.delete(parentOrder.orderId);
    
    // Show success notification
    toast.success(`Successfully copied trade: ${childOrder.symbol}`);
    
    // Update positions if needed
    this.requestPositionUpdate();
  }

  handleCopyTradeError(data) {
    const { error, parentOrderId } = data;
    
    // Remove from pending orders
    this.pendingOrders.delete(parentOrderId);
    
    // Show error notification
    toast.error(`Copy trade failed: ${error}`);
  }

  handleOrderUpdate(data) {
    const currentAccount = useAccountsStore.getState().currentAccount;
    
    // Track pending copy trades
    if (data.parentOrderId) {
      this.pendingOrders.set(data.parentOrderId, {
        status: data.status,
        timestamp: Date.now()
      });
    }

    // Update order status
    const orderStore = useOrderStore.getState();
    orderStore.updateOrderStatus(data.orderId, data.status);
  }

  handleError(data) {
    console.error('WebSocket error:', data.error);
    toast.error(data.error);
  }

  requestPositionUpdate() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'request_positions'
      }));
    }
  }

  handleDisconnect() {
    this.isConnecting = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`WebSocket disconnected. Attempt ${this.reconnectAttempts + 1} of ${this.maxReconnectAttempts}`);
      toast.error('Connection lost. Reconnecting...');
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectTimeout * Math.pow(2, this.reconnectAttempts));
    } else {
      console.error('Max reconnection attempts reached');
      toast.error('Failed to reconnect. Please refresh the page.');
      this.reconnectAttempts = 0;
    }
  }

  disconnect() {
    if (this.heartbeatChecker) {
      clearInterval(this.heartbeatChecker);
      this.heartbeatChecker = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.pendingOrders.clear();
    this.lastPingTime = null;
    this.heartbeatMissed = 0;
  }
}

export const wsService = new WebSocketService();