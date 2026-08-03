import { BRAND } from '@/lib/brand/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos del servicio',
  robots: {
    index: false
  }
};

export default function TermsOfServicePage() {
  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl space-y-8'>
        {/* Main Heading */}
        <div className='text-center'>
          <h1 className='text-foreground text-3xl font-bold'>Términos del servicio</h1>
          <p className='text-muted-foreground mt-2 text-sm'>
            Última actualización: agosto de 2026
          </p>
        </div>

        {/* Introduction */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Introducción</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Estos Términos del servicio regulan el acceso y el uso de {BRAND.identity.productName}.
            Al acceder o usar la aplicación, aceptás quedar sujeto a estos términos. Te pedimos que
            los leas con atención antes de continuar.
          </p>
        </section>

        {/* Service Use */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Uso del servicio</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Usá {BRAND.identity.productName} únicamente para la actividad comercial autorizada. No
            intentes acceder a cuentas, propiedades o información que no tengas permitido gestionar.
          </p>
        </section>

        {/* Data Usage */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Uso de los datos</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            La información que cargás se almacena para prestarte el servicio y se trata según
            nuestra política de privacidad. Cada inmobiliaria accede solamente a sus propios datos.
          </p>
        </section>

        {/* No Warranty */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Sin garantías</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            La aplicación se provee &ldquo;tal cual&rdquo;, sin garantías de ningún tipo, expresas o
            implícitas. Renunciamos expresamente a toda garantía, incluidas las garantías implícitas
            de comerciabilidad, aptitud para un fin determinado y no infracción. No garantizamos que
            la aplicación funcione de forma ininterrumpida, puntual, segura o libre de errores.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Cambios en estos términos</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Nos reservamos el derecho de modificar o reemplazar estos Términos del servicio en
            cualquier momento y a nuestro criterio. Es tu responsabilidad revisarlos periódicamente.
            El uso continuado de la aplicación después de publicarse un cambio implica la aceptación
            de ese cambio.
          </p>
        </section>

        {/* Contact */}
        <section className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-center text-sm'>
            Si tenés dudas sobre estos Términos del servicio, escribile al{' '}
            {BRAND.identity.teamPhraseEs} por el canal de soporte de tu cuenta.
          </p>
        </section>
      </div>
    </div>
  );
}
