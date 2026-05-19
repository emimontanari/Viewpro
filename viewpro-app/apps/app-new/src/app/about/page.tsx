import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About'
};

export default function AboutPage() {
  return (
    <div className='min-h-screen px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-3xl'>
        {/* Header */}
        <div className='mb-12 text-center'>
          <h1 className='text-foreground text-3xl font-bold tracking-tight sm:text-4xl'>
            About ViewPro
          </h1>
          <p className='text-muted-foreground mt-4 text-lg'>A daily panel for real estate teams.</p>
        </div>

        {/* Content Sections */}
        <div className='space-y-8'>
          {/* ViewPro Section */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>ViewPro</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              ViewPro helps real estate teams organize properties, contacts, tasks, and follow-up in
              one place so daily work stays clear and consistent.
            </p>
          </section>

          {/* Product Purpose Section */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>Product Purpose</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              The interface is being prepared for ViewPro-specific access, data, and daily work
              flows. Each follow-up change should keep the imported layout stable while connecting
              real product behavior.
            </p>
          </section>

          {/* Auth Section */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>Secure Access</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              Account access is handled through secure sign-in flows. ViewPro-specific access rules
              will be connected in a dedicated follow-up change.
            </p>
          </section>

          {/* Data Privacy Section */}
          <section className='bg-card rounded-2xl border p-8 shadow-sm'>
            <h2 className='text-foreground mb-4 text-xl font-semibold'>Data Privacy</h2>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              We take your privacy seriously. No personal data is misused, shared, or sold to third
              parties. Information collected while using ViewPro is used to provide the service and
              support the setup configured for your team.
            </p>
          </section>
        </div>

        {/* Footer Note */}
        <div className='mt-12 text-center'>
          <p className='text-muted-foreground text-sm'>Built for ViewPro teams.</p>
        </div>
      </div>
    </div>
  );
}
