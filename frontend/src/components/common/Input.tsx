import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: string;
    helperText?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, icon, helperText, className = '', ...props }, ref) => {
        return (
            <div className="flex flex-col gap-2 w-full">
                {label && (
                    <label className="text-slate-700 dark:text-slate-300 text-sm font-semibold">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                            {icon}
                        </span>
                    )}
                    <input
                        ref={ref}
                        className={`w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent px-4 py-3 text-sm outline-none transition-all placeholder:text-slate-400 dark:text-white ${icon ? 'pl-10' : ''
                            } ${className}`}
                        {...props}
                    />
                </div>
                {helperText && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
