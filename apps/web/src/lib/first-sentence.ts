/**
 * Splits a message into what happened and what to do about it.
 *
 * Error copy is written as one string, "what happened. what to do." That keeps
 * the translations whole, but a whole paragraph set as a screen title is hard
 * to scan. The first sentence becomes the title and the rest the instruction
 * below it. Scripts without sentence punctuation (Thai) stay in one piece,
 * which is exactly how they rendered before.
 */
// A Latin stop ends a sentence only before a space, so "10.5 MB" and
// "file.pdf" stay intact; full-width and Indic marks need no space after them.
const SENTENCE_END = /^(.+?(?:[.!?](?=\s)|[。！？।។]))\s*(\S[\s\S]*)$/u;

export function splitFirstSentence(message: string): [string, string] {
  const match = SENTENCE_END.exec(message.trim());
  if (!match?.[1] || !match[2]) return [message, ""];
  return [match[1], match[2]];
}
