import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon' | 'control';
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  size = 'md',
  className = '', 
  ...props 
}) => {
  const baseStyles = "rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-4 text-base",
    xl: "w-20 h-20" // Circular play button size
  };

  const variants = {
    primary: "bg-primary text-slate-900 hover:bg-primary-hover shadow-lg shadow-amber-500/10",
    secondary: "bg-surface text-slate-200 border border-white/5 hover:bg-surface-light",
    danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
    ghost: "bg-transparent text-slate-400 hover:text-white hover:bg-white/5",
    icon: "p-2.5 bg-surface text-slate-400 hover:text-white hover:bg-surface-light border border-white/5 rounded-full aspect-square",
    control: "p-4 bg-surface text-slate-300 hover:text-white hover:bg-surface-light border border-white/5 rounded-full aspect-square"
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};