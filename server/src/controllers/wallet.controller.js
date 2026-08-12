import * as walletService from '../services/wallet.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getWallet = asyncHandler(async (request, response) => {
  const data = await walletService.getWallet(request.user.id);
  response.json({ success: true, data });
});

export const listTransactions = asyncHandler(async (request, response) => {
  const result = await walletService.listTransactions(request.user.id, request.query);
  response.json({ success: true, data: result.data, meta: result.meta });
});

export const topup = asyncHandler(async (request, response) => {
  const data = await walletService.initiateTopup(request.user.id, request.body);
  response.status(201).json({ success: true, data });
});
