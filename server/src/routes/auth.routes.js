import { Router } from 'express';

import * as authController from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.js';
import { authLimiter, loginLimiter, registerLimiter, verifyOtpLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema, verifyOtpSchema } from '../validators/auth.schema.js';

const router = Router();

// Coarse per-route-file safety net first, then endpoint-specific limits
// tuned to each one's actual abuse risk (doc 10 §11).
router.use(authLimiter);

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/verify-otp', verifyOtpLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/logout-all', auth, authController.logoutAll);

export default router;
