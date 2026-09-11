'use client';

import { useEffect, useRef, useState } from 'react';
import { isBffError } from '@/lib/bff-client';
import {
  useCreateSellerPropertyProposal,
  useSubmitSellerPropertyProposal,
  useUpdateSellerPropertyProposal
} from '../api/queries';
import type { SellerPropertyProposalDetail } from '../api/types';
import {
  propertyProposalDraftSchema,
  propertyProposalSubmitSchema,
  type PropertyProposalFormValues
} from '../schemas/property-proposal';
import { PropertyProposalStatusLabel } from './property-proposal-status-label';

type Props = { tenantId: string; proposal?: SellerPropertyProposalDetail };
const empty: PropertyProposalFormValues = {
  title: '',
  addressLine: '',
  city: '',
  province: '',
  propertyType: '',
  operationType: ''
};
function values(proposal?: SellerPropertyProposalDetail): PropertyProposalFormValues {
  return proposal
    ? {
        title: proposal.title,
        addressLine: proposal.addressLine ?? '',
        city: proposal.city ?? '',
        province: proposal.province ?? '',
        propertyType: proposal.propertyType ?? '',
        operationType: proposal.operationType ?? ''
      }
    : empty;
}
function errorCopy(cause: unknown) {
  return isBffError(cause) && cause.status === 409
    ? 'La propuesta cambió. Actualizá e intentá nuevamente.'
    : 'No se pudo guardar la propuesta.';
}
function saveFields(form: PropertyProposalFormValues, title: string) {
  return {
    title,
    addressLine: form.addressLine.trim() || null,
    city: form.city.trim() || null,
    province: form.province.trim() || null,
    propertyType: form.propertyType || null,
    operationType: form.operationType || null
  };
}

export function PropertyProposalForm({ tenantId, proposal: initialProposal }: Props) {
  const [proposal, setProposal] = useState(initialProposal),
    [form, setForm] = useState(() => values(initialProposal));
  const [error, setError] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [queued, setQueued] = useState<SellerPropertyProposalDetail | null>(null);
  const submitting = useRef(false),
    create = useCreateSellerPropertyProposal(tenantId),
    update = useUpdateSellerPropertyProposal(tenantId, proposal?.id ?? ''),
    submit = useSubmitSellerPropertyProposal(tenantId, proposal?.id ?? '');
  const set = (name: keyof PropertyProposalFormValues, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  useEffect(() => {
    if (!queued || proposal?.id !== queued.id || submitting.current) return;
    submitting.current = true;
    void submit
      .mutateAsync({ expectedVersion: queued.version })
      .then((response) => {
        setProposal(response);
        setForm(values(response));
      })
      .catch((cause) => setError(errorCopy(cause)))
      .finally(() => {
        submitting.current = false;
        setQueued(null);
        setPending(false);
      });
  }, [proposal?.id, queued, submit]);
  const run = async (action: 'save' | 'submit') => {
    if (pending) return;
    const parsed =
      action === 'save'
        ? propertyProposalDraftSchema.safeParse(form)
        : propertyProposalSubmitSchema.safeParse(form);
    if (!parsed.success)
      return setError(
        action === 'save' ? 'Ingresá un título válido.' : 'Completá los seis campos requeridos.'
      );
    setPending(true);
    setError(null);
    try {
      const fields = parsed.data;
      const saved = proposal
        ? await update.mutateAsync(
            action === 'save'
              ? { ...saveFields(form, fields.title), expectedVersion: proposal.version }
              : { ...fields, expectedVersion: proposal.version }
          )
        : await create.mutateAsync(action === 'save' ? { title: fields.title } : fields);
      setProposal(saved);
      setForm(values(saved));
      if (action === 'submit') setQueued(saved);
      else setPending(false);
    } catch (cause) {
      setError(errorCopy(cause));
      setPending(false);
    }
  };
  return (
    <form className='max-w-xl space-y-4' onSubmit={(event) => event.preventDefault()}>
      {proposal && <PropertyProposalStatusLabel state={proposal.state} />}
      {error && <p role='alert'>{error}</p>}
      <Field label='Título' value={form.title} onChange={(value) => set('title', value)} />
      <Field
        label='Dirección'
        value={form.addressLine}
        onChange={(value) => set('addressLine', value)}
      />
      <Field label='Ciudad' value={form.city} onChange={(value) => set('city', value)} />
      <Field label='Provincia' value={form.province} onChange={(value) => set('province', value)} />
      <Select
        label='Tipo de propiedad'
        value={form.propertyType}
        onChange={(value) => set('propertyType', value)}
        options={[
          ['HOUSE', 'Casa'],
          ['APARTMENT', 'Departamento'],
          ['LAND', 'Terreno'],
          ['COMMERCIAL', 'Comercial'],
          ['OTHER', 'Otro']
        ]}
      />
      <Select
        label='Operación'
        value={form.operationType}
        onChange={(value) => set('operationType', value)}
        options={[
          ['SALE', 'Venta'],
          ['RENT', 'Alquiler']
        ]}
      />
      <button type='button' disabled={pending} onClick={() => void run('save')}>
        Guardar borrador
      </button>
      <button type='button' disabled={pending} onClick={() => void run('submit')}>
        Enviar a revisión
      </button>
    </form>
  );
}
function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value=''>Seleccioná una opción</option>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
