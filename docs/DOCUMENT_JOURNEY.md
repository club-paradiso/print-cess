# The document journey

How a visitor experiences a document moving from their phone to paper, and how
two phones experience files moving between them. This is the design record for
the screens: what they say, in what order, why some of them stopped existing,
and what the motion and the colour are allowed to mean.

The engineering is complicated. The experience must not be.

---

## The product, in one glance

```text
FILE   →  DESTINATION  →  TRANSFER
PAPER  →  DIGITAL FILE →  DESTINATION
```

Print-cess has three capabilities: **Print** (a file becomes paper), **Share** (a file reaches
another device or person), and **Scan** (paper becomes a PDF). The home page names them in that
order, as three sheets, and says nothing else first. `PRODUCT_V2.md` records the reasoning and
the future native path.

- **Print** is described on the home page and never offered as a button there. It starts at
  the kiosk's QR code, and only the kiosk can open a print session.
- **Share** is one capability with two sides. The home offers "Choose files to send" and,
  quieter, "Receive files with a code". `/send` and `/receive` carry the same "Share" label and
  link to each other. A visitor who arrives from a transfer QR code or link skips every choice
  and lands in receiving.
- **Scan** ends in a destination: on through Share, downloaded, handed to another app where the
  browser can share that exact PDF, or printed through this device's own print window.
- **Workplaces** (the managed-workstation entry and the kiosk display) sit below a hairline as
  plain links. They are real, and they are not what most visitors came for.

---

## Print: the fast path

```text
SCAN  →  CHOOSE FILE  →  CHECK IT  →  PRINT  →  COLLECT
```

That is the whole flow. A visitor who has just scanned a code sees the file
chooser, in their own language, and nothing else stands in front of it.

Two screens used to. **Choose your language** asked a question the visitor's own
browser had already answered — the QR code is on a shared kiosk, but the browser
that scans it is theirs, and it carries `Accept-Language`. **How to print**
taught a first-time visitor four steps at the cost of everyone else, every time.
Together they were two screens and two taps spent before the visitor saw the
thing they came to do.

Both are still available, neither is in the way:

- the language picker sits in the header, for the times the browser's answer is
  wrong;
- the guide lives in Help, reachable from the header and from a quiet link on
  the file screen itself.

The server resolves the language and renders the first paint in it, so nobody
watches the page load in English and then change under them.

### The friction budget

| Moment                                  | Taps |
| --------------------------------------- | ---- |
| Page open → file-source buttons visible | 0    |
| Choosing a source (Photos or Files)     | 1    |
| Confirming the print                    | 1    |

The file step offers **Photos** and **Files** as two equal tiles. What the visitor holds decides
which one they need (a screenshot of a booking is in Photos, an emailed PDF in Files), so
neither is styled as the expected answer. Scanning is not offered here: a claimed session lives
three minutes by default, and a multi-page scan can outlast it. Scan first, then print the PDF.

`Print one copy` stays. It is the one irreversible, outward-facing action in the
flow — paper comes out of a machine in a room — and it deserves a deliberate
tap. Nothing else may be added beside it: a second "are you sure?" would be
ceremony, not safety.

### Assisted path

