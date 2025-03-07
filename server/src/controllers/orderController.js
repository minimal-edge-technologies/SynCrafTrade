// server/src/controllers/orderController.js
import OrderRelation from '../models/OrderRelation.js';

export const orderController = {
  async getCopyTradeHistory(req, res) {
    try {
      const { accountId, type } = req.query;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          error: 'Account ID is required'
        });
      }
      
      let query = {};
      
      // For a parent account, show all orders copied from it
      if (type === 'parent') {
        query.parentAccountId = accountId;
      } 
      // For a child account, show all orders copied to it
      else if (type === 'child') {
        query.childAccountId = accountId;
      }
      // If no type specified, check both directions
      else {
        query = {
          $or: [
            { parentAccountId: accountId },
            { childAccountId: accountId }
          ]
        };
      }
      
      const relations = await OrderRelation.find(query)
        .sort({ createdAt: -1 })
        .limit(100);
      
      res.json({
        success: true,
        data: relations
      });
    } catch (error) {
      console.error('Error fetching copy trade history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};