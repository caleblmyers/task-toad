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

  const RETRY_DELAYS = [1_000, 5_000, 15_000];
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await transport.sendMail({
        from: process.env.EMAIL_FROM ?? 'noreply@tasktoad.app',
        to,
        subject,
        text,
        html,
      });
      return;
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS[attempt - 1] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1];
        log.warn({ to, subject, attempt, err }, `Email send failed, retrying in ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        log.error({ to, subject, attempt, err }, 'Email send failed after all retries — dropping');
      }
    }
  }
}

// ── Plain-text templates ──

export function verifyEmailText(token: string): string {
  return `Verify your TaskToad email by clicking this link:\n\n${APP_URL}/verify-email?token=${token}\n\nThis link does not expire.`;
}

export function resetPasswordText(token: string): string {
  return `Reset your TaskToad password by clicking this link:\n\n${APP_URL}/reset-password?token=${token}\n\nThis link expires in 1 hour.`;
}

export function inviteText(orgName: string, token: string): string {
  return `You've been invited to join ${orgName} on TaskToad.\n\nAccept the invite here:\n\n${APP_URL}/invite/accept?token=${token}\n\nThis invite expires in 48 hours.`;
}

// ── HTML email templates ──

function buildEmailBase(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background-color:#1e293b;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">TaskToad</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#334155;font-size:18px;font-weight:600;">${title}</h2>
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
              TaskToad &mdash; Project Management Made Simple
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:#1e40af;border-radius:6px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function buildVerifyEmailHtml(token: string): string {
  const url = `${APP_URL}/verify-email?token=${token}`;
  return buildEmailBase('Verify Your Email', `
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
      Thanks for signing up for TaskToad! Please verify your email address to get started.
    </p>
    ${ctaButton(url, 'Verify Email')}
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${url}" style="color:#1e40af;word-break:break-all;">${url}</a>
    </p>
  `);
}

export function buildResetPasswordHtml(token: string): string {
  const url = `${APP_URL}/reset-password?token=${token}`;
  return buildEmailBase('Reset Your Password', `
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
      We received a request to reset your TaskToad password. Click the button below to choose a new password.
    </p>
    ${ctaButton(url, 'Reset Password')}
    <p style="margin:0 0 8px;color:#dc2626;font-size:13px;font-weight:500;">
      This link expires in 1 hour.
    </p>
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
      If you didn't request this, you can safely ignore this email. Your password won't be changed.<br><br>
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${url}" style="color:#1e40af;word-break:break-all;">${url}</a>
    </p>
  `);
}

export function buildInviteHtml(orgName: string, token: string): string {
  const url = `${APP_URL}/invite/accept?token=${token}`;
  return buildEmailBase(`You're Invited to ${orgName}`, `
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
      You've been invited to join <strong>${orgName}</strong> on TaskToad. Click the button below to accept the invitation and start collaborating.
    </p>
    ${ctaButton(url, 'Accept Invitation')}
    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
      This invitation expires in 48 hours.
    </p>
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
      If the button doesn't work, copy and paste this URL into your browser:<br>
      <a href="${url}" style="color:#1e40af;word-break:break-all;">${url}</a>
    </p>
  `);
}
