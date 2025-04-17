// server/src/services/websocketService.js
import { SmartAPI } from "smartapi-javascript";
import WebSocket from 'ws';
import Account from '../models/Account.js';
import { decryptCredentials } from '../utils/encryption.js';
import OrderRelation from '../models/OrderRelation.js';

class WebSocketService {
  constructor() {
    this.smartApi = null;
    this.wss = null;
    this.clients = new Map();
    this.pollingInterval = null;
    this.processedOrders = new Set();
    this.angelOneService = null;

    // heartbeat tracking
    this.heartbeatInterval = null;
    this.lastHeartbeatResponses = new Map();

    // Cleanup on process exit
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  cleanup() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
    this.clients.clear();
    this.processedOrders.clear();
    this.lastHeartbeatResponses.clear();
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server });
    console.log('WebSocket server initialized');

    this.wss.on('connection', (ws) => {
      ws.on('message', async (msg) => {
        try {
          const data = JSON.parse(msg);
          await this.handleMessage(data, ws);
        } catch (error) {
          console.error('WS message handling error:', error);
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
      });

      ws.on('close', () => this.removeClient(ws));
      ws.on('error', (error) => console.error('WebSocket error:', error));
    });

    // Start the heartbeat system
    this.startHeartbeat();
  }

  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 20 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.clients.size === 0) return;

      console.log(`[HEARTBEAT] Sending ping to ${this.clients.size} clients`);

      for (const [ws, client] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if client responded to last heartbeat
          const lastHeartbeat = this.lastHeartbeatResponses.get(ws);
          const now = Date.now();

          // If no response in 45 seconds, consider connection dead
          if (lastHeartbeat && (now - lastHeartbeat > 45000)) {
            console.log(`[HEARTBEAT] Client ${client.tokens?.clientCode} not responding, closing connection`);
            ws.terminate(); // Force close
            this.removeClient(ws);
            continue;
          }

          // Send heartbeat
          ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
        }
      }
    }, 20000); // 20 seconds
  }

  async handleMessage(data, ws) {
    switch (data.type) {
      case 'auth':
        await this.handleClientAuth(ws, data.tokens);
        break;
      case 'order_update':
        await this.handleOrderUpdate(data.order);
        break;
      case 'copy_status_change':
        await this.handleCopyStatusChange(data);
        break;
      case 'account_connection':
        await this.handleAccountConnection(data);
        break;
      case 'pong':
        // Record heartbeat response
        this.lastHeartbeatResponses.set(ws, Date.now());
        break;
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  notifyClient(accountId, message) {
    for (const [ws, client] of this.clients.entries()) {
      if (client.accountId === accountId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  // In websocketService.js
  async handleClientAuth(ws, tokens) {
    try {
      this.smartApi = new SmartAPI({
        api_key: tokens.apiKey,
      });

      await this.smartApi.generateSession(tokens.clientCode, tokens.password, tokens.totp);
      this.smartApi.setAccessToken(tokens.jwtToken);

      const account = await Account.findOne({ clientCode: tokens.clientCode });
      if (!account) {
        throw new Error('Account not found');
      }

      // Initialize heartbeat tracking for this client
      this.lastHeartbeatResponses.set(ws, Date.now());

      // Store the client connection
      this.clients.set(ws, {
        tokens,
        accountType: account.accountType,
        accountId: account._id
      });

      // For CHILD accounts, also find and monitor the parent account
      if (account.accountType === 'CHILD' && account.parentAccount) {
        const parentAccount = await Account.findById(account.parentAccount);
        if (parentAccount) {
          console.log(`[WS] Child account ${account.clientCode} is connected to parent ${parentAccount.clientCode}`);
          // Store a reference to the parent account on the client
          const client = this.clients.get(ws);
          client.parentAccountId = parentAccount._id;
          client.parentClientCode = parentAccount.clientCode;

          // Make sure we also fetch data for the parent account
          if (!this.monitoredParentAccounts) {
            this.monitoredParentAccounts = new Map();
          }

          // We'll use this to fetch parent orders even if no user is directly viewing parent account
          this.monitoredParentAccounts.set(parentAccount._id.toString(), {
            accountId: parentAccount._id,
            clientCode: parentAccount.clientCode,
            childAccounts: [account._id]
          });
        }
      }

      if (!this.pollingInterval) {
        await this.startPolling();
      }

      ws.send(JSON.stringify({ type: 'auth', status: 'success' }));
      console.log(`Client authenticated: ${account.clientCode} (${account.accountType})`);
    } catch (error) {
      // Error handling...
    }
  }

  async handleOrderUpdate(orderData) {
    try {
      // Check if it's a parent account order
      const account = await Account.findById(orderData.accountId);
      if (!account || account.accountType !== 'PARENT') return;
  
      // Get all connected and active child accounts
      const childAccounts = await Account.find({
        parentAccount: account._id,
        copyTradingEnabled: true,
        status: 'ACTIVE'
      });
  
      if (childAccounts.length === 0) {
        console.log(`[ORDER] No active child accounts for parent ${account.clientCode}, skipping`);
        return;
      }
  
      // Normalize status to uppercase for consistent comparison
      const status = (orderData.status || '').toUpperCase();
     
      // Log the order status to help with debugging
      console.log(`[ORDER] Processing parent order: ${orderData.orderId}, status: ${status}`);
  
      // Handle different order statuses
      switch(status) {
        case 'NEW':
        case 'OPEN':
        case 'PENDING':
          // Before copying, check if this order has been processed before
          const existingCopy = await OrderRelation.findOne({ 
            parentOrderId: orderData.orderId 
          });
          
          if (existingCopy) {
            console.log(`[ORDER] Parent order ${orderData.orderId} already has copies, skipping duplicate`);
            return;
          }
          
          // New order placed - copy to children
          await this.copyOrderToChildren(orderData, childAccounts);
          break;
         
        case 'MODIFIED':
        case 'REPLACED':
        case 'AMENDED':
          // Order modified - update child orders
          await this.updateChildOrders(orderData, childAccounts);
          break;
         
        case 'CANCELLED':
        case 'REJECTED':
          // Order cancelled - cancel child orders
          await this.cancelChildOrders(orderData, childAccounts);
          break;
         
        case 'COMPLETE':
        case 'FILLED':
        case 'EXECUTED':
          // Check if we've already copied this complete order
          const existingCompleteOrder = await OrderRelation.findOne({ 
            parentOrderId: orderData.orderId 
          });
          
          if (existingCompleteOrder) {
            console.log(`[ORDER] Complete order ${orderData.orderId} already processed, updating status`);
            // Just update the status
            existingCompleteOrder.status = 'COMPLETE';
            await existingCompleteOrder.save();
            return;
          }
          
          // If not yet copied (rare case for orders that went directly to COMPLETE), copy it
          console.log(`[ORDER] Processing complete order ${orderData.orderId} not previously copied`);
          await this.copyOrderToChildren(orderData, childAccounts);
          break;
         
        default:
          console.log(`[ORDER] Unhandled order status: ${status}, orderId: ${orderData.orderId}`);
          
          // For unrecognized statuses, check if already processed before copying
          const existingUnknownOrder = await OrderRelation.findOne({ 
            parentOrderId: orderData.orderId 
          });
          
          if (existingUnknownOrder) {
            console.log(`[ORDER] Unknown status order ${orderData.orderId} already processed, skipping`);
            return;
          }
          
          // If truly new with unknown status, copy it
          await this.copyOrderToChildren(orderData, childAccounts);
      }
    } catch (error) {
      console.error('Error in order update:', error);
    }
  }

  async copyOrderToChildren(parentOrder, childAccounts) {
    console.log(`[COPY] Starting copy process for order ${parentOrder.orderId} to ${childAccounts.length} accounts`);

    for (const childAccount of childAccounts) {
      try {
        console.log(`[COPY] Processing copy to child account: ${childAccount.clientCode} (ID: ${childAccount._id})`);

        // Check if we've already copied this order to this child
        const existingRelation = await OrderRelation.findOne({
          parentOrderId: parentOrder.orderId,
          childAccountId: childAccount._id
        });

        if (existingRelation) {
          console.log(`[COPY] Order ${parentOrder.orderId} already copied to ${childAccount.clientCode}, skipping`);
          continue;
        }

        // Validate the trade
        const validationResult = await this.validateCopyTrade(parentOrder, childAccount);
        if (!validationResult.isValid) {
          console.log(`[COPY] Validation failed for child account ${childAccount.clientCode}: ${validationResult.error}`);
          this.notifyClient(childAccount._id, {
            type: 'copy_trade_error',
            data: { error: validationResult.error, parentOrderId: parentOrder.orderId }
          });
          continue;
        }

        console.log(`[COPY] Trade validation passed for ${childAccount.clientCode}`);

        // Get child account credentials and tokens
        const decryptedCreds = await decryptCredentials(childAccount.credentials);
        console.log(`[COPY] Credentials decrypted successfully: API Key present: ${!!decryptedCreds.apiKey}`);

        // Calculate child order quantity
        const copyRatio = childAccount.settings?.copyRatio || 1.0;
        const maxPositionSize = childAccount.settings?.maxPositionSize || 10;
        const accountBalance = childAccount.balance?.net || 1000;

        console.log(`[COPY] Copy settings for ${childAccount.clientCode}: ratio=${copyRatio}, maxSize=${maxPositionSize}%, balance=${accountBalance}`);

        const quantity = this.calculateChildQuantity(
          parentOrder.quantity,
          copyRatio,
          maxPositionSize,
          accountBalance
        );

        console.log(`[COPY] Calculated quantity for ${childAccount.clientCode}: ${quantity} (parent: ${parentOrder.quantity}, ratio: ${copyRatio})`);

        if (quantity <= 0) {
          console.log(`[COPY] Skipping order for ${childAccount.clientCode}: quantity is zero`);
          continue;
        }

        // Initialize API with child account
        console.log(`[COPY] Initializing API for ${childAccount.clientCode}`);
        const childApi = new SmartAPI({
          api_key: decryptedCreds.apiKey
        });

        // Important change: Check if we have a stored JWT token for this account
        if (childAccount.tokens?.jwtToken) {
          console.log(`[COPY] Using existing token for ${childAccount.clientCode}`);
          childApi.setAccessToken(childAccount.tokens.jwtToken);
        } else {
          // Fallback to authentication if no token available
          console.log(`[COPY] No token available, authenticating ${childAccount.clientCode}`);
          try {
            const sessionResult = await childApi.generateSession(
              childAccount.clientCode,
              decryptedCreds.password,
              decryptedCreds.totp
            );

            if (!sessionResult.data?.jwtToken) {
              throw new Error('Failed to generate session: ' + (sessionResult.message || 'No token received'));
            }

            childApi.setAccessToken(sessionResult.data.jwtToken);

            // Update the account with the new token
            await Account.findByIdAndUpdate(childAccount._id, {
              tokens: {
                jwtToken: sessionResult.data.jwtToken,
                refreshToken: sessionResult.data.refreshToken,
                feedToken: sessionResult.data.feedToken
              }
            });

            console.log(`[COPY] New token generated and saved for ${childAccount.clientCode}`);
          } catch (sessionError) {
            console.error(`[COPY] Session generation error for ${childAccount.clientCode}:`, sessionError);
            throw new Error(`Authentication failed: ${sessionError.message}`);
          }
        }
        if (!parentOrder.symboltoken) {
          try {
            console.log(`[COPY] No symboltoken found, looking up for ${parentOrder.symbol}`);
            // Get the token by calling Angel One's search instrument API
            const searchResult = await childApi.searchScrip(parentOrder.symbol);
            if (searchResult.data && searchResult.data.length > 0) {
              // Find the exact match for exchange and symbol
              const instrument = searchResult.data.find(
                item => item.tradingsymbol === parentOrder.symbol &&
                  item.exchange === (parentOrder.exchange || "NSE")
              );

              if (instrument && instrument.token) {
                console.log(`[COPY] Found symboltoken: ${instrument.token} for ${parentOrder.symbol}`);
                orderParams.symboltoken = instrument.token;
              }
            }
          } catch (searchError) {
            console.error(`[COPY] Error looking up symboltoken: ${searchError}`);
          }
        }

        let orderType = "MARKET";
        if (parentOrder.status === "PENDING" || parentOrder.orderType === "LIMIT") {
          orderType = "LIMIT";
        }

        // Place the order
        const orderParams = {
          variety: "NORMAL",
          tradingsymbol: parentOrder.symbol,
          symboltoken: parentOrder.symboltoken || "",
          transactiontype: parentOrder.transactionType,
          exchange: parentOrder.exchange || "NSE",
          ordertype: orderType,
          producttype: parentOrder.product || "INTRADAY",
          quantity: quantity.toString(),
          price: orderType === "LIMIT" ? parentOrder.price.toString() : "0",
          triggerprice: "0",
          duration: "DAY"
        };

        console.log(`[COPY] Order parameters for ${childAccount.clientCode}:`, JSON.stringify(orderParams));

        try {
          console.log(`[COPY] Placing order for ${childAccount.clientCode}...`);
          const orderResponse = await childApi.placeOrder(orderParams);
          console.log(`[COPY] Order placed for ${childAccount.clientCode}:`, JSON.stringify(orderResponse));

          if (orderResponse.data?.orderid) {
            // Create order relation record
            const orderRelation = new OrderRelation({
              parentOrderId: parentOrder.orderId,
              childOrderId: orderResponse.data.orderid,
              parentAccountId: parentOrder.accountId,
              childAccountId: childAccount._id,
              symbol: parentOrder.symbol,
              quantity: quantity,
              price: parentOrder.price,
              transactionType: parentOrder.transactionType,
              status: 'PLACED',
              copyRatio: childAccount.settings?.copyRatio || 1.0
            });

            await orderRelation.save();
            console.log(`[COPY] Saved order relation for ${parentOrder.orderId} -> ${orderResponse.data.orderid}`);
          }
          // Send success notification
          this.notifyClient(childAccount._id, {
            type: 'copy_trade_success',
            data: {
              parentOrderId: parentOrder.orderId,
              childOrderId: orderResponse.data?.orderid
            }
          });
        } catch (orderError) {
          // Check if error is due to token expiration
          if (orderError.message.includes('token') || orderError.message.includes('unauthorized')) {
            console.log(`[COPY] Token expired for ${childAccount.clientCode}, will try to refresh`);

            // Try to refresh token
            if (childAccount.tokens?.refreshToken) {
              try {
                const refreshResult = await childApi.generateAccessTokenFromRefreshToken(childAccount.tokens.refreshToken);
                if (refreshResult.data?.jwtToken) {
                  childApi.setAccessToken(refreshResult.data.jwtToken);

                  // Update the account with the new token
                  await Account.findByIdAndUpdate(childAccount._id, {
                    tokens: {
                      jwtToken: refreshResult.data.jwtToken,
                      refreshToken: refreshResult.data.refreshToken || childAccount.tokens.refreshToken,
                      feedToken: refreshResult.data.feedToken || childAccount.tokens.feedToken
                    }
                  });

                  // Try the order again with new token
                  const orderResponse = await childApi.placeOrder(orderParams);
                  console.log(`[COPY] Order placed after token refresh for ${childAccount.clientCode}:`, JSON.stringify(orderResponse));

                  // Send success notification
                  this.notifyClient(childAccount._id, {
                    type: 'copy_trade_success',
                    data: {
                      parentOrderId: parentOrder.orderId,
                      childOrderId: orderResponse.data?.orderid
                    }
                  });

                  continue; // Skip to next account
                }
              } catch (refreshError) {
                console.error(`[COPY] Token refresh failed for ${childAccount.clientCode}:`, refreshError);
              }
            }
          }

          console.error(`[COPY] Order placement error for ${childAccount.clientCode}:`, orderError);
          throw new Error(`Order placement failed: ${orderError.message}`);
        }
      } catch (error) {
        console.error(`[COPY] Failed to copy order to child ${childAccount.clientCode}:`, error);
        this.notifyClient(childAccount._id, {
          type: 'copy_trade_error',
          data: {
            error: error.message,
            parentOrderId: parentOrder.orderId
          }
        });
      }
    }
  }

  calculateChildQuantity(parentQuantity, copyRatio, maxPositionSize, accountBalance) {
    // First calculate based on ratio
    const baseQuantity = Math.floor(parentQuantity * copyRatio);

    // We'd need price for position size check, but if not available, just return the base quantity
    return baseQuantity;
  }

  async updateChildOrders(parentOrder, childAccounts) {
    console.log(`[MODIFY] Starting update for child orders of parent order: ${parentOrder.orderId}`);
    // Find all related child orders
    const orderRelations = await OrderRelation.find({
      parentOrderId: parentOrder.orderId
    });

    console.log(`[MODIFY] Found ${orderRelations.length} child orders to update`);

    for (const relation of orderRelations) {
      try {
        const childAccount = childAccounts.find(acc => acc._id.toString() === relation.childAccountId.toString());
        if (!childAccount) {
          console.log(`[MODIFY] Child account not found for relation, skipping`);
          continue;
        }

        console.log(`[MODIFY] Processing update for child account: ${childAccount.clientCode} (${childAccount._id})`);

        // Calculate new quantity if needed
        const newQuantity = this.calculateChildQuantity(
          parentOrder.quantity,
          childAccount.settings?.copyRatio || 1.0,
          childAccount.settings?.maxPositionSize || 10,
          childAccount.balance?.net || 1000
        );

        // Check if anything has actually changed
        const quantityChanged = relation.quantity !== newQuantity;
        const priceChanged = Math.abs(relation.price - parentOrder.price) > 0.01;
        const statusChanged = relation.status.toLowerCase() !== parentOrder.status.toLowerCase();


        if (!quantityChanged && !priceChanged && !statusChanged) {
          console.log(`[MODIFY] No meaningful changes for order ${relation.childOrderId}, skipping`);
          continue;
        }

        console.log(`[MODIFY] Changes for order ${relation.childOrderId}:`);
        if (quantityChanged) console.log(`  - Quantity: ${relation.quantity} → ${newQuantity}`);
        if (priceChanged) console.log(`  - Price: ${relation.price} → ${parentOrder.price}`);
        if (statusChanged) console.log(`  - Status: ${relation.status} → ${parentOrder.status}`);

        // Get decrypted credentials
        const decryptedCreds = await decryptCredentials(childAccount.credentials);

        // Initialize API
        const childApi = new SmartAPI({
          api_key: decryptedCreds.apiKey
        });

        if (!childAccount.tokens?.jwtToken) {
          console.log(`[MODIFY] No token available for ${childAccount.clientCode}, skipping`);
          continue;
        }

        childApi.setAccessToken(childAccount.tokens.jwtToken);

        // Get the symboltoken if not already available
        let symboltoken = parentOrder.symboltoken;

        if (!symboltoken) {
          try {
            console.log(`[MODIFY] Looking up symboltoken for ${parentOrder.symbol}`);
            const searchResult = await childApi.searchScrip(parentOrder.symbol);

            if (searchResult.data && searchResult.data.length > 0) {
              // Find the exact match for exchange and symbol
              const instrument = searchResult.data.find(
                item => item.tradingsymbol === parentOrder.symbol &&
                  item.exchange === (parentOrder.exchange || "NSE")
              );

              if (instrument && instrument.token) {
                symboltoken = instrument.token;
                console.log(`[MODIFY] Found symboltoken: ${symboltoken} for ${parentOrder.symbol}`);
              } else {
                console.log(`[MODIFY] Could not find exact match for ${parentOrder.symbol}`);
              }
            }
          } catch (searchError) {
            console.error(`[MODIFY] Error looking up symboltoken: ${searchError}`);
          }
        }

        if (!symboltoken) {
          console.log(`[MODIFY] Cannot proceed without symboltoken for ${parentOrder.symbol}`);
          continue;
        }

        // Modify child order - INCLUDE THE SYMBOLTOKEN
        const modifyParams = {
          variety: "NORMAL",
          orderid: relation.childOrderId,
          quantity: newQuantity.toString(),
          price: parentOrder.price.toString(),
          symboltoken: symboltoken,  // This is the crucial addition
          tradingsymbol: parentOrder.symbol,  // Also add this for completeness
          exchange: parentOrder.exchange || "NSE",  // And this
          ordertype: parentOrder.orderType || "LIMIT",
          duration: "DAY"
        };

        console.log(`[MODIFY] Sending modification request:`, JSON.stringify(modifyParams));

        const response = await childApi.modifyOrder(modifyParams);
        console.log(`[MODIFY] Modification response for ${relation.childOrderId} for ${childAccount.clientCode}:`, response);

        if (response.status) {
          // Update relation status
          relation.status = 'MODIFIED';
          relation.quantity = newQuantity;
          relation.price = parentOrder.price;
          relation.lastUpdated = new Date();
          await relation.save();

          console.log(`[MODIFY] Successfully updated order in database`);
        } else {
          console.error(`[MODIFY] API returned error:`, response);
        }
      } catch (error) {
        console.error(`[MODIFY] Failed to update child order ${relation?.childOrderId}:`, error);
      }
    }
  }

  async cancelChildOrders(parentOrder, childAccounts) {
    console.log(`[CANCEL] Starting cancellation for child orders of parent order: ${parentOrder.orderId}`);

    // Find all related child orders
    const orderRelations = await OrderRelation.find({
      parentOrderId: parentOrder.orderId
    });

    console.log(`[CANCEL] Found ${orderRelations.length} child orders to cancel`);

    for (const relation of orderRelations) {
      try {
        const childAccount = childAccounts.find(acc => acc._id.toString() === relation.childAccountId.toString());
        if (!childAccount) {
          console.log(`[CANCEL] Child account not found for relation, skipping`);
          continue;
        }

        console.log(`[CANCEL] Processing cancellation for child account: ${childAccount.clientCode} (${childAccount._id})`);

        // Get decrypted credentials
        const decryptedCreds = await decryptCredentials(childAccount.credentials);

        // Initialize API
        const childApi = new SmartAPI({
          api_key: decryptedCreds.apiKey
        });

        if (!childAccount.tokens?.jwtToken) {
          console.log(`[CANCEL] No token available for ${childAccount.clientCode}, skipping`);
          continue;
        }

        childApi.setAccessToken(childAccount.tokens.jwtToken);

        // Cancel child order
        const cancelParams = {
          variety: "NORMAL",
          orderid: relation.childOrderId
        };

        console.log(`[CANCEL] Sending cancellation request:`, JSON.stringify(cancelParams));

        const response = await childApi.cancelOrder(cancelParams);
        console.log(`[CANCEL] Cancellation response for ${relation.childOrderId} for ${childAccount.clientCode}:`, response);

        if (response.status) {
          // Update relation status
          relation.status = 'CANCELLED';
          relation.lastUpdated = new Date();
          await relation.save();

          console.log(`[CANCEL] Successfully cancelled order and updated in database`);
        } else {
          console.error(`[CANCEL] API returned error:`, response);
        }
      } catch (error) {
        console.error(`[CANCEL] Failed to cancel child order ${relation.childOrderId}:`, error);
      }
    }
  }
  


  async startPolling() {
    console.log('Starting order and position polling');
    this.pollingInterval = setInterval(async () => {
      try {
        // Poll updates for connected clients
        for (const [ws, client] of this.clients.entries()) {
          if (ws.readyState === WebSocket.OPEN) {
            await this.fetchUpdatesForClient(ws, client);
          }
        }

        // Also poll parent accounts that need to be monitored for copy trading
        if (this.monitoredParentAccounts && this.monitoredParentAccounts.size > 0) {
          console.log(`[WS] Polling ${this.monitoredParentAccounts.size} monitored parent accounts for copy trading`);

          for (const [parentId, parentInfo] of this.monitoredParentAccounts.entries()) {
            await this.fetchParentAccountUpdates(parentInfo);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }

  // New method to fetch updates specifically for parent accounts being monitored
  async fetchParentAccountUpdates(parentInfo) {
    try {
      console.log(`[WS] Fetching orders for monitored parent account: ${parentInfo.clientCode}`);

      // Initialize processed orders set if it doesn't exist
      if (!this.processedOrdersMap) {
        this.processedOrdersMap = new Map();
      }

      // Load the parent account from DB
      const parentAccount = await Account.findById(parentInfo.accountId);
      if (!parentAccount) {
        console.error(`[WS] Parent account not found: ${parentInfo.accountId}`);
        return;
      }

      // Check if we have a stored JWT token
      if (!parentAccount.tokens?.jwtToken) {
        console.warn(`[WS] No token available for parent account ${parentInfo.clientCode}`);
        return;
      }

      // Get decrypted credentials for the API key
      const decryptedCreds = await decryptCredentials(parentAccount.credentials);

      // Initialize API with the API key
      const parentApi = new SmartAPI({
        api_key: decryptedCreds.apiKey
      });

      // Use the stored JWT token
      parentApi.setAccessToken(parentAccount.tokens.jwtToken);

      // Get previous orders to compare with new ones
      const previousOrders = parentInfo.previousOrders || [];

      try {
        // Fetch orders and RMS data
        const [orderResponse, rmsResponse] = await Promise.all([
          parentApi.getOrderBook(),
          parentApi.getRMS()
        ]);

        // Update account balance if RMS data is available
        if (rmsResponse && rmsResponse.data) {
          const balanceData = {
            net: parseFloat(rmsResponse.data.net) || 0,
            used: parseFloat(rmsResponse.data.utilized) || 0,
            available: parseFloat(rmsResponse.data.availablecash) || 0
          };

          await Account.findByIdAndUpdate(parentInfo.accountId, {
            balance: balanceData,
            lastSync: new Date()
          });
        }

        const orders = orderResponse.data || [];

        // Create a map of previous orders for easier comparison
        const prevOrderMap = new Map();
        previousOrders.forEach(order => {
          prevOrderMap.set(order.orderid, {
            status: order.status,
            quantity: order.quantity,
            price: order.price || '0',
            averageprice: order.averageprice || '0',
            filledshares: order.filledshares || '0'
          });
        });

        // Check for new completed orders
        console.log(`[WS] Checking ${orders.length} orders from parent ${parentAccount.clientCode}`);

        // Track new or changed orders
        const ordersToProcess = [];

        for (const order of orders) {
          const orderId = order.orderid;
          if (!orderId) continue;

          // Check if we've already processed this order with this status
          const processKey = `${orderId}-${order.status}`;
          if (this.processedOrdersMap.has(processKey)) {
            continue;
          }

          // Get previous order data
          const prevOrder = prevOrderMap.get(orderId);

          // Compare current order with previous state
          let hasChanged = false;
          let changeReason = '';

          if (!prevOrder) {
            // This is a completely new order
            hasChanged = true;
            changeReason = 'New order';
          } else {
            // Check each field for changes and log specifics
            if (prevOrder.status !== order.status) {
              hasChanged = true;
              changeReason = `Status changed: ${prevOrder.status} -> ${order.status}`;
            }

            // Convert to strings for safer comparison
            const prevQuantity = String(prevOrder.quantity || '');
            const currQuantity = String(order.quantity || '');
            if (prevQuantity !== currQuantity) {
              hasChanged = true;
              changeReason = `Quantity changed: ${prevQuantity} -> ${currQuantity}`;
            }

            const prevPrice = String(prevOrder.price || '0');
            const currPrice = String(order.price || '0');
            if (prevPrice !== currPrice) {
              hasChanged = true;
              changeReason = `Price changed: ${prevPrice} -> ${currPrice}`;
            }

            const prevAvgPrice = String(prevOrder.averageprice || '0');
            const currAvgPrice = String(order.averageprice || '0');
            if (prevAvgPrice !== currAvgPrice) {
              hasChanged = true;
              changeReason = `Avg price changed: ${prevAvgPrice} -> ${currAvgPrice}`;
            }
          }

          if (hasChanged) {
            console.log(`[WS] Order ${orderId} has changed: ${changeReason}`);

            // Check if we need to process this order
            const alreadyExists = await OrderRelation.findOne({ parentOrderId: orderId });

            if (alreadyExists) {
              // Check if anything significant has changed that requires an update
              const significantChange =
                (prevOrder?.status !== order.status &&
                  ['complete', 'cancelled', 'rejected'].includes(order.status?.toLowerCase())) ||
                (prevOrder?.quantity !== order.quantity);

              if (significantChange) {
                console.log(`[WS] Significant change detected for existing order ${orderId}`);
                ordersToProcess.push(order);
              } else {
                console.log(`[WS] Order ${orderId} has minor changes, skipping update`);
              }
            } else {
              // New order that hasn't been copied yet
              ordersToProcess.push(order);
            }

            // Mark this order as processed with current status
            this.processedOrdersMap.set(processKey, Date.now());

            // Keep the map from growing too large
            if (this.processedOrdersMap.size > 1000) {
              const keysToDelete = Array.from(this.processedOrdersMap.entries())
                .sort((a, b) => a[1] - b[1])
                .slice(0, 200)
                .map(entry => entry[0]);

              keysToDelete.forEach(key => this.processedOrdersMap.delete(key));
            }
          }
        }

        // Store current orders for next comparison
        parentInfo.previousOrders = JSON.parse(JSON.stringify(orders)); // Deep copy

        // Process each new/changed order
        for (const orderToProcess of ordersToProcess) {
          console.log(`[WS] Processing order: ${orderToProcess.orderid}, status: ${orderToProcess.status}`);
          await this.handleParentOrder(parentInfo.accountId, orderToProcess);
        }

      } catch (apiError) {
        // Handle token expiration
        if (apiError.message.includes('token') || apiError.message.includes('unauthorized')) {
          console.warn(`[WS] Token expired for parent account ${parentInfo.clientCode}, refresh needed`);

          // Try to refresh the token if refresh token is available
          if (parentAccount.tokens?.refreshToken) {
            try {
              const refreshResult = await parentApi.generateAccessTokenFromRefreshToken(
                parentAccount.tokens.refreshToken
              );

              if (refreshResult.data?.jwtToken) {
                // Update token in database
                await Account.findByIdAndUpdate(parentAccount._id, {
                  tokens: {
                    jwtToken: refreshResult.data.jwtToken,
                    refreshToken: refreshResult.data.refreshToken || parentAccount.tokens.refreshToken,
                    feedToken: refreshResult.data.feedToken || parentAccount.tokens.feedToken
                  }
                });

                console.log(`[WS] Successfully refreshed token for ${parentInfo.clientCode}`);
              }
            } catch (refreshError) {
              console.error(`[WS] Failed to refresh token: ${refreshError.message}`);
            }
          }
        } else {
          console.error(`[WS] API error for parent account ${parentInfo.clientCode}: ${apiError.message}`);
        }
      }
    } catch (error) {
      console.error(`[WS] Error fetching parent account updates: ${error}`);
    }
  }

  async handleClientAuth(ws, tokens) {
    try {
      this.smartApi = new SmartAPI({
        api_key: tokens.apiKey,
      });

      await this.smartApi.generateSession(tokens.clientCode, tokens.password, tokens.totp);
      this.smartApi.setAccessToken(tokens.jwtToken);

      const account = await Account.findOne({ clientCode: tokens.clientCode });
      if (!account) {
        throw new Error('Account not found');
      }

      // Store the client connection
      this.clients.set(ws, {
        tokens,
        accountType: account.accountType,
        accountId: account._id
      });

      // For CHILD accounts, also find and monitor the parent account
      if (account.accountType === 'CHILD' && account.parentAccount) {
        const parentAccount = await Account.findById(account.parentAccount);
        if (parentAccount) {
          console.log(`[WS] Child account ${account.clientCode} is connected to parent ${parentAccount.clientCode}`);
          // Store a reference to the parent account on the client
          const client = this.clients.get(ws);
          client.parentAccountId = parentAccount._id;
          client.parentClientCode = parentAccount.clientCode;

          // Make sure we also fetch data for the parent account
          if (!this.monitoredParentAccounts) {
            this.monitoredParentAccounts = new Map();
          }

          // We'll use this to fetch parent orders even if no user is directly viewing parent account
          this.monitoredParentAccounts.set(parentAccount._id.toString(), {
            accountId: parentAccount._id,
            clientCode: parentAccount.clientCode,
            childAccounts: [account._id]
          });
        }
      }

      if (!this.pollingInterval) {
        await this.startPolling();
      }

      ws.send(JSON.stringify({ type: 'auth', status: 'success' }));
      console.log(`Client authenticated: ${account.clientCode} (${account.accountType})`);
    } catch (error) {
      console.error(`[WS] Error fetching parent account updates: ${error}`);
    }
  }

  async fetchUpdatesForClient(ws, client) {
    try {
      this.smartApi.setAccessToken(client.tokens.jwtToken);

      // Get previous orders to compare with new ones
      const previousOrders = client.previousOrders || [];
      
      // Properly capture all three responses
      const [orders, positions, rmsResponse] = await Promise.all([
        this.smartApi.getOrderBook(),
        this.smartApi.getPosition(),
        this.smartApi.getRMS()
      ]);

      // For parent accounts, check for new orders
      if (client.accountType === 'PARENT' && orders?.data) {
        console.log(`[WS] Checking for new orders in parent account: ${client.tokens.clientCode}`);
        console.log(`[WS] Previous order count: ${previousOrders.length}, Current count: ${orders.data.length}`);

        // Skip copying for the first poll if there's no previous data
        if (previousOrders.length === 0) {
          console.log(`[WS] First poll for parent account ${client.tokens.clientCode}, storing ${orders.data.length} existing orders for future reference`);
          client.previousOrders = orders.data || [];

          // Send updates to client without copying trades
          ws.send(JSON.stringify({
            type: 'data',
            data: {
              orders: this.normalizeOrders(orders.data || []),
              positions: this.normalizePositions(positions.data || [])
            }
          }));
          return; // Exit early for first poll
        }

        // Create map of previous orders for efficient lookup
        const prevOrderMap = new Map();
        previousOrders.forEach(order => {
          prevOrderMap.set(order.orderid, {
            status: order.status || order.orderstatus,
            quantity: order.quantity,
            price: order.price || '0',
            averageprice: order.averageprice || '0'
          });
        });

        // Find orders that are new or changed
        const ordersToProcess = [];

        for (const order of orders.data) {
          const orderId = order.orderid;
          if (!orderId) continue;

          // Check if this is a new order
          const prevOrder = prevOrderMap.get(orderId);
          if (!prevOrder) {
            console.log(`[WS] New order detected: ${orderId}`);
            ordersToProcess.push(order);
            continue;
          }

          // Check for status changes
          const prevStatus = prevOrder.status || '';
          const currentStatus = order.status || order.orderstatus || '';
          if (prevStatus !== currentStatus) {
            console.log(`[WS] Order status changed: ${orderId} (${prevStatus} -> ${currentStatus})`);
            ordersToProcess.push(order);
            continue;
          }

          // Check for quantity changes
          const prevQuantity = String(prevOrder.quantity || '');
          const currQuantity = String(order.quantity || '');
          if (prevQuantity !== currQuantity) {
            console.log(`[WS] Order quantity changed: ${orderId} (${prevQuantity} -> ${currQuantity})`);
            ordersToProcess.push(order);
            continue;
          }

          // Check for price changes
          const prevPrice = String(prevOrder.price || prevOrder.averageprice || '0');
          const currPrice = String(order.price || order.averageprice || '0');
          if (prevPrice !== currPrice) {
            console.log(`[WS] Order price changed: ${orderId} (${prevPrice} -> ${currPrice})`);
            ordersToProcess.push(order);
            continue;
          }
        }

        // Process the orders that need to be handled
        if (ordersToProcess.length > 0) {
          console.log(`[WS] Found ${ordersToProcess.length} orders to process`);

          for (const orderToProcess of ordersToProcess) {
            console.log(`[WS] Processing order: ${orderToProcess.orderid}, status: ${orderToProcess.status || orderToProcess.orderstatus}`);
            await this.handleParentOrder(client.accountId, orderToProcess);
          }
        }
      }

      // Store current orders for next comparison
      client.previousOrders = JSON.parse(JSON.stringify(orders.data || []));

      // Update account balance in database
      if (rmsResponse && rmsResponse.data) {
        const balanceData = {
          net: parseFloat(rmsResponse.data.net) || 0,
          used: parseFloat(rmsResponse.data.utilized) || 0,
          available: parseFloat(rmsResponse.data.availablecash) || 0
        };

        // Update account in database
        await Account.findByIdAndUpdate(client.accountId, {
          balance: balanceData,
          lastSync: new Date()
        });

        // Include balance in the data sent to client
        ws.send(JSON.stringify({
          type: 'data',
          data: {
            orders: this.normalizeOrders(orders.data || []),
            positions: this.normalizePositions(positions.data || []),
            balance: balanceData // Add balance to websocket response
          }
        }));
      } else {
        // If balance fetch fails, still send orders and positions
        ws.send(JSON.stringify({
          type: 'data',
          data: {
            orders: this.normalizeOrders(orders.data || []),
            positions: this.normalizePositions(positions.data || [])
          }
        }));
      }
    } catch (error) {
      console.error(`[WS] Error fetching updates for client: ${client.tokens?.clientCode}`, error);
    }
  }

  // Add this method to handle parent orders
  async handleParentOrder(accountId, order) {
    try {
      // Get the parent account
      const parentAccount = await Account.findById(accountId);
      if (!parentAccount) {
        console.error(`[COPY] Parent account not found for ID: ${accountId}`);
        return;
      }

      if (parentAccount.accountType !== 'PARENT') {
        console.error(`[COPY] Account ${parentAccount.clientCode} is not a parent account (type: ${parentAccount.accountType})`);
        return;
      }

      // Get child accounts connected to this parent
      console.log(`[COPY] Finding child accounts for parent: ${parentAccount._id}`);
      const childAccounts = await Account.find({
        parentAccount: parentAccount._id,
        copyTradingEnabled: true,
        status: 'ACTIVE'
      });

      console.log(`[COPY] Found ${childAccounts.length} active child accounts for parent ${parentAccount.clientCode}`);
      if (childAccounts.length === 0) {
        console.log(`[COPY] No active child accounts for parent ${parentAccount.clientCode}`);
        return;
      }

      // Check if we should skip processing
      const processKey = `${order.orderid}-processed`;
      if (this.processedOrdersMap && this.processedOrdersMap.has(processKey)) {
        console.log(`[COPY] Order ${order.orderid} has already been fully processed, skipping`);
        return;
      }

      // Convert Angel One order to our format
      const normalizedOrder = {
        orderId: order.orderid,
        symbol: order.tradingsymbol,
        quantity: parseInt(order.quantity),
        transactionType: order.transactiontype,
        product: order.producttype,
        orderType: order.ordertype,
        price: parseFloat(order.price || order.averageprice || 0),
        exchange: order.exchange,
        status: order.status,
        symboltoken: order.symboltoken || "",
        accountId
      };

      // console.log(`[COPY] Normalized order:`, JSON.stringify(normalizedOrder));
      console.log(`[DEBUG] Order status: ${normalizedOrder.status}, Status lower: ${normalizedOrder.status?.toLowerCase()}`);

      // Check the database to see if this order exists
      const existingRelation = await OrderRelation.findOne({
        parentOrderId: normalizedOrder.orderId
      });

      if (existingRelation) {
        // Check if we need to update or cancel
        const currentStatus = normalizedOrder.status?.toLowerCase() || '';
        const existingStatus = existingRelation.status?.toLowerCase() || '';

        console.log(`[DEBUG] Current status: ${currentStatus}, Existing status: ${existingStatus}`);

        // Check if order is cancelled
        if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
          console.log(`[COPY] Order ${normalizedOrder.orderId} has been cancelled, cancelling child orders`);
          await this.cancelChildOrders(normalizedOrder, childAccounts);
          return;
        }

        // Check for status changes
        if (currentStatus !== existingStatus) {
          console.log(`[COPY] Status change for existing order ${normalizedOrder.orderId}: ${existingStatus} -> ${currentStatus}`);

          if (currentStatus === 'complete') {
            // Just update the status for completed orders
            console.log(`[COPY] Marking order ${normalizedOrder.orderId} as complete in database`);
            existingRelation.status = 'COMPLETE';
            await existingRelation.save();
          } else {
            // For other status changes, update child orders
            await this.updateChildOrders(normalizedOrder, childAccounts);
          }
        } else {
          // Check for quantity/price changes
          const quantityChanged = existingRelation.quantity !== normalizedOrder.quantity;
          const priceChanged = Math.abs(existingRelation.price - normalizedOrder.price) > 0.01;

          if (quantityChanged || priceChanged) {
            console.log(`[COPY] Modification detected for order ${normalizedOrder.orderId}`);
            await this.updateChildOrders(normalizedOrder, childAccounts);
          } else {
            console.log(`[COPY] No significant changes for order ${normalizedOrder.orderId}, skipping update`);
          }
        }
      } else {
        // This is a new order - copy to children
        console.log(`[COPY] New order ${normalizedOrder.orderId} to copy`);
        await this.copyOrderToChildren(normalizedOrder, childAccounts);
      }

      // Mark as fully processed
      if (this.processedOrdersMap &&
        ['complete', 'cancelled', 'rejected'].includes(normalizedOrder.status?.toLowerCase())) {
        this.processedOrdersMap.set(processKey, Date.now());
      }
    } catch (error) {
      console.error('[COPY] Error handling parent order:', error);
    }
  }

  normalizeOrders(orders) {
    return orders.map(order => ({
      orderId: order.orderid,
      symbol: order.tradingsymbol,
      quantity: parseInt(order.quantity),
      transactionType: order.transactiontype,
      product: order.producttype,
      orderType: order.ordertype,
      status: order.orderstatus,
      price: parseFloat(order.averageprice || 0),
      timestamp: order.updatetime || order.exchtime
    }));
  }

  normalizePositions(positions) {
    return positions.map(pos => ({
      symbol: pos.tradingsymbol,
      quantity: parseInt(pos.netqty),
      averagePrice: parseFloat(pos.avgnetprice || pos.buyavgprice || 0),
      lastPrice: parseFloat(pos.ltp || 0),
      pnl: {
        realized: parseFloat(pos.realised || 0),
        unrealized: parseFloat(pos.unrealised || 0)
      }
    }));
  }

  broadcastToConnectedClients(data) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  removeClient(ws) {
    this.clients.delete(ws);
    this.lastHeartbeatResponses.delete(ws);

    if (this.clients.size === 0) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async handleCopyStatusChange({ accountId, enabled }) {
    try {
      const account = await Account.findById(accountId);
      if (!account) return;

      account.copyTradingEnabled = enabled;
      await account.save();

      this.broadcastToConnectedClients({
        type: 'status_update',
        data: {
          accountId,
          copyTradingEnabled: enabled
        }
      });
    } catch (error) {
      console.error('Error handling copy status change:', error);
    }
  }

  async handleAccountConnection({ childAccountId, parentAccountId }) {
    try {
      const childAccount = await Account.findById(childAccountId);
      const parentAccount = await Account.findById(parentAccountId);

      if (!childAccount || !parentAccount) {
        throw new Error('Invalid account IDs');
      }

      if (parentAccount.accountType !== 'PARENT') {
        throw new Error('Selected account is not a parent account');
      }

      childAccount.parentAccount = parentAccountId;
      await childAccount.save();

      this.broadcastToConnectedClients({
        type: 'account_connected',
        data: {
          childAccountId,
          parentAccountId
        }
      });
    } catch (error) {
      console.error('Error handling account connection:', error);
    }
  }

  async validateCopyTrade(orderData, childAccount) {
    console.log(`[VALIDATE] Validating trade for ${childAccount.clientCode}:`, JSON.stringify({
      symbol: orderData.symbol,
      quantity: orderData.quantity,
      price: orderData.price
    }));

    // Check for missing required data
    if (!orderData.price || isNaN(orderData.price)) {
      console.log(`[VALIDATE] Invalid price for validation: ${orderData.price}`);
      return {
        isValid: false,
        error: 'Invalid order price for position size calculation'
      };
    }

    if (!childAccount.balance || !childAccount.balance.net) {
      console.log(`[VALIDATE] Missing balance data for ${childAccount.clientCode}: ${JSON.stringify(childAccount.balance)}`);
      return {
        isValid: true, // Allow the trade but log the issue
        warning: 'Could not validate position size due to missing balance data'
      };
    }

    const positionValue = orderData.quantity * orderData.price;
    const accountValue = childAccount.balance.net;
    const positionSizePercent = (positionValue / accountValue) * 100;

    console.log(`[VALIDATE] Position calculation for ${childAccount.clientCode}: 
        - Position value: ${positionValue}
        - Account value: ${accountValue}
        - Position size %: ${positionSizePercent}%
        - Max allowed %: ${childAccount.settings?.maxPositionSize || 10}%`);

    if (positionSizePercent > (childAccount.settings?.maxPositionSize || 10)) {
      console.log(`[VALIDATE] Position size exceeds maximum allowed for ${childAccount.clientCode}`);
      return {
        isValid: false,
        error: `Position size (${positionSizePercent.toFixed(2)}%) exceeds maximum allowed (${childAccount.settings?.maxPositionSize || 10}%)`
      };
    }

    if (childAccount.settings?.allowedInstruments?.length > 0) {
      console.log(`[VALIDATE] Checking allowed instruments for ${childAccount.clientCode}: ${childAccount.settings.allowedInstruments.join(', ')}`);

      if (!childAccount.settings.allowedInstruments.includes(orderData.symbol)) {
        console.log(`[VALIDATE] Instrument ${orderData.symbol} not allowed for ${childAccount.clientCode}`);
        return {
          isValid: false,
          error: `Instrument ${orderData.symbol} not allowed for copying`
        };
      }
    }

    console.log(`[VALIDATE] Trade validation passed for ${childAccount.clientCode}`);
    return { isValid: true };
  }

  calculateChildPosition(parentQuantity, copyRatio, childBalance) {
    const rawQuantity = parentQuantity * copyRatio;
    return Math.floor(rawQuantity);
  }
}

export const wsService = new WebSocketService();
