'use client';

import { BRAND } from '@/lib/brand/brand';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { InteractiveGridPattern } from './interactive-grid';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='relative flex min-h-screen flex-col items-center justify-center overflow-hidden md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-sidebar' />
        <div className='relative z-20 flex items-center'>
          <Image
            src='/logo-theme-claro.png'
            alt={BRAND.auth.signInLabel}
            width={2048}
            height={1365}
            priority
            className='h-auto w-48 dark:hidden'
          />
          <Image
            src='/logo-inmoview-dark.png'
            alt={BRAND.auth.signInLabel}
            width={2048}
            height={1365}
            priority
            className='hidden h-auto w-48 dark:block'
          />
        </div>
        <InteractiveGridPattern
          className={cn(
            'mask-[radial-gradient(400px_circle_at_center,white,transparent)]',
            'inset-x-0 inset-y-[0%] h-full skew-y-12'
          )}
        />
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-xl flex-col items-center justify-center space-y-6'>
          {children}
        </div>
      </div>
    </div>
  );
}
