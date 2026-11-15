import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'teal';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none';

  const variants = {
    primary:
      'bg-[#16AA88] hover:bg-[#128f73] text-white shadow-md shadow-teal-500/20 focus:ring-teal-500',
    secondary:
      'bg-[#203D62] hover:bg-[#182e4a] text-white shadow-md shadow-navy-900/20 focus:ring-[#203D62]',
    teal:
      'bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/20 focus:ring-teal-500',
    outline:
      'border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-slate-400',
    danger:
      'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 focus:ring-rose-500',
    ghost:
      'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-slate-400',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : (
        leftIcon && <span className="flex-shrink-0 inline-flex items-center">{leftIcon}</span>
      )}
      <span className="inline-flex items-center">{children}</span>
      {!isLoading && rightIcon && (
        <span className="flex-shrink-0 inline-flex items-center">{rightIcon}</span>
      )}
    </button>
  );
};
