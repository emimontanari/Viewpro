import { BRAND } from '@/lib/brand/brand';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  robots: {
    index: false
  }
};

export default function PrivacyPolicyPage() {
  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl space-y-8'>
        {/* Main Heading */}
        <h1 className='text-foreground text-3xl font-bold'>Política de privacidad</h1>

        {/* Introduction */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Introducción</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Esta política explica cómo cuidamos tu información personal cuando usás {BRAND.identity.productName}. Nuestro
            compromiso es proteger tu privacidad y ser claros sobre cómo usamos los datos necesarios
            para brindarte el servicio.
          </p>
        </section>

        {/* Data Collection */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Datos que recopilamos</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Recopilamos la información mínima necesaria para identificar tu cuenta, como nombre y
            email. Usamos esos datos para mostrarte las funciones que corresponden a tu uso de{' '}
            {BRAND.identity.productName}.
          </p>
        </section>

        {/* Auth handled by brand */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Acceso a la cuenta</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            {BRAND.identity.productName} protege el acceso a tu cuenta con cookies seguras. Esto evita guardar claves de
            acceso en el almacenamiento del navegador y permite que tu ingreso se mantenga entre
            visitas.
          </p>
        </section>

        {/* No data misuse */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Uso responsable</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            No vendemos ni alquilamos tus datos personales. Tu información se usa únicamente para
            brindar las funciones de {BRAND.identity.productName} y para acompañar la operación del servicio.
          </p>
        </section>

        {/* Data retention */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Conservación de datos</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            La información cargada en {BRAND.identity.productName} se conserva solo durante el tiempo necesario para
            prestar el servicio y dar soporte operativo. En pruebas o pilotos pueden aplicarse reglas
            específicas acordadas con el {BRAND.identity.teamPhraseEs}.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Contacto</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Si tenés preguntas o pedidos sobre esta política, contactá al {BRAND.identity.teamPhraseEs} por el
            canal de soporte acordado para tu cuenta.
          </p>
        </section>

        {/* Last Updated */}
        <div className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-sm'>Última actualización: febrero de 2026</p>
        </div>
      </div>
    </div>
  );
}
