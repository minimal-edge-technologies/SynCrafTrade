// server/src/middleware/auth.js
import { angelOneService } from '../services/angelOneService.js';
import Account from '../models/Account.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const token = authHeader.split(' ')[1];
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    try {
      // Initialize API if needed
      if (!angelOneService.api) {
        await angelOneService.init(apiKey);
      }

      // Set the token for Angel One service
      angelOneService.api.setAccessToken(token);
      
      // Store token and API key in request for later use
      req.token = token;
      req.apiKey = apiKey;
      
      next();
    } catch (error) {
      console.error('Token validation failed:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};