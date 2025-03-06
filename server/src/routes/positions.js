// server/src/routes/positions.js
import express from 'express';
import { angelOneService } from '../services/angelOneService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const positions = await angelOneService.getPositions(req.token);
    res.json({
      success: true,
      data: positions || []
    });
  } catch (error) {
    console.error('Position fetch error:', error);
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
});

export default router;