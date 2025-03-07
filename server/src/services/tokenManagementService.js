// server/src/services/tokenManagementService.js

import Account from '../models/Account.js';
import { angelOneService } from './angelOneService.js';

class TokenManagementService {
  constructor() {
    this.refreshInterval = null;
  }
  
  initialize() {
    // Check tokens every hour
    this.refreshInterval = setInterval(() => this.refreshAllTokens(), 60 * 60 * 1000);
    console.log('Token management service initialized');
    
    // Also do an initial check on startup
    this.refreshAllTokens();
  }
  
  async refreshAllTokens() {
    try {
      console.log('[TOKEN] Starting scheduled token refresh check');
      
      // Find accounts with tokens older than 20 hours
      const tokenExpiryThreshold = new Date();
      tokenExpiryThreshold.setHours(tokenExpiryThreshold.getHours() - 20);
      
      const accounts = await Account.find({
        $or: [
          { 'tokens.issuedAt': { $lt: tokenExpiryThreshold } },
          { 'tokens.issuedAt': { $exists: false } }
        ],
        'tokens.refreshToken': { $exists: true }
      });
      
      console.log(`[TOKEN] Found ${accounts.length} accounts needing token refresh`);
      
      for (const account of accounts) {
        try {
          // Try refresh token
          if (account.tokens?.refreshToken) {
            console.log(`[TOKEN] Attempting refresh token for ${account.clientCode}`);
            
            try {
              const refreshResult = await angelOneService.refreshSession(account.tokens.refreshToken);
              
              if (refreshResult.success) {
                await Account.findByIdAndUpdate(account._id, {
                  tokens: {
                    jwtToken: refreshResult.data.jwtToken,
                    refreshToken: refreshResult.data.refreshToken || account.tokens.refreshToken,
                    feedToken: refreshResult.data.feedToken || account.tokens.feedToken,
                    issuedAt: new Date()
                  },
                  lastSync: new Date(),
                  authStatus: 'ACTIVE'
                });
                
                console.log(`[TOKEN] Successfully refreshed token for ${account.clientCode}`);
                continue; // Skip to next account if successful
              }
            } catch (refreshError) {
              console.error(`[TOKEN] Refresh token failed for ${account.clientCode}:`, refreshError);
            }
          }
          
          // If we get here, refresh token failed - mark account as needing authentication
          await Account.findByIdAndUpdate(account._id, {
            authStatus: 'REQUIRES_AUTH',
            lastSync: new Date()
          });
          
          console.log(`[TOKEN] Account ${account.clientCode} marked as requiring authentication`);
          
        } catch (accountError) {
          console.error(`[TOKEN] Error refreshing token for account ${account.clientCode}:`, accountError);
        }
      }
    } catch (error) {
      console.error('[TOKEN] Error in refreshAllTokens:', error);
    }
  }
  
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export const tokenManagementService = new TokenManagementService();