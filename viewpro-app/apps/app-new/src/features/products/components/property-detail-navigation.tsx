import Link from 'next/link';

const groups = [
  ['Datos e imágenes', '#property-data-images'],
  ['Personas', '#property-people'],
  ['Actividad', '#property-activity'],
  ['Documentos', '#property-documents']
] as const;

export function PropertyDetailNavigation() {
  return (
    <nav aria-label='Secciones de la propiedad' className='flex flex-wrap gap-2 border-b pb-4'>
      {groups.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className='rounded-full border px-3 py-2 text-sm font-medium underline-offset-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
