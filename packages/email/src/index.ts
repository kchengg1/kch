import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

export type EmailContent = { subject: string; html: string; text: string };
export type SendEmailInput = EmailContent & { to: string | string[]; replyTo?: string };

let resendClient: Resend | undefined;
let smtpTransport: { key: string; transporter: Transporter } | undefined;

function getSmtpTransporter(user: string, pass: string, host: string, port: number): Transporter {
  const key = `${host}:${port}:${user}:${pass}`;
  if (smtpTransport?.key === key) return smtpTransport.transporter;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  smtpTransport = { key, transporter };
  return transporter;
}

/**
 * Send an email via SMTP (defaults to Gmail when SMTP_USER and SMTP_PASS are
 * set) or Resend (when RESEND_API_KEY and EMAIL_FROM are set). When neither is
 * configured (local dev) the message is printed to the console instead so auth
 * flows still work.
 */
export async function sendEmail(input: SendEmailInput) {
  const smtpUser = process.env.SMTP_USER?.trim();
  const rawSmtpPass = process.env.SMTP_PASS?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (smtpUser && rawSmtpPass) {
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT?.trim() || "465");
    // Google App Passwords are often copied with spaces between 4-char groups.
    const pass = host === "smtp.gmail.com" ? rawSmtpPass.replace(/\s+/g, "") : rawSmtpPass;
    const transporter = getSmtpTransporter(smtpUser, pass, host, port);
    const info = await transporter.sendMail({
      from: from || smtpUser,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    return { id: info.messageId ?? "" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !from) {
    console.info(
      `[email] SMTP_USER/SMTP_PASS and RESEND_API_KEY/EMAIL_FROM not set. Would send to ${input.to}:\n` +
        `  Subject: ${input.subject}\n  ${input.text}`,
    );
    return { id: "dev-noop" };
  }

  resendClient ??= new Resend(apiKey);
  const { data, error } = await resendClient.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return { id: data?.id ?? "" };
}

export * from "./templates";
