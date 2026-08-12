import { Router } from 'express';

import * as walletController from '../controllers/wallet.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { topupSchema, walletTransactionsQuerySchema } from '../validators/wallet.schema.js';

const router = Router();

router.use(auth);

router.get('/', walletController.getWallet);
router.get('/transactions', validate(walletTransactionsQuerySchema, 'query'), walletController.listTransactions);
router.post('/topup', validate(topupSchema), walletController.topup);

export default router;
