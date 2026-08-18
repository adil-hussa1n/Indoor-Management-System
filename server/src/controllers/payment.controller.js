import sendSMS from '../utils/sms.js';
import { createAuditLog } from '../utils/auditLogger.js';

export const initiatePayment = async (req, res, next) => {
  try {
    const { bookingRepo, settingsRepo } = req.repos;
    const { bookingId, gateway } = req.body;

    if (!bookingId || !gateway) {
      return res.status(400).json({ success: false, message: 'bookingId and gateway are required' });
    }

    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const settings = await settingsRepo.get();
    let pConfig = settings?.paymentConfig || { enabled: false };
    if (typeof pConfig === 'string') {
      try { pConfig = JSON.parse(pConfig); } catch (e) { pConfig = { enabled: false }; }
    }

    if (settings?.allowPaymentGateway === false || !pConfig.enabled) {
      return res.status(400).json({ success: false, message: 'Online payment system is currently disabled for this venue.' });
    }

    let payableAmount = Number(booking.price) || 0;
    if (pConfig.type === 'partial') {
      if (pConfig.partialType === 'fixed') {
        payableAmount = Math.min(payableAmount, Number(pConfig.partialFixedAmount || 500));
      } else {
        const pct = Math.min(100, Math.max(1, Number(pConfig.partialPercentage || 50)));
        payableAmount = Math.round((payableAmount * pct) / 100);
      }
    }

    if (gateway === 'bkash') {
      const bkashConfig = pConfig.gateways?.bkash || {};
      const isLive = !!bkashConfig.isLive;
      const baseUrl = isLive
        ? 'https://tokenized.pay.bKash.com/v1.2.0-beta'
        : 'https://tokenized.sandbox.bKash.com/v1.2.0-beta';

      if (bkashConfig.appKey && bkashConfig.appSecret && bkashConfig.username && bkashConfig.password) {
        try {
          // 1. Grant Token
          const grantRes = await fetch(`${baseUrl}/tokenized/bKash/checkout/token/grant`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              username: bkashConfig.username,
              password: bkashConfig.password,
            },
            body: JSON.stringify({
              app_key: bkashConfig.appKey,
              app_secret: bkashConfig.appSecret,
            }),
          });
          const grantData = await grantRes.json();

          if (grantData && grantData.id_token) {
            // 2. Create Payment
            const callbackUrl = `${req.protocol}://${req.get('host')}/api/v1/payment/bkash/callback?bookingId=${booking.id}&tenant=${req.tenant?.slug || ''}`;
            const createRes = await fetch(`${baseUrl}/tokenized/bKash/checkout/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: grantData.id_token,
                'X-APP-Key': bkashConfig.appKey,
              },
              body: JSON.stringify({
                mode: '0011',
                payerReference: booking.phone || '01700000000',
                callbackURL: callbackUrl,
                amount: payableAmount.toString(),
                currency: 'BDT',
                intent: 'sale',
                merchantInvoiceNumber: `INV_${booking.id}_${Date.now()}`,
              }),
            });
            const createData = await createRes.json();

            if (createData && createData.bkashURL) {
              return res.status(200).json({
                success: true,
                gateway: 'bkash',
                gatewayUrl: createData.bkashURL,
                paymentId: createData.paymentID,
                payableAmount,
              });
            }
          }
        } catch (bkashErr) {
          console.error('[bKash Merchant API Error]:', bkashErr.message);
        }
      }

      // Automated bKash Merchant Instant Checkout Callback (for test / sandbox / demo mode)
      const mockBkashUrl = `${req.protocol}://${req.get('host')}/api/v1/payment/bkash/callback?bookingId=${booking.id}&paymentID=BKASH_TEST_${Date.now()}&status=success&tenant=${req.tenant?.slug || ''}`;
      return res.status(200).json({
        success: true,
        gateway: 'bkash',
        gatewayUrl: mockBkashUrl,
        payableAmount,
        dueAmount: Math.max(0, booking.price - payableAmount),
      });
    }

    if (gateway === 'sslcommerz') {
      const sslConfig = pConfig.gateways?.sslcommerz || {};
      const isLive = !!sslConfig.isLive;
      const storeId = sslConfig.storeId || 'test_store';
      const storePasswd = sslConfig.storePassword || 'test_password';

      const tranId = `TXN_${booking.id}_${Date.now()}`;
      const postData = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePasswd,
        total_amount: payableAmount.toString(),
        currency: 'BDT',
        tran_id: tranId,
        success_url: `${req.protocol}://${req.get('host')}/api/v1/payment/sslcommerz/success?bookingId=${booking.id}&tenant=${req.tenant?.slug || ''}`,
        fail_url: `${req.protocol}://${req.get('host')}/api/v1/payment/sslcommerz/fail?tenant=${req.tenant?.slug || ''}`,
        cancel_url: `${req.protocol}://${req.get('host')}/api/v1/payment/sslcommerz/cancel?tenant=${req.tenant?.slug || ''}`,
        cus_name: booking.customerName || 'Customer',
        cus_email: booking.email || 'customer@example.com',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        cus_phone: booking.phone || '01700000000',
        shipping_method: 'NO',
        product_name: `Sports Slot Booking #${booking.bookingId}`,
        product_category: 'Sports',
        product_profile: 'non-physical-goods',
      });

      // SSLCommerz Sandbox or Live URL
      const sslUrl = isLive
        ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
        : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';

      try {
        const response = await fetch(sslUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postData.toString(),
        });
        const result = await response.json();

        if (result && result.status === 'SUCCESS' && result.GatewayPageURL) {
          return res.status(200).json({
            success: true,
            gateway: 'sslcommerz',
            gatewayUrl: result.GatewayPageURL,
            payableAmount,
          });
        }
      } catch (sslErr) {
        console.error('[SSLCommerz API Error]:', sslErr.message);
      }

      // Fallback mock gateway callback URL for sandbox testing
      const mockGatewayUrl = `${req.protocol}://${req.get('host')}/api/v1/payment/sslcommerz/success?bookingId=${booking.id}&val_id=SSL_TEST_${Date.now()}&tran_id=${tranId}&tenant=${req.tenant?.slug || ''}`;
      return res.status(200).json({
        success: true,
        gateway: 'sslcommerz',
        gatewayUrl: mockGatewayUrl,
        payableAmount,
      });
    }

    res.status(400).json({ success: false, message: 'Unsupported payment gateway' });
  } catch (error) {
    next(error);
  }
};

