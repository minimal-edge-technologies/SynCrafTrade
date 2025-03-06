// server/src/routes/accounts.js
import express from 'express';
import { accountController } from '../controllers/accountController.js';

const router = express.Router();

// Account management routes
router.post('/', accountController.addAccount);
router.get('/', accountController.getAccounts);
router.get('/:id', accountController.getAccount);
router.put('/:id', accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount);

export default router;