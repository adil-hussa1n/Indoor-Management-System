import express from 'express';
import { initiatePayment, verifyBkashTrxid, sslcommerzSuccess, sslcommerzFail, sslcommerzCancel, bkashCallback } from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/payment/initiate', initiatePayment);
router.post('/payment/verify-bkash-trxid', verifyBkashTrxid);
router.all('/payment/bkash/callback', bkashCallback);
router.all('/payment/sslcommerz/success', sslcommerzSuccess);
router.all('/payment/sslcommerz/fail', sslcommerzFail);
router.all('/payment/sslcommerz/cancel', sslcommerzCancel);

export default router;
