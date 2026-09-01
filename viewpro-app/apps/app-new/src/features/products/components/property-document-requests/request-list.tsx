import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ReactNode } from 'react';
import type { DocumentRequestGroup } from './model';

type DocumentRequestSectionProps = {
  children: ReactNode;
  group: DocumentRequestGroup;
  onResolvedOpenChange: (open: boolean) => void;
  resolvedOpen: boolean;
};

export function DocumentRequestSection({
  children,
  group,
  onResolvedOpenChange,
  resolvedOpen
}: DocumentRequestSectionProps) {
  if (group.key === 'resolved') {
    return (
      <Collapsible open={resolvedOpen} onOpenChange={onResolvedOpenChange}>
        <div className='rounded-xl border bg-background/50'>
          <CollapsibleTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              className='h-auto w-full justify-between gap-3 rounded-xl px-4 py-3 text-left hover:no-underline'
            >
              <span className='flex min-w-0 flex-col items-start gap-0.5'>
                <span className='font-medium'>{group.title}</span>
                <span className='text-xs text-muted-foreground'>
                  {group.items.length} resueltas
                </span>
              </span>
              <Icons.chevronDown className='size-4 text-muted-foreground' />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>{children}</CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <section className='space-y-2' aria-labelledby={`document-section-${group.key}`}>
      <div data-testid={`document-section-heading-${group.key}`}>
        <h4 id={`document-section-${group.key}`} className='text-sm font-semibold'>
          {group.title}
        </h4>
      </div>
      {children}
    </section>
  );
}
