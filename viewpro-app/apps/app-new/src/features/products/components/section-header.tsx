import type { Icon } from '@/components/icons';

export function SectionHeader({
  description,
  headingLevel = 3,
  icon: Icon,
  label
}: {
  description?: string;
  headingLevel?: 3 | 4;
  icon?: Icon;
  label: string;
}) {
  const labelContent = (
    <>
      {Icon ? <Icon aria-hidden='true' className='size-4' /> : null}
      <span>{label}</span>
    </>
  );
  const labelClassName =
    'flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase';

  return (
    <div className='space-y-1'>
      {headingLevel === 4 ? (
        <h4 className={labelClassName}>{labelContent}</h4>
      ) : (
        <h3 className={labelClassName}>{labelContent}</h3>
      )}
      {description ? <p className='text-sm text-foreground/70'>{description}</p> : null}
    </div>
  );
}
