import type { ActionImpl } from 'kbar';
import { KBarResults, useMatches } from 'kbar';
import { useCallback } from 'react';
import ResultItem from './result-item';

type RenderParams = {
  active: boolean;
  item: ActionImpl | string;
};

export default function RenderResults() {
  const { results, rootActionId } = useMatches();
  const renderResult = useCallback(
    ({ item, active }: RenderParams) =>
      typeof item === 'string' ? (
        <div className='text-muted-foreground px-4 py-2 text-sm uppercase'>{item}</div>
      ) : (
        <ResultItem action={item} active={active} currentRootActionId={rootActionId ?? ''} />
      ),
    [rootActionId]
  );

  return <KBarResults items={results} onRender={renderResult} />;
}