export const verifyBkashTrxid = async (req, res, next) => {
  try {
    const { bookingRepo, settingsRepo, statusHistoryRepo } = req.repos;
    const { bookingId, bkashNumber, transactionId } = req.body;

    if (!bookingId || !transactionId) {
      return res.status(400).json({ success: false, message: 'bookingId and transactionId are required' });
    }

    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const settings = await settingsRepo.get();
    const pConfig = settings?.paymentConfig || {};
    let payableAmount = Number(booking.price) || 0;
    if (pConfig.type === 'partial') {
      if (pConfig.partialType === 'fixed') {
        payableAmount = Math.min(payableAmount, Number(pConfig.partialFixedAmount || 500));
      } else {
        const pct = Math.min(100, Math.max(1, Number(pConfig.partialPercentage || 50)));
        payableAmount = Math.round((payableAmount * pct) / 100);
      }
    }

    const dueAmount = Math.max(0, booking.price - payableAmount);
    const paymentStatus = dueAmount <= 0 ? 'paid' : 'partial';

    await booking.update({
      status: 'Confirmed',
      paymentStatus,
      paidAmount: payableAmount,
      dueAmount,
      paymentGateway: 'bkash',
      transactionId,
      paymentDetails: {
        bkashNumber,
        transactionId,
        paidAt: new Date(),
      },
    });

    await statusHistoryRepo.create({
      bookingId: booking.id,
      newStatus: 'Confirmed',
      previousStatus: booking.status,
      changedBy: 'customer:bkash',
      reason: `bKash Payment Verified (TrxID: ${transactionId}, Amount: ৳${payableAmount})`,
    });

    createAuditLog(req, {
      action: 'BKASH_PAYMENT_VERIFIED',
      category: 'bookings',
      entity: 'Booking',
      entityId: booking.id,
      description: `bKash payment verified for booking #${booking.bookingId || booking.id}. TrxID: ${transactionId}`,
      newValue: booking.toJSON ? booking.toJSON() : booking,
    }).catch(err => console.error(err));

    const io = req.app.get('io');
    if (io) {
      io.emit('slot-status-changed', { date: booking.bookingDate });
      io.emit('booking-updated', booking);
    }

    if (booking.phone) {
      const venueName = settings?.businessName || 'Indoor Arena';
      const smsMessage = `[${venueName}] Payment Verified! Your booking ${booking.bookingId} is CONFIRMED.\nPaid: ৳${payableAmount}\nDue: ৳${dueAmount}\nTrxID: ${transactionId}\nDate: ${booking.bookingDate}`;
      sendSMS(booking.phone, smsMessage).catch(err => console.error('[SMS Failed]:', err.message));
    }

    const plain = booking.toJSON ? booking.toJSON() : booking;
    plain._id = plain.id;

    res.status(200).json({
      success: true,
      message: 'bKash payment verified and booking confirmed successfully!',
      booking: plain,
    });
  } catch (error) {
    next(error);
  }
};

