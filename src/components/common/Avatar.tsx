import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = React.useState(false);

  // Reset error state whenever the image source changes
  React.useEffect(() => {
    setImageError(false);
  }, [src]);

  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base font-bold',
    xl: 'w-20 h-20 text-xl font-bold',
  };

  const getInitials = (n: string) => {
    if (!n) return '?';
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  // Color generator based on name hash
  const getGradient = (n: string) => {
    const gradients = [
      'from-teal-500 to-[#203D62]',
      'from-[#F36B2C] to-[#F5A623]',
      'from-[#203D62] to-[#60BCE8]',
      'from-purple-500 to-indigo-600',
      'from-emerald-500 to-teal-700',
    ];
    let hash = 0;
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  };

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
        className={`${sizes[size]} rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-gradient-to-br ${getGradient(
        name
      )} text-white flex items-center justify-center font-bold tracking-wider border-2 border-white dark:border-slate-800 shadow-sm flex-shrink-0 ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};
