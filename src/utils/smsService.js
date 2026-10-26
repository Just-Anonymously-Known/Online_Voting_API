
const getTermiiConfig = () => {
  const apiKey = process.env.TERMII_API_KEY;
  const baseUrl = process.env.TERMII_BASE_URL;

  if (!apiKey || !baseUrl) {
    throw new Error('Termii credentials are not configured');
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, '')
  };
};

const sendPhoneVerificationCode = async (phone) => {
  const { apiKey, baseUrl } = getTermiiConfig();

  if (typeof phone !== 'string' || !phone.trim()) {
    throw new Error('A phone number is required');
  }

  // Convert a number such as +234 801 234 5678
  // to the international format expected by Termii.
  const normalizedPhone = phone.replace(/[\s()+-]/g, '');

  if (!/^234\d{10}$/.test(normalizedPhone)) {
    throw new Error(
      'Enter a valid Nigerian number in international format, e.g. +2348012345678'
    );
  }

  const response = await fetch(
    `${baseUrl}/api/sms/otp/send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        message_type: 'NUMERIC',
        to: normalizedPhone,
        from: 'Termii',
        channel: 'generic',
        pin_type: 'NUMERIC',
        pin_attempts: 3,
        pin_time_to_live: 10,
        pin_length: 6,
        pin_placeholder: '< 123456 >',
        message_text:
          'Your BallotTrust verification code is < 123456 >. It expires in 10 minutes.'
      })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.status === 'error') {
    throw new Error(
      result.message || 'Failed to send phone verification code'
    );
  }

  if (!result.pinId && !result.pin_id) {
    throw new Error(
      'Termii did not return a verification request ID'
    );
  }

  return {
    pinId: result.pinId || result.pin_id,
    response: result
  };
};

const verifyPhoneVerificationCode = async (pinId, code) => {
  const { apiKey, baseUrl } = getTermiiConfig();

  if (typeof pinId !== 'string' || !pinId.trim()) {
    throw new Error('A verification request ID is required');
  }

  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new Error('Enter the six-digit verification code');
  }

  const response = await fetch(
    `${baseUrl}/api/sms/otp/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        pin_id: pinId,
        pin: code
      })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.status === 'error') {
    throw new Error(
      result.message || 'Phone verification failed'
    );
  }

  return result;
};

module.exports = {
  sendPhoneVerificationCode,
  verifyPhoneVerificationCode
};
