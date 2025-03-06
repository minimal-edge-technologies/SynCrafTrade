// server/src/routes/orders.js
import express from 'express';
import { angelOneService } from '../services/angelOneService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const orders = await angelOneService.getOrderBook(req.token);
    res.json({
      success: true,
      data: orders || []
    });
  } catch (error) {
    console.error('Order fetch error:', error);
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

export default router;