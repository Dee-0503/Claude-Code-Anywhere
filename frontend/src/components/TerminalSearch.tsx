import { useMemo, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

export interface TerminalSearchMatch {
  readonly index: number;
  readonly total: number;
  readonly offset: number;
}

export interface TerminalSearchProps {
  readonly output: string;
  readonly onMatchChange?: (index: number, total: number, offset: number) => void;
}

export function countTerminalSearchMatches(output: string, query: string): number {
  if (query.length === 0) {
    return 0;
  }

  return output.split(query).length - 1;
}

export function locateTerminalSearchMatch(output: string, query: string, index: number): TerminalSearchMatch {
  const total = countTerminalSearchMatches(output, query);

  if (total === 0) {
    return { index: 0, total, offset: -1 };
  }

  const boundedIndex = ((index % total) + total) % total;
  let offset = -1;
  let fromIndex = 0;

  for (let currentIndex = 0; currentIndex <= boundedIndex; currentIndex += 1) {
    offset = output.indexOf(query, fromIndex);
    fromIndex = offset + query.length;
  }

  return { index: boundedIndex, total, offset };
}

export function TerminalSearch({ output, onMatchChange }: TerminalSearchProps): ReactElement {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const matchCount = useMemo(() => countTerminalSearchMatches(output, query), [output, query]);
  const displayIndex = matchCount === 0 ? 0 : selectedIndex + 1;

  function updateSelection(nextIndex: number): void {
    const match = locateTerminalSearchMatch(output, query, nextIndex);
    setSelectedIndex(match.index);
    onMatchChange?.(match.index, match.total, match.offset);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    const match = locateTerminalSearchMatch(output, nextQuery, 0);
    setSelectedIndex(match.index);
    onMatchChange?.(match.index, match.total, match.offset);
  }

  return (
    <section aria-label="终端搜索">
      <label>
        搜索终端输出
        <input aria-label="搜索终端输出" onChange={handleChange} value={query} />
      </label>
      <span>{displayIndex} / {matchCount}</span>
      <button type="button" onClick={() => updateSelection(selectedIndex - 1)}>上一个</button>
      <button type="button" onClick={() => updateSelection(selectedIndex + 1)}>下一个</button>
    </section>
  );
}
