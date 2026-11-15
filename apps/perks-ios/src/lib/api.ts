import type { MobileActionPayload, MobileActionResponse, MobileBootstrap } from "../types";

const APP_ORIGIN = "perks://app";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function authHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    origin: APP_ORIGIN,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string; message?: string };
    if (typeof json.error === "string" && json.error.trim()) return json.error;
    if (typeof json.message === "string" && json.message.trim()) return json.message;
  } catch {
    // Fall back to status text
  }
  return fallback;
}

export async function signInWithEmail(input: {
  baseUrl: string;
  email: string;
  password: string;
}): Promise<{ token: string }> {
  const res = await fetch(`${input.baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "omit",
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
    }),
  });
  if (!res.ok) {
    throw new ApiError(
      await readErrorMessage(res, "Could not sign in. Check your email and password."),
      res.status,
    );
  }
  const headerToken = res.headers.get("set-auth-token");
  const body = (await res.json()) as { token?: string };
  const token = headerToken || body.token;
  if (!token) {
    throw new ApiError("Signed in, but no session token was returned by the server.", 500);
  }
  return { token };
}

export async function signUpWithEmail(input: {
  baseUrl: string;
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string }> {
  const res = await fetch(`${input.baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "omit",
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
    }),
  });
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res, "Could not create your account."), res.status);
  }
  const headerToken = res.headers.get("set-auth-token");
  const body = (await res.json()) as { token?: string };
  const token = headerToken || body.token;
  if (!token) {
    return signInWithEmail({
      baseUrl: input.baseUrl,
      email: input.email,
      password: input.password,
    });
  }
  return { token };
}

export async function signOutSession(input: { baseUrl: string; token: string }): Promise<void> {
  try {
    await fetch(`${input.baseUrl}/api/auth/sign-out`, {
      method: "POST",
      headers: authHeaders(input.token),
      credentials: "omit",
      body: "{}",
    });
  } catch {
    // Clearing the local token still signs out on device even if offline
  }
}

export async function fetchBootstrap(input: {
  baseUrl: string;
  token: string;
}): Promise<MobileBootstrap> {
  const res = await fetch(`${input.baseUrl}/api/mobile/bootstrap`, {
    method: "GET",
    headers: {
      accept: "application/json",
      origin: APP_ORIGIN,
      authorization: `Bearer ${input.token}`,
    },
    credentials: "omit",
  });
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res, "Could not load your Perks data."), res.status);
  }
  return (await res.json()) as MobileBootstrap;
}

export async function postMobileAction(input: {
  baseUrl: string;
  token: string;
  payload: MobileActionPayload;
}): Promise<MobileActionResponse> {
  const res = await fetch(`${input.baseUrl}/api/mobile/action`, {
    method: "POST",
    headers: authHeaders(input.token),
    credentials: "omit",
    body: JSON.stringify(input.payload),
  });
  if (!res.ok) {
    throw new ApiError(await readErrorMessage(res, "Could not save that change."), res.status);
  }
  return (await res.json()) as MobileActionResponse;
}
