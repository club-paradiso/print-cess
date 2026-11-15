import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateToken, hashToken } from "@print-cess/crypto";
import { BULK_ROOM_MAX_LIFETIME_SECONDS, BULK_ROOM_TTL_SECONDS } from "@print-cess/protocol";

import { MemoryBulkRoomStore } from "@/server/bulk-room-store/memory";
import { MemoryDropStore } from "@/server/drop-store/memory";

const runtimeMock = vi.hoisted(() => ({ getRuntime: vi.fn() }));
vi.mock("@/server/runtime", () => runtimeMock);

import { GET as capabilities } from "@/app/api/bulk/capabilities/route";
import { POST as createRoom } from "@/app/api/bulk/rooms/route";
import { DELETE as deleteRoom, GET as readRoom } from "@/app/api/bulk/rooms/[roomId]/route";
import { GET as pollAnswer, POST as postAnswer } from "@/app/api/bulk/rooms/[roomId]/answer/route";
import { POST as postOffer } from "@/app/api/bulk/rooms/[roomId]/offer/route";

const ORIGIN = "https://print-cess.example.test";
const SIGNAL = "S".repeat(200);
let rooms: MemoryBulkRoomStore;
let address = 0;
let roomCounter = 0;

function nextRoomId(): string {
  roomCounter += 1;
  return `${String(roomCounter).padStart(21, "R")}A`;
}

