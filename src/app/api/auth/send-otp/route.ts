import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { otpStore } from '@/lib/otp-store';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP (expires in 5 minutes)
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'chidakashaai@gmail.com',
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    // We will wrap sendMail in a try/catch but for development without a real password,
    // we can also just log it.
    if (!process.env.EMAIL_APP_PASSWORD) {
      console.warn(`[DEV MODE] No EMAIL_APP_PASSWORD found. The OTP for ${email} is: ${otp}`);
      // Return success anyway so UI works during development
      return NextResponse.json({ success: true, devMode: true, message: 'OTP logged to server console (App Password missing in .env.local)' });
    }

    const mailOptions = {
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
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
