// server/src/controllers/accountController.js
import Account from '../models/Account.js';
import { angelOneService } from '../services/angelOneService.js';
import { encryptCredentials, decryptCredentials } from '../utils/encryption.js';
import { ACCOUNT_TYPES } from '../constants/accountTypes.js';

export const accountController = {
  async addAccount(req, res) {
    try {
      const { clientCode, password, totp, apiKey, accountType } = req.body;

      // Check if account already exists
      const existingAccount = await Account.findOne({ clientCode });
      if (existingAccount) {
        return res.status(400).json({
          success: false,
          error: 'Account already exists'
        });
      }

      // Initialize and validate with Angel One
      try {
        await angelOneService.init(apiKey);
      } catch (error) {
        console.error('API initialization failed:', error);
        return res.status(401).json({
          success: false,
          error: 'Failed to initialize API'
        });
      }

      // Validate credentials with Angel One
      const sessionResult = await angelOneService.generateSession(clientCode, password, totp);
      
      if (!sessionResult.success) {
        return res.status(401).json({
          success: false,
          error: sessionResult.error || 'Invalid credentials'
        });
      }

      // Get account balance
      const rmsData = await angelOneService.getRMS();

      // Encrypt sensitive data before storing
      const encryptedCreds = await encryptCredentials({ password, totp, apiKey });

      // Create new account
      const account = new Account({
        clientCode,
        name: sessionResult.data.name || clientCode,
        credentials: encryptedCreds,
        tokens: {
          jwtToken: sessionResult.data.jwtToken,
          refreshToken: sessionResult.data.refreshToken,
          feedToken: sessionResult.data.feedToken
        },
        accountType: accountType || ACCOUNT_TYPES.CHILD,
        status: 'ACTIVE',
        balance: {
          net: rmsData.data.net || 0,
          used: rmsData.data.utilized || 0,
          available: rmsData.data.total || 0
        },
        settings: {
          copyRatio: 1.0,
          maxPositionSize: 10,
          riskLimit: 2,
          allowedInstruments: []
        },
        lastSync: new Date()
      });

      await account.save();

      res.status(201).json({
        success: true,
        data: {
          _id: account._id,
          clientCode: account.clientCode,
          name: account.name,
          accountType: account.accountType,
          status: account.status,
          balance: account.balance,
          settings: account.settings,
          credentials: {
            apiKey: apiKey // Include unencrypted apiKey in response
          },
          tokens: {
            jwtToken: sessionResult.data.jwtToken,
            refreshToken: sessionResult.data.refreshToken,
            feedToken: sessionResult.data.feedToken
          },
          lastSync: account.lastSync,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt
        }
      });
    } catch (error) {
      console.error('Add account error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getAccounts(req, res) {
    try {
      const accounts = await Account.find({});
      const accountsWithDecryptedApiKey = await Promise.all(
        accounts.map(async (account) => {
          const decryptedCreds = await decryptCredentials(account.credentials);
          return {
            ...account.toObject(),
            credentials: {
              apiKey: decryptedCreds.apiKey
            }
          };
        })
      );

      res.json({
        success: true,
        data: accountsWithDecryptedApiKey
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getAccount(req, res) {
    try {
      const account = await Account.findById(req.params.id);
      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      const decryptedCreds = await decryptCredentials(account.credentials);
      const accountData = {
        ...account.toObject(),
        credentials: {
          apiKey: decryptedCreds.apiKey
        }
      };

      res.json({
        success: true,
        data: accountData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async updateAccount(req, res) {
    try {
      const { parentAccount, copyTradingEnabled, settings } = req.body;
      const account = await Account.findById(req.params.id);
      
      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }
  
      // Validate parent account connection
      if (parentAccount) {
        const parentAcc = await Account.findById(parentAccount);
        if (!parentAcc) {
          return res.status(400).json({
            success: false,
            error: 'Parent account not found'
          });
        }
        if (parentAcc.accountType !== 'PARENT') {
          return res.status(400).json({
            success: false,
            error: 'Selected account is not a parent account'
          });
        }
        account.parentAccount = parentAccount;
      }
  
      // Handle disconnection
      if (parentAccount === null) {
        account.parentAccount = null;
        account.copyTradingEnabled = false;
      }
  
      // Update copy trading status
      if (typeof copyTradingEnabled === 'boolean') {
        account.copyTradingEnabled = copyTradingEnabled;
      }
  
      // Update settings
      if (settings) {
        account.settings = {
          ...account.settings,
          ...settings
        };
      }
  
      await account.save();
      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async deleteAccount(req, res) {
    try {
      const account = await Account.findByIdAndDelete(req.params.id);
      
      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found'
        });
      }

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};