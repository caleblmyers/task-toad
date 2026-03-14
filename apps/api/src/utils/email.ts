import nodemailer from 'nodemailer';
import { createChildLogger } from './logger.js';

const log = createChildLogger('email');
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;

  if (!smtpHost) {
    // Extract link from text for clean console output
    const linkMatch = text.match(/https?:\/\/\S+/);
    const link = linkMatch ? linkMatch[0] : '';
    log.info({ to, subject, link }, 'DEV EMAIL');
    return;
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@tasktoad.app',
    to,
    subject,
    text,
    html,
  });
}

export function verifyEmailText(token: string): string {
  return `Verify your TaskToad email by clicking this link:\n\n${APP_URL}/verify-email?token=${token}\n\nThis link does not expire.`;
}

export function resetPasswordText(token: string): string {
  return `Reset your TaskToad password by clicking this link:\n\n${APP_URL}/reset-password?token=${token}\n\nThis link expires in 1 hour.`;
}

export function inviteText(orgName: string, token: string): string {
  return `You've been invited to join ${orgName} on TaskToad.\n\nAccept the invite here:\n\n${APP_URL}/invite/accept?token=${token}\n\nThis invite expires in 48 hours.`;
}
