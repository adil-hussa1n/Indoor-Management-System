// Using native global fetch


/**
 * Send SMS OTP via Bangladesh SMS API (BulkSMSBD or SSLWireless).
 * Defaults to logging to console in development mode or if credentials are missing.
 *
 * @param {string} phone - Recipient phone number (e.g., "+8801712345678" or "01712345678")
 * @param {string} message - Message content containing the OTP code
 * @param {Object} [customCredentials] - Optional per-tenant SMS credentials
 */
export const sendSMS = async (phone, message, customCredentials = null) => {
  try {
    const provider = customCredentials?.provider || process.env.SMS_PROVIDER || 'mock';
    const apiKey = customCredentials?.apiKey || process.env.SMS_API_KEY;
    const senderId = customCredentials?.senderId || process.env.SMS_SENDER_ID;
    const username = customCredentials?.username || process.env.SMS_USERNAME;
    const password = customCredentials?.password || process.env.SMS_PASSWORD;

    // Normalize phone number format (ensure it starts with 880 for BD numbers if needed)
    let cleanPhone = phone.replace(/[^\d+]/g, ''); // remove non-digits
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '88' + cleanPhone;
    } else if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }

    console.log(`[SMS] Sending via provider: ${provider} to ${cleanPhone}`);

    if (provider === 'mock' || process.env.NODE_ENV !== 'production' || !apiKey) {
      console.log(`\n========================================`);
      console.log(`[SMS MOCK] To: ${cleanPhone}`);
      console.log(`[SMS MOCK] Message: ${message}`);
      console.log(`========================================\n`);
      return { success: true, provider: 'mock' };
    }

    if (provider === 'bulksmsbd') {
      // BulkSMSBD API
      const url = `https://bulksmsbd.net/api/smsapi?api_key=${encodeURIComponent(apiKey)}&type=text&number=${encodeURIComponent(cleanPhone)}&senderid=${encodeURIComponent(senderId || '')}&message=${encodeURIComponent(message)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.response_code === 202) {
        console.log(`[SMS] Sent successfully via BulkSMSBD`);
        return { success: true, messageId: data.success_id };
      } else {
        throw new Error(data.success_message || 'BulkSMSBD returned error code ' + data.response_code);
      }
    }

    if (provider === 'sslwireless') {
      // SSLWireless API (Simple HTTP GET API)
      const sid = senderId || '';
      const url = `https://sms.sslwireless.com/pushapi/dynamic/server.php?user=${encodeURIComponent(username || '')}&pass=${encodeURIComponent(password || '')}&sid=${encodeURIComponent(sid)}&sms[0][0]=${encodeURIComponent(cleanPhone)}&sms[0][1]=${encodeURIComponent(message)}&asmskey=${encodeURIComponent(apiKey || '')}`;
      
      const res = await fetch(url);
      const text = await res.text();
      
      // Parse simple xml/plain text response if needed, SSL wireless usually returns an XML string
      if (text.includes('<PARAMETER>100</PARAMETER>') || text.includes('100')) {
        console.log(`[SMS] Sent successfully via SSLWireless`);
        return { success: true };
      } else {
        throw new Error(`SSLWireless response error: ${text}`);
      }
    }

    throw new Error(`Unsupported SMS provider: ${provider}`);
  } catch (error) {
    console.error(`[SMS ERROR] Failed to send SMS:`, error.message);
    return { success: false, error: error.message };
  }
};

export default sendSMS;
