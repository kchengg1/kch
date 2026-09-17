import type { EmailContent } from "./index";

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Minimal, inbox-safe layout used by every template. */
export function layout({
  appName,
  title,
  body,
  cta,
}: {
  appName: string;
  title: string;
  body: string;
  cta?: { label: string; url: string };
}) {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:12px;padding:32px">
<tr><td style="font-size:14px;color:#666;padding-bottom:16px">${escapeHtml(appName)}</td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:12px">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}${button}</td></tr>
</table>
<p style="font-size:12px;color:#999;margin-top:16px">You received this because you have an account with ${escapeHtml(appName)}.</p>
</td></tr></table></body></html>`;
}

export function verifyEmailTemplate(p: { appName: string; url: string }): EmailContent {
  return {
    subject: `Verify your email for ${p.appName}`,
    html: layout({
      appName: p.appName,
      title: "Confirm your email",
      body: "<p>Click the button below to verify your email address.</p>",
      cta: { label: "Verify email", url: p.url },
    }),
    text: `Verify your email for ${p.appName}: ${p.url}`,
  };
}

export function resetPasswordEmail(p: { appName: string; url: string }): EmailContent {
  return {
    subject: `Reset your ${p.appName} password`,
    html: layout({
      appName: p.appName,
      title: "Reset your password",
      body: "<p>We received a request to reset your password. This link expires in one hour.</p>",
      cta: { label: "Reset password", url: p.url },
    }),
    text: `Reset your ${p.appName} password: ${p.url}`,
  };
}

export function welcomeEmail(p: { appName: string; name?: string; url: string }): EmailContent {
  const hi = p.name ? `Hi ${escapeHtml(p.name)},` : "Hi,";
  return {
    subject: `Welcome to ${p.appName}`,
    html: layout({
      appName: p.appName,
      title: `Welcome to ${p.appName}`,
      body: `<p>${hi}</p><p>Thanks for signing up. Head to your dashboard to get started.</p>`,
      cta: { label: "Open dashboard", url: p.url },
    }),
    text: `Welcome to ${p.appName}! Open your dashboard: ${p.url}`,
  };
}
