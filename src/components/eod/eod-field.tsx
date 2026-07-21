'use client'

interface EodFieldBaseProps {
  label: string
  sectionKey: string
  fieldKey: string
  value: unknown
  onChange: (sectionKey: string, fieldKey: string, value: unknown) => void
}

interface EodNumberFieldProps extends EodFieldBaseProps {
  type: 'number'
}

interface EodTextFieldProps extends EodFieldBaseProps {
  type: 'text'
  placeholder?: string
}

interface EodTextareaFieldProps extends EodFieldBaseProps {
  type: 'textarea'
  placeholder?: string
  rows?: number
}

interface EodRadioFieldProps extends EodFieldBaseProps {
  type: 'radio'
  options?: { label: string; value: string }[]
}

type EodFieldProps = EodNumberFieldProps | EodTextFieldProps | EodTextareaFieldProps | EodRadioFieldProps

export function EodField(props: EodFieldProps) {
  const { label, sectionKey, fieldKey, value, onChange, type } = props

  const handleChange = (v: unknown) => onChange(sectionKey, fieldKey, v)

  const inputClass =
    'w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent-700 transition-shadow duration-[120ms]'

  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </label>

      {type === 'number' && (
        <input
          type="number"
          min={0}
          value={typeof value === 'number' ? value : ''}
          onChange={e => handleChange(e.target.value === '' ? '' : Number(e.target.value))}
          className={`mt-1.5 ${inputClass}`}
        />
      )}

      {type === 'text' && (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={(props as EodTextFieldProps).placeholder}
          className={`mt-1.5 ${inputClass}`}
        />
      )}

      {type === 'textarea' && (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={e => handleChange(e.target.value)}
          placeholder={(props as EodTextareaFieldProps).placeholder}
          rows={(props as EodTextareaFieldProps).rows ?? 3}
          className={`mt-1.5 ${inputClass} resize-none`}
        />
      )}

      {type === 'radio' && (
        <div className="mt-1.5 flex gap-3">
          {((props as EodRadioFieldProps).options ?? [
            { label: 'Ja', value: 'ja' },
            { label: 'Nee', value: 'nee' },
          ]).map(opt => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors duration-[120ms] text-sm font-medium ${
                value === opt.value
                  ? 'border-accent-700 bg-accent-50 text-accent-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={`${sectionKey}.${fieldKey}`}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => handleChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
