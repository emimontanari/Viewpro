'use client';

import { Icons } from '@/components/icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { movementOutcomeLabelsOptions } from '../api/queries';
import type { MovementOutcomeLabelDto, MovementBuiltInOutcome } from '../api/types';
import { movementBuiltInOutcomeOptions } from '../constants/movement-outcome-options';
import { MovementOutcomeCreateLabelForm } from './movement-outcome-create-label-form';

type ComboboxValue =
  | { type: 'builtIn'; value: MovementBuiltInOutcome }
  | { type: 'custom'; labelId: string };

function encodeValue(v: ComboboxValue): string {
  return v.type === 'builtIn' ? `builtIn:${v.value}` : `custom:${v.labelId}`;
}

function getDisplayLabel(
  value: string | null,
  customLabels: MovementOutcomeLabelDto[]
): string {
  if (!value) return 'Seleccioná un resultado';
  if (value.startsWith('builtIn:')) {
    const key = value.replace('builtIn:', '') as MovementBuiltInOutcome;
    return (
      movementBuiltInOutcomeOptions.find((opt) => opt.value === key)?.label ?? key
    );
  }
  if (value.startsWith('custom:')) {
    const labelId = value.replace('custom:', '');
    return customLabels.find((l) => l.id === labelId)?.label ?? 'Etiqueta personalizada';
  }
  return 'Seleccioná un resultado';
}

type Props = {
  /** Encoded value: "builtIn:<ENUM>" | "custom:<uuid>" | null */
  value: string | null;
  onChange: (value: string | null) => void;
  canCreateLabel: boolean;
  disabled?: boolean;
};

/**
 * Combobox for selecting a movement outcome.
 *
 * Sections:
 *   1. Built-in outcomes (always visible)
 *   2. Active custom labels for the tenant
 *   3. "+ Agregar etiqueta" action (only when canCreateLabel is true)
 *
 * Accessibility:
 *   - trigger button has role="combobox" and aria-label="Resultado del movimiento"
 *   - aria-expanded reflects open state
 *   - focus trap and keyboard nav are handled by Radix Popover + list role
 */
export function MovementOutcomeCombobox({ value, onChange, canCreateLabel, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const addLabelButtonRef = useRef<HTMLButtonElement>(null);
  const labelsQuery = useQuery(movementOutcomeLabelsOptions({ activeOnly: true }));
  const customLabels = labelsQuery.data ?? [];

  function handleSelect(encoded: string) {
    onChange(encoded === value ? null : encoded);
    setOpen(false);
    setShowCreateForm(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setShowCreateForm(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type='button'
          role='combobox'
          aria-expanded={open}
          aria-label='Resultado del movimiento'
          aria-controls='movement-outcome-listbox'
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground'
          )}
        >
          <span className='truncate'>{getDisplayLabel(value, customLabels)}</span>
          <Icons.chevronsUpDown className='ml-2 size-4 shrink-0 opacity-50' />
        </button>
      </PopoverTrigger>

      <PopoverContent
        id='movement-outcome-listbox'
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
      >
        <div className='max-h-64 overflow-y-auto'>
          {/* Section: Built-in outcomes */}
          <div
            className='px-2 py-1.5 text-xs font-semibold text-muted-foreground'
            role='presentation'
          >
            Sugeridos
          </div>
          <ul role='listbox' aria-label='Resultados sugeridos'>
            {movementBuiltInOutcomeOptions.map((opt) => {
              const encoded = encodeValue({ type: 'builtIn', value: opt.value });
              return (
                <li key={opt.value} role='option' aria-selected={value === encoded}>
                  <button
                    type='button'
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                      value === encoded && 'bg-accent font-medium'
                    )}
                    onClick={() => handleSelect(encoded)}
                  >
                    {value === encoded ? (
                      <Icons.check className='size-4' />
                    ) : (
                      <span className='size-4' />
                    )}
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Section: Custom tenant labels */}
          {customLabels.length > 0 ? (
            <>
              <div
                className='mt-1 border-t px-2 py-1.5 text-xs font-semibold text-muted-foreground'
                role='presentation'
              >
                De tu inmobiliaria
              </div>
              <ul role='listbox' aria-label='Etiquetas de la inmobiliaria'>
                {customLabels.map((label) => {
                  const encoded = encodeValue({ type: 'custom', labelId: label.id });
                  return (
                    <li key={label.id} role='option' aria-selected={value === encoded}>
                      <button
                        type='button'
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
                          value === encoded && 'bg-accent font-medium'
                        )}
                        onClick={() => handleSelect(encoded)}
                      >
                        {value === encoded ? (
                          <Icons.check className='size-4' />
                        ) : (
                          <span className='size-4' />
                        )}
                        {label.color ? (
                          <span
                            className='size-3 rounded-full'
                            style={{ backgroundColor: label.color }}
                            aria-hidden='true'
                          />
                        ) : null}
                        {label.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {/* Action: Add label */}
          {canCreateLabel ? (
            <div className='border-t p-2'>
              {showCreateForm ? (
                <MovementOutcomeCreateLabelForm
                  onCreated={(newLabel) => {
                    const encoded = encodeValue({ type: 'custom', labelId: newLabel.id });
                    onChange(encoded);
                    setOpen(false);
                    setShowCreateForm(false);
                  }}
                  onCancel={() => {
                    setShowCreateForm(false);
                    // Return focus to the trigger button on close.
                    addLabelButtonRef.current?.focus();
                  }}
                />
              ) : (
                <button
                  ref={addLabelButtonRef}
                  type='button'
                  className='flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-primary hover:bg-accent hover:text-accent-foreground'
                  onClick={() => setShowCreateForm(true)}
                >
                  <Icons.add className='size-4' />
                  + Agregar etiqueta
                </button>
              )}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
