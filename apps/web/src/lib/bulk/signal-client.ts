import type {
  BulkCapabilities,
  BulkRoomOwnerView,
  BulkRoomReceiverView,
} from "@print-cess/protocol";

import { ApiClientError } from "../api-client";

const OWNER_HEADER = "x-print-cess-bulk-token";

async function call<T>(url: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  } & T;
  if (!response.ok) {
    throw new ApiClientError(
      body.error?.code ?? "networkError",
      body.error?.message ?? "Request failed",
      response.status,
    );
  }
  return body;
}

const json = (body: unknown, token?: string): RequestInit => ({
  headers: {
    "Content-Type": "application/json",
    ...(token ? { [OWNER_HEADER]: token } : {}),
  },
  body: JSON.stringify(body),
});

export function getBulkCapabilities(signal?: AbortSignal): Promise<BulkCapabilities> {
  return call<BulkCapabilities>("/api/bulk/capabilities", { method: "GET" }, signal);
}

export function createBulkRoom(
  input: { roomId: string; ownerTokenHash: string; offer: string },
  signal?: AbortSignal,
): Promise<{ expiresAt: number }> {
  return call(
    "/api/bulk/rooms",
    { method: "POST", ...json({ protocolVersion: 2, ...input }) },
    signal,
  );
}

export async function readBulkRoom(
  roomId: string,
  signal?: AbortSignal,
): Promise<BulkRoomReceiverView | null> {
  try {
    return await call<BulkRoomReceiverView>(`/api/bulk/rooms/${roomId}`, { method: "GET" }, signal);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

export function postBulkAnswer(
  roomId: string,
  generation: number,
  answer: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return call(
    `/api/bulk/rooms/${roomId}/answer`,
    { method: "POST", ...json({ protocolVersion: 2, generation, answer }) },
    signal,
  );
}

export function pollBulkAnswer(
  roomId: string,
  ownerToken: string,
  signal?: AbortSignal,
): Promise<BulkRoomOwnerView> {
  return call<BulkRoomOwnerView>(
    `/api/bulk/rooms/${roomId}/answer`,
    { method: "GET", headers: { [OWNER_HEADER]: ownerToken } },
    signal,
  );
}

export function postBulkOffer(
  roomId: string,
  ownerToken: string,
  generation: number,
  offer: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return call(
    `/api/bulk/rooms/${roomId}/offer`,
    { method: "POST", ...json({ protocolVersion: 2, generation, offer }, ownerToken) },
    signal,
  );
}

export async function deleteBulkRoom(roomId: string, ownerToken: string): Promise<void> {
  await call(`/api/bulk/rooms/${roomId}`, {
    method: "DELETE",
    headers: { [OWNER_HEADER]: ownerToken },
  }).catch(() => undefined);
}
