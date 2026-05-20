import type { InfobarContent } from '@/components/ui/infobar';

export const workspacesInfoContent: InfobarContent = {
  title: 'Inmobiliarias',
  sections: [
    {
      title: 'Resumen',
      description:
        'Esta página permite ver las inmobiliarias disponibles para tu cuenta y cambiar entre ellas.',
      links: []
    },
    {
      title: 'Crear inmobiliarias',
      description:
        'La creación de nuevas inmobiliarias se conectará en una próxima etapa. Por ahora, el alta inicial se realiza al crear la cuenta.',
      links: []
    },
    {
      title: 'Cambiar inmobiliaria',
      description:
        'Podés cambiar entre inmobiliarias desde el selector del menú lateral.',
      links: []
    },
    {
      title: 'Funciones',
      description:
        'Cada inmobiliaria mantiene sus propios datos y configuración.',
      links: []
    },
    {
      title: 'Accesos',
      description:
        'Los accesos se validan para que cada persona vea únicamente lo que le corresponde.',
      links: []
    }
  ]
};

export const teamInfoContent: InfobarContent = {
  title: 'Equipo',
  sections: [
    {
      title: 'Resumen',
      description:
        'Esta página permitirá administrar integrantes, responsabilidades y ajustes del equipo.',
      links: []
    },
    {
      title: 'Personas del equipo',
      description:
        'Desde esta sección vas a poder sumar, quitar y organizar a las personas que trabajan en tu inmobiliaria.',
      links: []
    },
    {
      title: 'Responsabilidades',
      description:
        'Cada persona podrá tener responsabilidades distintas según su tarea dentro de la inmobiliaria.',
      links: []
    },
    {
      title: 'Seguridad',
      description:
        'Los ajustes de seguridad ayudan a proteger la información y el acceso de tu equipo.',
      links: []
    },
    {
      title: 'Datos de la inmobiliaria',
      description:
        'Vas a poder ajustar datos generales como nombre, imagen y preferencias de uso.',
      links: []
    },
    {
      title: 'Menú y accesos',
      description:
        'El menú muestra las secciones disponibles para cada persona según su acceso.',
      links: []
    }
  ]
};

export const billingInfoContent: InfobarContent = {
  title: 'Facturación y planes',
  sections: [
    {
      title: 'Resumen',
      description:
        'Esta página permitirá administrar la suscripción y los límites de uso de tu inmobiliaria.',
      links: []
    },
    {
      title: 'Planes disponibles',
      description:
        'Próximamente vas a poder ver y elegir planes desde esta sección.',
      links: []
    },
    {
      title: 'Funciones del plan',
      description:
        'Cada plan podrá habilitar funciones específicas dentro de ViewPro.',
      links: []
    },
    {
      title: 'Acceso',
      description:
        'Algunas secciones podrán depender del plan contratado.',
      links: []
    },
    {
      title: 'Costos',
      description:
        'Los detalles comerciales se definirán antes de habilitar la facturación dentro del producto.',
      links: []
    },
    {
      title: 'Configuración',
      description:
        'La configuración de facturación se completará en una próxima etapa.',
      links: []
    },
    {
      title: 'Estado',
      description:
        'La facturación todavía no está disponible en esta versión.',
      links: []
    }
  ]
};

export const productInfoContent: InfobarContent = {
  title: 'Propiedades',
  sections: [
    {
      title: 'Resumen',
      description:
        'Esta página muestra las propiedades en gestión de la inmobiliaria seleccionada. Los datos se obtienen del backend de property engagements.',
      links: []
    },
    {
      title: 'Nueva propiedad',
      description:
        'El alta crea una gestión de propiedad con título, dirección, tipo de propiedad, operación, precio publicado y datos básicos del propietario.',
      links: []
    },
    {
      title: 'Edición',
      description:
        'La edición y eliminación todavía no están soportadas por el backend. Por ahora el detalle de una propiedad existente es de solo lectura.',
      links: []
    },
    {
      title: 'Filtros',
      description:
        'El listado usa paginación del backend y permite filtrar por operación y estado cuando el backend recibe esos parámetros.',
      links: []
    },
    {
      title: 'Tenant activo',
      description:
        'Todas las solicitudes de esta sección usan la inmobiliaria activa mediante el header x-tenant-id.',
      links: []
    }
  ]
};
