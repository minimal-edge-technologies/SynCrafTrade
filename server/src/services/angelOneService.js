// server/src/services/angelOneService.js
import { SmartAPI } from "smartapi-javascript";

class AngelOneService {
  constructor() {
    this.api = null;
  }

  async init(apiKey) {
    try {
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('API key is required');
      }
      
      console.log('Initializing Angel One API...');
      // Create new instance even if one exists to ensure fresh API key
      this.api = new SmartAPI({
        api_key: apiKey.trim(),
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize API:', error);
      throw error;
    }
  }

  async connectWebSocket(feedToken, clientCode) {
    if (this.socketConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log('Connecting to WebSocket feed...');
      await this.api.webSocketConnect(
        feedToken,
        clientCode,
        this.handleSocketMessage.bind(this)
      );
      this.socketConnected = true;
      console.log('WebSocket connected successfully');
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.socketConnected = false;
      throw error;
    }
  }

  handleSocketMessage(message) {
    try {
      // Handle different message types
      switch (message.messageType) {
        case 'order_update':
          this.handleOrderUpdate(message);
          break;
        case 'trade_update':
          this.handleTradeUpdate(message);
          break;
        default:
          console.log('Received message:', message);
      }
    } catch (error) {
      console.error('Error handling socket message:', error);
    }
  }

  async handleOrderUpdate(orderData) {
    if (this.processedOrders.has(orderData.orderId)) {
      return;
    }

    console.log('New order update:', orderData);
    // Process order for copy trading if needed
    this.processedOrders.add(orderData.orderId);
  }

  async handleTradeUpdate(tradeData) {
    console.log('New trade update:', tradeData);
    // Handle trade updates
  }

  async generateSession(clientCode, password, totp) {
    try {
      if (!this.api) {
        throw new Error('API not initialized');
      }

      console.log('Attempting to generate session for client:', clientCode);
      const session = await this.api.generateSession(clientCode, password, totp);
      console.log('Session response:', JSON.stringify(session, null, 2));

      if (!session?.data) {
        console.error('Invalid session response:', session);
        throw new Error(session?.message || 'Invalid session response');
      }

      this.api.setAccessToken(session.data.jwtToken);
      console.log('Access token set successfully');

      const profile = await this.api.getProfile();
      console.log('Profile response:', profile);

      if (!profile?.data) {
        console.error('Invalid profile response:', profile);
        throw new Error('Failed to fetch profile');
      }

      return {
        success: true,
        data: {
          ...session.data,
          name: profile?.data?.name || clientCode,
          email: profile?.data?.email,
          exchanges: profile?.data?.exchanges || []
        }
      };
    } catch (error) {
      console.error('Session generation failed:', error);
      return {
        success: false,
        error: error.message || 'Session generation failed'
      };
    }
  }

  async refreshSession(refreshToken) {
    try {
      if (!this.api) {
        throw new Error('API not initialized');
      }
  
      const session = await this.api.generateSessionFromRefreshToken(refreshToken);
      
      if (!session?.data) {
        throw new Error('Invalid refresh token response');
      }
  
      this.api.setAccessToken(session.data.jwtToken);
  
      return {
        success: true,
        data: session.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getOrderBook(token) {
    try {
      if (!this.api) {
        throw new Error('API not initialized');
      }

      if (token) {
        this.api.setAccessToken(token);
      }

      const response = await this.api.getOrderBook();
      return this.normalizeOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch order book:', error);
      throw error;
    }
  }

  async getPositions(token) {
    try {
      if (!this.api) {
        throw new Error('API not initialized');
      }

      if (token) {
        this.api.setAccessToken(token);
      }

      const response = await this.api.getPosition();
      return this.normalizePositions(response.data || []);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      throw error;
    }
  }

  async getRMS() {
    try {
      const response = await this.api.getRMS();
      console.log('Raw RMS response:', response);
  
      const normalizedData = {
        net: parseFloat(response.data.net) || 0,
        utilized: parseFloat(response.data.utilized) || 0,
        total: parseFloat(response.data.availablecash) || 0
      };
  
      return {
        success: true,
        data: normalizedData
      };
    } catch (error) {
      console.error('Failed to fetch RMS:', error);
      throw error;
    }
  }

  async processCopyTrade(parentOrder, childAccount) {
    try {
      const quantity = this.calculateCopyQuantity(
        parentOrder.quantity,
        childAccount.settings.copyRatio
      );

      const copyOrder = {
        variety: parentOrder.variety,
        tradingsymbol: parentOrder.symbol,
        symboltoken: parentOrder.symboltoken,
        transactiontype: parentOrder.transaction_type,
        exchange: parentOrder.exchange,
        ordertype: parentOrder.order_type,
        producttype: parentOrder.product,
        quantity: quantity.toString(),
        price: parentOrder.price,
        triggerprice: parentOrder.triggerPrice
      };

      const response = await this.api.placeOrder(copyOrder);
      console.log('Copy order placed:', response);
      return response;
    } catch (error) {
      console.error('Failed to place copy order:', error);
      throw error;
    }
  }

  calculateCopyQuantity(parentQuantity, copyRatio) {
    return Math.floor(parentQuantity * copyRatio);
  }


  normalizeOrders(orders) {
    return orders.map(order => ({
      orderId: order.orderid,
      symbol: order.tradingsymbol,
      quantity: parseInt(order.quantity),
      transaction_type: order.transactiontype,
      product: order.producttype,
      order_type: order.ordertype,
      status: order.status,
      price: parseFloat(order.price || 0),
      average_price: parseFloat(order.averageprice || 0),
      timestamp: new Date(order.updatetime || order.exchtime)
    }));
  }

  normalizePositions(positions) {
    return positions.map(pos => ({
      symbol: pos.tradingsymbol,
      quantity: parseInt(pos.netqty),
      average_price: parseFloat(pos.averageprice),
      last_price: parseFloat(pos.ltp),
      pnl: {
        realized: parseFloat(pos.realised || 0),
        unrealized: parseFloat(pos.unrealised || 0)
      }
    }));
  }

  disconnect() {
    if (this.api) {
      try {
        this.api.webSocketClose();
        this.socketConnected = false;
        console.log('WebSocket disconnected');
      } catch (error) {
        console.error('Error disconnecting WebSocket:', error);
      }
    }
  }
}

export const angelOneService = new AngelOneService();