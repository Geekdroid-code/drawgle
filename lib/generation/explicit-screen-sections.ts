export type NumberedScreenSection = {
  index: number;
  name: string;
  text: string;
};

type ScreenLineMatch = {
  index: number;
  sourceIndex: number;
  name: string;
};

const cleanScreenName = (value: string, fallback: string) => {
  const firstLine = value.split("\n", 1)[0]?.trim() ?? "";
  const delimiter = firstLine.search(/\s+[—–-]\s+|:\s+/);
  const name = (delimiter >= 0 ? firstLine.slice(0, delimiter) : firstLine)
    .replace(/^the\s+/i, "")
    .replace(/[.\s]+$/, "")
    .trim();
  return (name || fallback).slice(0, 100);
};

const sectionsFromMatches = (source: string, matches: ScreenLineMatch[]): NumberedScreenSection[] =>
  matches.map((match, position) => {
    const end = matches[position + 1]?.sourceIndex ?? source.length;
    return {
      index: match.index,
      name: match.name,
      text: source.slice(match.sourceIndex, end).trim().slice(0, 7000),
    };
  });

/**
 * Recognizes both `Screen 1: Home` and ordinary lists introduced by a screen
 * heading, such as `Create these screens:\n1. Home — ...`.
 */
export const parseNumberedScreenSections = (prompt: string): NumberedScreenSection[] => {
  const explicitMatches = Array.from(
    prompt.matchAll(/(?:^|\n)\s*Screen\s+(\d{1,2})\s*:\s*([^\n.]+?)(?:\.|\n|$)/gi),
  ).map((match) => ({
    index: Number(match[1]),
    sourceIndex: match.index ?? 0,
    name: cleanScreenName(match[2] ?? "", `Screen ${match[1]}`),
  }));
  if (explicitMatches.length > 0) {
    return sectionsFromMatches(prompt, explicitMatches);
  }

  const heading = /\b(?:create|build|design|generate|include|make)\s+(?:(?:all|these|the\s+following|following)\s+)?(?:screens|pages|views)\s*:\s*/i.exec(prompt);
  if (!heading || heading.index === undefined) return [];

  const listStart = heading.index + heading[0].length;
  const listSource = prompt.slice(listStart);
  const listMatches = Array.from(
    listSource.matchAll(/(?:^|\n)\s*(\d{1,2})[.)]\s+([^\n]+)/g),
  ).map((match) => ({
    index: Number(match[1]),
    sourceIndex: match.index ?? 0,
    name: cleanScreenName(match[2] ?? "", `Screen ${match[1]}`),
  }));

  if (listMatches.length < 2) return [];
  const sequential = listMatches.every((match, position) =>
    position === 0 || match.index === listMatches[position - 1]!.index + 1);
  return sequential ? sectionsFromMatches(listSource, listMatches) : [];
};
