import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, createTransportMock, resendSendMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  const resendSendMock = vi.fn();
  return { sendMailMock, createTransportMock, resendSendMock };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
  },
}));

import { sendEmail } from "./index";

describe("sendEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses Gmail SMTP when SMTP_USER and SMTP_PASS are set and strips app password spaces", async () => {
    process.env.SMTP_USER = "alerts@gmail.com";
    process.env.SMTP_PASS = "abcd efgh ijkl mnop";
    process.env.EMAIL_FROM = "Perks <alerts@gmail.com>";
    sendMailMock.mockResolvedValueOnce({ messageId: "<msg-1@gmail.com>" });

    const result = await sendEmail({
      to: "andy@example.com",
      subject: "Credits expiring",
      html: "<p>Use your credits</p>",
      text: "Use your credits",
    });

    expect(createTransportMock).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "alerts@gmail.com", pass: "abcdefghijklmnop" },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "Perks <alerts@gmail.com>",
      to: "andy@example.com",
      subject: "Credits expiring",
      html: "<p>Use your credits</p>",
      text: "Use your credits",
      replyTo: undefined,
    });
    expect(result).toEqual({ id: "<msg-1@gmail.com>" });
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it("falls back to SMTP_USER as the sender when EMAIL_FROM is omitted", async () => {
    process.env.SMTP_USER = "alerts@gmail.com";
    process.env.SMTP_PASS = "secretpass";
    sendMailMock.mockResolvedValueOnce({ messageId: "<msg-2@gmail.com>" });

    await sendEmail({
      to: "matt@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "alerts@gmail.com",
        to: "matt@example.com",
      }),
    );
  });

  it("falls back to Resend when SMTP vars are not set", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.EMAIL_FROM = "Perks <alerts@example.com>";
    resendSendMock.mockResolvedValueOnce({ data: { id: "re_1" }, error: null });

    const result = await sendEmail({
      to: "andy@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(resendSendMock).toHaveBeenCalledWith({
      from: "Perks <alerts@example.com>",
      to: "andy@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      replyTo: undefined,
    });
    expect(result).toEqual({ id: "re_1" });
  });

  it("returns dev-noop when no transport is configured", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await sendEmail({
      to: "andy@example.com",
      subject: "Local",
      html: "<p>Local</p>",
      text: "Local",
    });

    expect(result).toEqual({ id: "dev-noop" });
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });
});
