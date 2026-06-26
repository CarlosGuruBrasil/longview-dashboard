'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  inputClassName?: string;
}

export default function PasswordInput({ className = '', inputClassName = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={inputClassName}
      />
      <button
        type="button"
        onClick={() => setVisible(current => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-zinc-500 transition-colors hover:text-zinc-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
