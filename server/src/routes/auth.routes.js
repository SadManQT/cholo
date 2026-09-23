import { Router } from 'express';

import * as authController from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.js';
import {
  authLimiter,
  loginLimiter,
  registerLimiter,
  resendOtpLimiter,
  verifyOtpLimiter,
} from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  verifyResetCodeSchema,
} from '../validators/auth.schema.js';

const router = Router();

router.use(authLimiter);

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/verify-otp', verifyOtpLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/resend-otp', resendOtpLimiter, validate(resendOtpSchema), authController.resendOtp);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/forgot-password', resendOtpLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/forgot-password/verify', verifyOtpLimiter, validate(verifyResetCodeSchema), authController.verifyResetCode);
router.post('/reset-password', verifyOtpLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/logout-all', auth, authController.logoutAll);

export default router;
