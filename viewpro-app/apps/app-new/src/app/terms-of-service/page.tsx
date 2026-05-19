import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
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
          <h1 className='text-foreground text-3xl font-bold'>Terms of Service</h1>
          <p className='text-muted-foreground mt-2 text-sm'>Last updated: February 2026</p>
        </div>

        {/* Introduction */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Introduction</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Welcome to ViewPro. These Terms of Service govern your access to and use of the
            application. By accessing or using ViewPro, you agree to be bound by these terms. Please
            read them carefully before proceeding.
          </p>
        </section>

        {/* Preview Purpose */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Preview Purpose</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            This baseline version is provided for product evaluation while ViewPro-specific access
            and account flows are connected. It is not intended to replace a final production legal
            agreement.
          </p>
        </section>

        {/* Service Use */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Service Use</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Use ViewPro only for authorized business activity. Do not attempt to access accounts,
            properties, or information that you are not permitted to manage.
          </p>
        </section>

        {/* No Warranty */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>No Warranty</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            This application is provided &ldquo;as is&rdquo; without any warranties of any kind,
            either express or implied. We expressly disclaim all warranties, including but not
            limited to implied warranties of merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the application will be uninterrupted, timely,
            secure, or error-free.
          </p>
        </section>

        {/* Data Usage */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Data Usage</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            Any information you provide while using this baseline version may be temporary while the
            product is being configured. Do not enter sensitive or confidential information unless
            your ViewPro contact has confirmed that the environment is ready for it.
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className='text-foreground mb-3 text-xl font-semibold'>Changes to These Terms</h2>
          <p className='text-muted-foreground text-base leading-relaxed'>
            We reserve the right to modify or replace these Terms of Service at any time at our sole
            discretion. It is your responsibility to review these terms periodically for changes.
            Your continued use of the application following the posting of any changes constitutes
            acceptance of those changes.
          </p>
        </section>

        {/* Contact */}
        <section className='border-border border-t pt-4'>
          <p className='text-muted-foreground text-center text-sm'>
            If you have any questions about these Terms of Service, contact the ViewPro team through
            the support channel configured for your deployment.
          </p>
        </section>
      </div>
    </div>
  );
}
