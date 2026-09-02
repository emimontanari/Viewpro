import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

type PropertyTablePaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PropertyTablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange
}: PropertyTablePaginationProps) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className='flex flex-col gap-3 rounded-2xl border bg-background p-3 text-sm text-muted-foreground shadow-xs sm:flex-row sm:items-center sm:justify-between'>
      <span>
        Mostrando {firstItem}-{lastItem} de {total}
      </span>
      <div className='flex items-center justify-between gap-2 sm:justify-end'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icons.chevronLeft className='size-4' /> Anterior
        </Button>
        <span className='min-w-20 text-center text-xs font-medium'>
          Página {page} de {pageCount}
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente <Icons.chevronRight className='size-4' />
        </Button>
      </div>
    </div>
  );
}
