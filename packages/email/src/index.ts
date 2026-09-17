import { Resend } from "resend";

export type EmailContent = { subject: string; html: string; text: string };
export type SendEmailInput = EmailContent & { to: string | string[]; replyTo?: string };

let client: Resend | undefined;

/**
 * Send an email through Resend. When RESEND_API_KEY is missing (local dev)
 * the message is printed to the console instead so auth flows still work.
 */
export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.info(
      `[email] RESEND_API_KEY/EMAIL_FROM not set. Would send to ${input.to}:\n` +
        `  Subject: ${input.subject}\n  ${input.text}`,
    );
    return { id: "dev-noop" };
  }

  client ??= new Resend(apiKey);
  const { data, error } = await client.emails.send({
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