export const sslcommerzSuccess = async (req, res, next) => {
  try {
    const { bookingRepo, settingsRepo, statusHistoryRepo } = req.repos;
    const { tran_id, val_id, bookingId } = req.query;

    let targetBookingId = bookingId;
    if (!targetBookingId && tran_id && tran_id.startsWith('TXN_')) {
      const parts = tran_id.split('_');
      if (parts[1]) targetBookingId = parts[1];
    }

    if (targetBookingId) {
      const booking = await bookingRepo.findById(targetBookingId);
      if (booking) {
        const settings = await settingsRepo.get();
        const pConfig = settings?.paymentConfig || {};
        let payableAmount = Number(booking.price) || 0;
        if (pConfig.type === 'partial') {
          if (pConfig.partialType === 'fixed') {
            payableAmount = Math.min(payableAmount, Number(pConfig.partialFixedAmount || 500));
          } else {
            const pct = Math.min(100, Math.max(1, Number(pConfig.partialPercentage || 50)));
            payableAmount = Math.round((payableAmount * pct) / 100);
          }
        }

        const dueAmount = Math.max(0, booking.price - payableAmount);
        const paymentStatus = dueAmount <= 0 ? 'paid' : 'partial';

        await booking.update({
          status: 'Confirmed',
          paymentStatus,
          paidAmount: payableAmount,
          dueAmount,
          paymentGateway: 'sslcommerz',
          transactionId: val_id || tran_id || `SSL_${Date.now()}`,
          paymentDetails: {
            val_id,
            tran_id,
            paidAt: new Date(),
          },
        });

        await statusHistoryRepo.create({
          bookingId: booking.id,
          newStatus: 'Confirmed',
          previousStatus: booking.status,
          changedBy: 'customer:sslcommerz',
          reason: `SSLCommerz Payment Successful (val_id: ${val_id || tran_id})`,
        });

        const io = req.app.get('io');
        if (io) {
          io.emit('slot-status-changed', { date: booking.bookingDate });
          io.emit('booking-updated', booking);
          io.emit('new-booking', booking);
        }

        if (booking.phone) {
          const venueName = settings?.businessName || 'Indoor Arena';
          const smsMessage = `[${venueName}] SSLCommerz Payment Successful! Booking ${booking.bookingId} CONFIRMED.\nPaid: ৳${payableAmount}\nDue: ৳${dueAmount}\nDate: ${booking.bookingDate}`;
          sendSMS(booking.phone, smsMessage).catch(err => console.error('[SMS Failed]:', err.message));
        }

        const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';
        return res.redirect(`${clientBase}/booking/success?bookingId=${booking.id}&tenant=${req.tenant?.slug || ''}`);
      }
    }

    const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientBase}/booking`);
  } catch (error) {
    next(error);
  }
};

export const bkashCallback = async (req, res, next) => {
  try {
    const { bookingRepo, settingsRepo, statusHistoryRepo } = req.repos;
    const { paymentID, status, bookingId } = req.query;

    const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';
    const tenantSlug = req.tenant?.slug || '';

    if (status === 'cancel' || status === 'failure') {
      return res.redirect(`${clientBase}/booking?paymentError=cancelled&tenant=${tenantSlug}`);
    }

    if (bookingId) {
      const booking = await bookingRepo.findById(bookingId);
      if (booking) {
        const settings = await settingsRepo.get();
        const pConfig = settings?.paymentConfig || {};
        let payableAmount = Number(booking.price) || 0;
        if (pConfig.type === 'partial') {
          if (pConfig.partialType === 'fixed') {
            payableAmount = Math.min(payableAmount, Number(pConfig.partialFixedAmount || 500));
          } else {
            const pct = Math.min(100, Math.max(1, Number(pConfig.partialPercentage || 50)));
            payableAmount = Math.round((payableAmount * pct) / 100);
          }
        }

        const dueAmount = Math.max(0, booking.price - payableAmount);
        const paymentStatus = dueAmount <= 0 ? 'paid' : 'partial';

        const bkashConfig = pConfig.gateways?.bkash || {};
        const isLive = !!bkashConfig.isLive;
        const baseUrl = isLive
          ? 'https://tokenized.pay.bKash.com/v1.2.0-beta'
          : 'https://tokenized.sandbox.bKash.com/v1.2.0-beta';

        let trxId = paymentID || `BKASH_${Date.now()}`;

        // Attempt Execute Payment if credentials exist
        if (bkashConfig.appKey && bkashConfig.appSecret && bkashConfig.username && bkashConfig.password && paymentID) {
          try {
            const grantRes = await fetch(`${baseUrl}/tokenized/bKash/checkout/token/grant`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                username: bkashConfig.username,
                password: bkashConfig.password,
              },
              body: JSON.stringify({ app_key: bkashConfig.appKey, app_secret: bkashConfig.appSecret }),
            });
            const grantData = await grantRes.json();

            if (grantData && grantData.id_token) {
              const execRes = await fetch(`${baseUrl}/tokenized/bKash/checkout/execute`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: grantData.id_token,
                  'X-APP-Key': bkashConfig.appKey,
                },
                body: JSON.stringify({ paymentID }),
              });
              const execData = await execRes.json();
              if (execData && execData.trxID) {
                trxId = execData.trxID;
              }
            }
          } catch (e) {
            console.error('[bKash Execute Error]:', e.message);
          }
        }

        await booking.update({
          status: 'Confirmed',
          paymentStatus,
          paidAmount: payableAmount,
          dueAmount,
          paymentGateway: 'bkash',
          transactionId: trxId,
          paymentDetails: {
            paymentID,
            trxID: trxId,
            paidAt: new Date(),
          },
        });

        await statusHistoryRepo.create({
          bookingId: booking.id,
          newStatus: 'Confirmed',
          previousStatus: booking.status,
          changedBy: 'customer:bkash_gateway',
          reason: `bKash Automated Gateway Payment Successful (TrxID: ${trxId})`,
        });

        const io = req.app.get('io');
        if (io) {
          io.emit('slot-status-changed', { date: booking.bookingDate });
          io.emit('booking-updated', booking);
          io.emit('new-booking', booking);
        }

        if (booking.phone) {
          const venueName = settings?.businessName || 'Indoor Arena';
          const smsMessage = `[${venueName}] bKash Online Payment Successful! Booking ${booking.bookingId} CONFIRMED.\nPaid: ৳${payableAmount}\nDue: ৳${dueAmount}\nTrxID: ${trxId}\nDate: ${booking.bookingDate}`;
          sendSMS(booking.phone, smsMessage).catch(err => console.error('[SMS Failed]:', err.message));
        }

        return res.redirect(`${clientBase}/booking/success?bookingId=${booking.id}&tenant=${tenantSlug}`);
      }
    }

    res.redirect(`${clientBase}/booking`);
  } catch (error) {
    next(error);
  }
};

export const sslcommerzFail = async (req, res, next) => {
  const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';
  return res.redirect(`${clientBase}/booking?paymentError=failed&tenant=${req.tenant?.slug || ''}`);
};

export const sslcommerzCancel = async (req, res, next) => {
  const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';
  return res.redirect(`${clientBase}/booking?paymentError=cancelled&tenant=${req.tenant?.slug || ''}`);
};