function request(
  path: string,
  init: { method: string; body?: unknown; token?: string; ip?: string },
) {
  address += 1;
  return new Request(`${ORIGIN}${path}`, {
    method: init.method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": init.ip ?? `203.0.113.${address % 250}`,
      ...(init.token ? { "x-print-cess-bulk-token": init.token } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

const params = (roomId: string) => ({ params: Promise.resolve({ roomId }) });

async function openRoom(roomId = nextRoomId()) {
  const token = generateToken(32);
  const response = await createRoom(
    request("/api/bulk/rooms", {
      method: "POST",
      body: {
        protocolVersion: 2,
        roomId,
        ownerTokenHash: await hashToken(token, "bulk"),
        offer: SIGNAL,
      },
    }),
  );
  return { roomId, token, response };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));
  rooms = new MemoryBulkRoomStore();
  runtimeMock.getRuntime.mockReturnValue({
    config: { allowedOrigins: [ORIGIN], dropMaxTotalBytes: 2 * 1024 ** 3 },
    bulkRooms: rooms,
    drops: new MemoryDropStore(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("bulk signalling routes", () => {
  it("runs offer → answer → owner poll, and never stores anything but opaque signals", async () => {
    const { roomId, token, response } = await openRoom();
    expect(response.status).toBe(201);

    const view = await readRoom(
      request(`/api/bulk/rooms/${roomId}`, { method: "GET" }),
      params(roomId),
    );
    expect(view.status).toBe(200);
    const body = (await view.json()) as Record<string, unknown>;
    expect(body).toEqual({
      protocolVersion: 2,
      generation: 1,
      offer: SIGNAL,
      answered: false,
      expiresAt: expect.any(Number),
    });
    // The receiver view never exposes the owner credential hash.
    expect(JSON.stringify(body)).not.toContain("ownerTokenHash");

    const pending = await pollAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, { method: "GET", token }),
      params(roomId),
    );
    expect(((await pending.json()) as { answer: string | null }).answer).toBeNull();

    const answered = await postAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, {
        method: "POST",
        body: { protocolVersion: 2, generation: 1, answer: "A".repeat(150) },
      }),
      params(roomId),
    );
    expect(answered.status).toBe(201);

    const poll = await pollAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, { method: "GET", token }),
      params(roomId),
    );
    expect(((await poll.json()) as { answer: string }).answer).toBe("A".repeat(150));
  });

  it("keeps the first answer and refuses a second device", async () => {
    const { roomId } = await openRoom();
    const answer = (value: string) =>
      postAnswer(
        request(`/api/bulk/rooms/${roomId}/answer`, {
          method: "POST",
          body: { protocolVersion: 2, generation: 1, answer: value.repeat(100) },
        }),
        params(roomId),
      );
    expect((await answer("A")).status).toBe(201);
    expect((await answer("B")).status).toBe(409);
  });

  it("rejects an answer for a replaced generation and accepts the next one", async () => {
    const { roomId, token } = await openRoom();
    const reoffer = await postOffer(
      request(`/api/bulk/rooms/${roomId}/offer`, {
        method: "POST",
        token,
        body: { protocolVersion: 2, generation: 2, offer: "N".repeat(100) },
      }),
      params(roomId),
    );
    expect(reoffer.status).toBe(200);
    const stale = await postAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, {
        method: "POST",
        body: { protocolVersion: 2, generation: 1, answer: "A".repeat(100) },
      }),
      params(roomId),
    );
    expect(stale.status).toBe(409);
    const fresh = await postAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, {
        method: "POST",
        body: { protocolVersion: 2, generation: 2, answer: "A".repeat(100) },
      }),
      params(roomId),
    );
    expect(fresh.status).toBe(201);
    // Skipping a generation is refused.
    const skipped = await postOffer(
      request(`/api/bulk/rooms/${roomId}/offer`, {
        method: "POST",
        token,
        body: { protocolVersion: 2, generation: 4, offer: "N".repeat(100) },
      }),
      params(roomId),
    );
    expect(skipped.status).toBe(409);
  });

  it("requires the owner credential to poll, re-offer, or delete", async () => {
    const { roomId } = await openRoom();
    const wrong = generateToken(32);
    const poll = await pollAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, { method: "GET", token: wrong }),
      params(roomId),
    );
    expect(poll.status).toBe(401);
    const offer = await postOffer(
      request(`/api/bulk/rooms/${roomId}/offer`, {
        method: "POST",
        token: wrong,
        body: { protocolVersion: 2, generation: 2, offer: "N".repeat(100) },
      }),
      params(roomId),
    );
    expect(offer.status).toBe(401);
    const removal = await deleteRoom(
      request(`/api/bulk/rooms/${roomId}`, { method: "DELETE", token: wrong }),
      params(roomId),
    );
    expect(removal.status).toBe(401);
  });

  it("answers an unknown room and an expired room identically", async () => {
    const { roomId } = await openRoom();
    vi.setSystemTime(Date.now() + BULK_ROOM_TTL_SECONDS * 1000 + 1);
    const expired = await readRoom(
      request(`/api/bulk/rooms/${roomId}`, { method: "GET" }),
      params(roomId),
    );
    const unknownId = nextRoomId();
    const unknown = await readRoom(
      request(`/api/bulk/rooms/${unknownId}`, { method: "GET" }),
      params(unknownId),
    );
    expect(expired.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await expired.json()).toEqual(await unknown.json());
  });

  it("slides expiry on owner activity but never past the maximum lifetime", async () => {
    const { roomId, token } = await openRoom();
    const created = Date.now();
    for (let minute = 25; minute <= BULK_ROOM_MAX_LIFETIME_SECONDS / 60 + 60; minute += 25) {
      vi.setSystemTime(created + minute * 60_000);
      const response = await pollAnswer(
        request(`/api/bulk/rooms/${roomId}/answer`, { method: "GET", token }),
        params(roomId),
      );
      if (response.status !== 200) {
        expect(response.status).toBe(404);
        expect(minute * 60).toBeGreaterThanOrEqual(BULK_ROOM_MAX_LIFETIME_SECONDS);
        return;
      }
      const view = (await response.json()) as { expiresAt: number };
      expect(view.expiresAt).toBeLessThanOrEqual(created + BULK_ROOM_MAX_LIFETIME_SECONDS * 1000);
    }
    throw new Error("The room outlived its maximum lifetime");
  });

  it("refuses a duplicate room, malformed bodies, and oversized signals", async () => {
    const { roomId } = await openRoom();
    expect((await openRoom(roomId)).response.status).toBe(409);
    const malformed = await createRoom(
      request("/api/bulk/rooms", { method: "POST", body: { protocolVersion: 1, roomId } }),
    );
    expect(malformed.status).toBe(400);
    const oversized = await postAnswer(
      request(`/api/bulk/rooms/${roomId}/answer`, {
        method: "POST",
        body: { protocolVersion: 2, generation: 1, answer: "A".repeat(40_000) },
      }),
      params(roomId),
    );
    expect(oversized.status).toBe(413);
    const badId = await readRoom(request("/api/bulk/rooms/x", { method: "GET" }), params("../etc"));
    expect(badId.status).toBe(400);
  });

  it("deletes a room for its owner", async () => {
    const { roomId, token } = await openRoom();
    const removal = await deleteRoom(
      request(`/api/bulk/rooms/${roomId}`, { method: "DELETE", token }),
      params(roomId),
    );
    expect(removal.status).toBe(200);
    expect(await rooms.get(roomId, Date.now())).toBeNull();
  });

  it("charges room creation to a shared hourly budget per address", async () => {
    vi.stubEnv("PRINT_CESS_BULK_HOURLY_ROOMS", "2");
    const ip = "198.51.100.77";
    const create = async () => {
      const token = generateToken(32);
      return createRoom(
        request("/api/bulk/rooms", {
          method: "POST",
          ip,
          body: {
            protocolVersion: 2,
            roomId: nextRoomId(),
            ownerTokenHash: await hashToken(token, "bulk"),
            offer: SIGNAL,
          },
        }),
      );
    };
    expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(201);
    expect((await create()).status).toBe(429);
  });

  it("publishes STUN by default and no relay unless all TURN settings are present", async () => {
    const response = await capabilities(request("/api/bulk/capabilities", { method: "GET" }));
    const body = (await response.json()) as {
      maximumFileCount: number;
      relayConfigured: boolean;
      iceServers: { urls: string[] }[];
    };
    expect(body.maximumFileCount).toBe(3000);
    expect(body.relayConfigured).toBe(false);
    expect(
      body.iceServers.flatMap((server) => server.urls).every((url) => url.startsWith("stun:")),
    ).toBe(true);
  });
});