Help carries everything a first-time visitor needs and an experienced one never
opens: the four steps, where documents hide (KakaoTalk, email, "I don't have
one"), what happens next, and the reminder that staff never log into anyone's
account, search anyone's phone, or type a password for them.

---

## Print: who is talking, and when

Each state names the screen that has the answer, so nobody looks at the wrong
one.

| Stage             | The kiosk says                           | The phone says                                           |
| ----------------- | ---------------------------------------- | -------------------------------------------------------- |
| Waiting           | Open your camera · scan this QR          | —                                                        |
| Phone connected   | Phone connected · continue on your phone | Pick one file to print                                   |
| Document arriving | Arriving                                 | Sending…                                                 |
| Checking          | Checking                                 | Waiting for the printer                                  |
| Printing          | Printing · one moment                    | Waiting for the printer                                  |
| Done              | Take your paper                          | All done · collect your document                         |
| Connection lost   | (unchanged — the kiosk still knows)      | Connection interrupted · the kiosk may still be printing |

The kiosk stops asking the room to scan a code the moment a phone claims the
session. Repeating an instruction the visitor has already carried out, next to a
QR that no longer works, was the single most confusing thing on the shared
screen.

### What the shared screen may show

A public display in a room full of strangers may show a **category and a stage**
and nothing else. Never a file name, never a thumbnail, never a page, never
anything that identifies the person who sent it. The document appears as an
anonymous token: a shape that arrives, is checked, and is printed.

---

## Print: the phone stops being in charge

Before the upload is committed, the phone owns the session and cancelling on
error is correct. After it, the kiosk owns the work — it may already be
validating, spooling, or printing — and the phone is a status display.

So a failed status poll never produces a verdict. It says the connection was
interrupted, notes that the kiosk may still be printing, and retries. If contact
never returns, the screen says exactly that and points at the printer, which is
the only place the answer actually exists. It never invents a failure, and it
never invents a success.

This was previously a real defect: any polling error cancelled the session,
which took back print jobs already on their way to paper and told the visitor
they had failed.

---

## Hand-off: the shape of it

```text
CHOOSE FILES  →  CODE APPEARS  →  OTHER PHONE SCANS  →  FILES ARRIVE
```

The code appears as soon as the service holds the transfer record — not when the
last byte lands. For a large hand-off that is the difference between the other
person scanning immediately and waiting with you, and staring at your progress
bar for two minutes before they are allowed to begin.

A receiver who arrives early sees **Connected · the files are still being
prepared**. Not an error, not a file list, not a progress bar belonging to
somebody else's phone, and never a hint of who is sending. Somebody guessing a
code still gets the same "not found" they always did.

### The ready screen, top to bottom

1. What the other side has done (the status below), because it is what the sender keeps
   glancing back at.
2. The QR code, the private default.
3. Share the link or copy it.
4. "or", then the optional two-digit hand-off. Its trade-off (the service holds the key for
   three minutes) is stated here, where the choice is made, and not on the pick screen.
5. Erase it now: final, quiet, and never the next step.

### What the sender is told

Four states, and the service knows all four honestly:

| State      | What actually happened                          |
| ---------- | ----------------------------------------------- |
| Waiting    | Nobody has opened it                            |
| Connected  | Somebody with the code opened the transfer      |
| On its way | A receiver asked for the first chunk            |
| Taken      | A receiver's own flow reported that it finished |

The last one is a receipt from the other phone, carrying one bit and nothing
else: no identity, no file name, no destination app, no device. The sending
screen used to say "someone picked these files up" as soon as a signed URL was
handed out, which was a guess wearing a receipt's clothes.

---

## Hand-off: what "saved" is allowed to mean

Five different things used to be called `Saved`. They are now five things:

| What happened                                     | What the screen says                          |
| ------------------------------------------------- | --------------------------------------------- |
| Written and closed into a file the visitor picked | Saved                                         |
| Written into a folder the visitor picked          | Saved                                         |
| Handed to the browser's download machinery        | Download started — look in Downloads or Files |
| Handed to the system share sheet                  | Sent to another app                           |
| Decrypted but not yet finished                    | Saving…                                       |
| Failed                                            | The reason, and a retry                       |

A UI claiming "Saved" when the browser only started a download is a correctness
bug, not a wording preference. The distinction is enforced by the destination
itself: each one returns its own outcome, and the screen renders what it was
given. Translations preserve the distinction in all thirteen languages.

Each file has its own state and its own actions, so one failure never discards
what already arrived.

---

## Scan: paper, then a destination

```text
PHOTOGRAPH PAGES  →  CHECK EDGES  →  MAKE PDF  →  SEND / SAVE / SHARE / PRINT HERE
```

The PDF is made on the phone. With no page yet, the camera is the one primary action. Once a
page exists, **Make PDF** is, and adding a page drops to a secondary control. The finished
screen has one primary action, **Send to another device**, which opens Share already holding the
PDF, with a way back to the scan. Nothing uploads until the visitor presses send there. The
quieter alternatives are one list: download (which says "download started", never "saved"),
share to another app (shown only when the browser can share that exact file), and **Print from
this device**, named so nobody mistakes the device's print window for a Print-cess printer.

---

## Motion

Motion exists to make a state change legible in less than a second. It is never
the only channel, and it never blocks anything.

- **Arrival.** The document token on the kiosk fades and rises 14px into place
  over 420ms when a phone connects. It is the only "materialization" in the
  product, and it is short enough not to be a wait.
- **Alive.** A receiver waiting on a sender sees a slow indigo pulse. It says the
  line is open; it does not pretend to be a percentage nobody can measure.
- **Hand-off.** While the phone sends a document, a sheet slides into the
  printer from the mark; while the kiosk prints, a sheet slides out of it. It
  runs only in those two states, stands in for no percentage, and is hidden
  from assistive technology because the heading beside it says the same thing.
  A lost connection is never drawn as progress: it gets a warning icon instead.
- **Progress.** Determinate bars appear only where bytes are actually counted.
  Percentages are never invented.
- **The QR never moves.** Somebody is pointing a camera at it.

`prefers-reduced-motion: reduce` is honoured globally in
`packages/ui/src/styles.css`: every animation and transition collapses, and the
hand-off drawing holds a still frame of the sheet at the slot rather than the
last frame of its loop. Nothing in the product depends on motion to be
understood, so a reduced-motion visitor loses decoration and no information.

---

## Colour and state

State is carried by the sentence first. Colour and iconography are a second and
third channel.

| State        | Hue (token)                                  | The word                  |
| ------------ | -------------------------------------------- | ------------------------- |
| Ready        | Royal Indigo (`--pc-brand`)                  | Ready / Connected         |
| Sending      | Royal Indigo (`--pc-transfer-active`)        | Sending / Saving          |
| Receiving    | Royal Indigo (`--pc-transfer-active`)        | Saving                    |
| Checking     | Royal Indigo (`--pc-printing`)               | Checking / Printing       |
| Success      | Mint Teal (`--pc-success`, `--pc-completed`) | Saved / Printed / Deleted |
| Needs a look | Amber (`--pc-warning`)                       | Reconnecting / Limited    |
| Error        | Red (`--pc-destructive`)                     | The reason                |

Work in flight used to be warm amber. It is the brand's indigo now, because
amber is reserved for the one state that asks the visitor to look twice (a
lost connection, a limited browser); an in-flight transfer is not a warning.

Both ends of a transfer use the same hue for the same meaning, so the sending
phone and the receiving phone read as one service. No state is distinguishable
by colour alone, on any screen.

---

## Sound

The kiosk plays one short, quiet tone when a print completes, so somebody who
walked away from the printer knows to come back. `?sound=off` on the kiosk URL
silences it for a counter where the tone would carry further than it helps; the
screen says the same thing either way, so nothing is lost.

That is the whole sound language, and it is deliberate: an office does not want
a service that chirps, and every other state it could announce is already
legible on screen.
Any future cue must be short, quiet, optional, have a visual equivalent already
on screen, and encode nothing about the document. Continuous tones and speech
are out.

---

## Accessibility

- Every state change is announced once, not on every poll. The status watcher
  emits a state only when it changes, so a screen reader hears the flow rather
  than a metronome.
- Touch targets are at least 44px; the code field, the language picker, and the
  per-file actions all meet it.
- Right-to-left is set on the document element with the language, and Arabic is
  checked for horizontal overflow at phone widths.
- Long translations are given room to wrap rather than truncated; file names
  wrap anywhere, because a name from another device can be long and unbroken.
- Axe runs against the mobile flow in the end-to-end suite, on desktop and on
  two phone viewports.

---

## What was deliberately not built

- **A print button on the home page.** It would have nowhere honest to go.
- **A separate "send or receive?" question.** Sharing starts with choosing files. Receiving is
  one link away, and arriving by QR code or link skips the question entirely.
- **A mode picker.** "Simple or advanced?" is another question in front of the
  task. The fast path is the default and Help is always one tap away.
- **A separate animation protocol.** Every visual state maps to a state the
  service actually has. Nothing is animated on a timer pretending to be
  progress.
- **Auto-opening received files.** Received bytes are hostile and opaque. The
  service will hand a file to another app when the visitor asks; it will never
  render, parse, or execute one to be helpful.
