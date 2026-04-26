import { useMemo, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

export interface TerminalSearchProps {
  readonly output: string;
  readonly onMatchChange?: (index: number, total: number) => void;
}

export function countTerminalSearchMatches(output: string, query: string): number {
  if (query.length === 0) {
    return 0;
  }

  return output.split(query).length - 1;
}

export function TerminalSearch({ output, onMatchChange }: TerminalSearchProps): ReactElement {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const matchCount = useMemo(() => countTerminalSearchMatches(output, query), [output, query]);
  const displayIndex = matchCount === 0 ? 0 : selectedIndex + 1;

  function updateSelection(nextIndex: number, total: number): void {
    const boundedIndex = total === 0 ? 0 : ((nextIndex % total) + total) % total;
    setSelectedIndex(boundedIndex);
    onMatchChange?.(boundedIndex, total);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setSelectedIndex(0);
    onMatchChange?.(0, countTerminalSearchMatches(output, nextQuery));
  }

  return (
    <section aria-label="终端搜索">
      <label>
        搜索终端输出
        <input aria-label="搜索终端输出" onChange={handleChange} value={query} />
      </label>
      <span>{displayIndex} / {matchCount}</span>
      <button type="button" onClick={() => updateSelection(selectedIndex - 1, matchCount)}>上一个</button>
      <button type="button" onClick={() => updateSelection(selectedIndex + 1, matchCount)}>下一个</button>
    </section>
  );
}
