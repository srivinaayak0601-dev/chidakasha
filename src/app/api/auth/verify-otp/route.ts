import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const SECRET = process.env.OTP_SECRET || 'chidakasha-dev-secret-key';

function verifyOtpToken(token: string, email: string, otp: string): { valid: boolean; expired: boolean } {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return { valid: false, expired: false };

    const [tokenEmail, tokenOtp, expiresAtStr, sig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    const payload = `${tokenEmail}:${tokenOtp}:${expiresAtStr}`;
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');

    if (sig !== expectedSig) return { valid: false, expired: false };
    if (Date.now() > expiresAt) return { valid: false, expired: true };
    if (tokenEmail !== email || tokenOtp !== otp) return { valid: false, expired: false };

    return { valid: true, expired: false };
  } catch {
    return { valid: false, expired: false };
  }
}

export async function POST(request: Request) {
  try {
    const { email, otp, token } = await request.json();

    if (!email || !otp || !token) {
      return NextResponse.json({ error: 'Email, OTP, and token are required' }, { status: 400 });
    }

    const result = verifyOtpToken(token, email, otp);

    if (result.expired) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
