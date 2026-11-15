# ADR 0003 — Bulk transfer goes browser to browser, and the server only introduces the two

- **Status:** Accepted (implementation in review; physical-device acceptance pending)
- **Date:** 2026-11-15
- **Relates to:** `FILE_TRANSFER.md` (v1 drop), `BULK_TRANSFER.md` (this feature in full)

## Context

The v1 hand-off (`/send`, `/receive`) is store-and-forward. Every byte is encrypted on the
phone, uploaded to private blob storage in 8 MiB parts through signed URLs, and downloaded again.
That design is right for its job — the sender may leave once the upload finishes — and it is
deliberately capped at 20 files and `DROP_MAX_TOTAL_MB` (2 GiB by default).

The new requirement is up to 3,000 photos, videos and documents in one hand-off, validated at
about 15 GiB, at negligible operating cost. Measured against the v1 path:

| Bottleneck         | v1 at 3,000 files / 15 GiB                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Manifest           | One encrypted record field capped at 16 KiB; 3,000 names need ~600 KiB                                                        |
| Part table         | One record holding every part; `MAX_DROP_PARTS = 4096` parts × 8 MiB = 32 GiB ceiling, but one row rewritten per commit batch |
| API traffic        | ≈1,900 parts → ≈240 authorize + ≈240 commit calls each way, plus one PUT and one GET per part                                 |
| Storage and egress | 15 GiB written and read once per hand-off, billed by the blob provider                                                        |
| Receiving phone    | Each file must be saved by the browser; iOS Safari has no folder picker                                                       |

Raising `MAX_DROP_FILES` to 3,000 would have kept every one of those costs and moved the manifest
and part table past what a single record should hold.

## Decision

Add a **separate, versioned protocol (v2)** in which the two browsers transfer directly over a
WebRTC data channel, and the server is a signalling mailbox only.

1. **The code is the only secret, as in v1.** The sender draws a 12-character Crockford code and
   carries it to the receiver in the QR fragment. PBKDF2 (same work factor as v1, different salt)
   stretches it into a room identifier and HKDF keys for signalling, channel proof, manifest and
   per-file content.
2. **Signalling is two sealed blobs per connection.** The offer and the answer (complete,
   non-trickle SDP, including the DTLS certificate fingerprint) are AES-GCM sealed with additional
   data binding room, role and generation. The mailbox stores them in one small TTL record per room
   (Redis or PostgreSQL through the existing store selection). It never sees an IP candidate in the
   clear, a file name, a size, or a count.
3. **The channel is bound to the code.** Because the fingerprint is inside an authenticated
   envelope, only a code holder can choose the certificate the channel terminates at. After the
   channel opens, both sides exchange fresh nonces and an HMAC over both nonces, both fingerprints,
   the room and the generation. Nothing else is sent before the peer's proof verifies.
4. **Content is still end-to-end sealed.** DTLS already encrypts the channel, but every 256 KiB
   block is additionally sealed with a per-file AES-GCM key and a random IV, with additional data
   binding file, block index and block count. A TURN relay, if an operator ever configures one,
   sees only DTLS records; corruption, reordering and truncation fail authentication.
5. **Transport framing is separate from encryption framing.** Sealed blocks are cut into data
   channel messages of 16 KiB (or the negotiated maximum, if smaller). The receiver pulls one file
   at a time, acknowledges a block only after its destination accepted the write, and caps the
   window of unacknowledged blocks; the sender also respects `bufferedAmount` high/low-water marks.
6. **Losing the connection is a normal event.** The sender opens a new generation in the same
   room; the receiver answers it and asks for exactly the blocks it lacks. Files keep their sinks.
7. **Cloud is a consented fallback, not a silent one.** When a direct connection cannot be
   made, and the selection fits the v1 limits, the sender may switch to the existing encrypted
   v1 hand-off after an explanation and an explicit tap. No new storage provider is introduced.

## Consequences

- **Operating cost** for a direct transfer is a handful of tiny HTTP requests and Redis commands,
  independent of file count and size. There is no storage or egress cost for file bytes.
- **Both browsers must stay open** for the duration. That is a real product difference from v1,
  stated on both screens.
- **Not every network allows it.** Symmetric NAT on both ends, or a network that blocks UDP
  device-to-device traffic, defeats STUN-only connectivity. TURN is supported but off by default,
  because it relays bytes and costs bandwidth. The consented v1 fallback covers small selections.
- **The receiving browser is the limit,** not the protocol. Desktop Chromium writes straight into a
  chosen folder. iOS and iPadOS Safari receive into browser storage in batches and hand each batch
  to the share sheet; the screen says "held in browser" until then and never "saved".

## Alternatives considered

- **Raise the v1 limits.** Rejected: keeps the storage, egress and request costs linear in bytes and
  parts, and needs a manifest and part-table redesign anyway.
- **Cloudflare R2 as a second blob provider.** Evaluated in `BULK_TRANSFER.md`. R2's zero-egress
  pricing helps the download half, but the transfer would still store 15 GiB per hand-off, add an
  S3-compatible credential to rotate, and duplicate an adapter the repository already has
  (`railway-s3`). Not adopted; the existing S3 transport could point at R2 later with no code
  change if an operator decides to.
- **A managed signalling or TURN service.** Rejected without explicit approval: recurring cost and a
  new processor of connection metadata.
- **Trickle ICE.** Faster first byte by a second or two, but it would write every candidate to the
  mailbox. Complete gathering with a five-second cap keeps signalling at two writes.
