// server/src/routes/auth.js
import express from 'express';
import { angelOneService } from '../services/angelOneService.js';
import Account from '../models/Account.js';
import { decryptCredentials } from '../utils/encryption.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    console.log('Server: Received login request');
    const { clientCode, password, totp, apiKey } = req.body;
    
    if (!clientCode || !password || !totp || !apiKey) {
      console.log('Server: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    console.log('Login attempt for client:', clientCode);

    // Initialize API
    try {
      console.log('Server: Initializing Angel One API');
      await angelOneService.init(apiKey);
    } catch (error) {
      console.error('API initialization failed:', error);
      return res.status(401).json({
        success: false,
        error: 'Failed to initialize API'
      });
    }

    // Generate session
    console.log('Server: Generating session');
    const result = await angelOneService.generateSession(clientCode, password, totp);

    if (!result.success) {
      console.log('Server: Session generation failed:', result.error);
      return res.status(401).json(result);
    }

    // Get account balance
    console.log('Server: Getting RMS data');
    const rmsData = await angelOneService.getRMS();
    
    console.log('Server: Login successful, sending response');
    res.json({
      success: true,
      data: {
        profile: {
          clientCode,
          name: result.data.name || clientCode, // Use name from Angel One response if available
          email: result.data.email,
          // Add other profile fields as needed
        },
        tokens: {
          jwtToken: result.data.jwtToken,
          feedToken: result.data.feedToken,
          refreshToken: result.data.refreshToken
        },
        balance: rmsData.data
      }
    });

  } catch (error) {
    console.error('Server: Login failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    const result = await angelOneService.refreshSession(refreshToken);
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/reauthenticate', async (req, res) => {
  try {
    const { accountId, password, totp } = req.body;
    
    if (!accountId || !password || !totp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    // Find the account
    const account = await Account.findById(accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Get API key from stored credentials
    const decryptedCreds = await decryptCredentials(account.credentials);
    const apiKey = decryptedCreds.apiKey;
    
    // Initialize API
    try {
      console.log('Server: Initializing Angel One API');
      await angelOneService.init(apiKey);
    } catch (error) {
      console.error('API initialization failed:', error);
      return res.status(401).json({
        success: false,
        error: 'Failed to initialize API'
      });
    }
    
    // Generate new session
    console.log(`Re-authenticating account ${account.clientCode}`);
    const result = await angelOneService.generateSession(account.clientCode, password, totp);
    
    if (!result.success) {
      console.log('Re-authentication failed:', result.error);
      return res.status(401).json(result);
    }
    
    // Update account with new tokens
    await Account.findByIdAndUpdate(accountId, {
      tokens: {
        jwtToken: result.data.jwtToken,
        refreshToken: result.data.refreshToken,
        feedToken: result.data.feedToken,
        issuedAt: new Date()
      },
      authStatus: 'ACTIVE',
      lastSync: new Date()
    });
    
    console.log(`Re-authentication successful for ${account.clientCode}`);
    res.json({
      success: true,
      data: {
        tokens: {
          jwtToken: result.data.jwtToken,
          refreshToken: result.data.refreshToken,
          feedToken: result.data.feedToken
        }
      }
    });
    
  } catch (error) {
    console.error('Re-authentication error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;