import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createHmac } from 'crypto';

const SECRET = process.env.OTP_SECRET || 'chidakasha-dev-secret-key';

function signOtpToken(email: string, otp: string, expiresAt: number): string {
  const payload = `${email}:${otp}:${expiresAt}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Create a signed token (no database needed)
    const token = signOtpToken(email, otp, expiresAt);

    if (!process.env.EMAIL_APP_PASSWORD) {
      console.warn(`[DEV MODE] OTP for ${email}: ${otp}`);
      return NextResponse.json({ success: true, token, devMode: true });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // use STARTTLS
      auth: {
        user: process.env.EMAIL_USER || 'chidakashaai@gmail.com',
        pass: process.env.EMAIL_APP_PASSWORD,
      },
      connectionTimeout: 8000,  // 8s connection timeout
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'chidakashaai@gmail.com',
      to: email,
      subject: 'Your Chidakasha Verification Code',
      text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Welcome to Chidakasha</h2>
          <p>Your verification code is:</p>
          <h1 style="color: #4f46e5; letter-spacing: 5px;">${otp}</h1>
          <p>This code will expire in 5 minutes.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
