import { useState, useEffect } from 'react';

interface UserAvatarProps {
  userId: string;
  username: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export function UserAvatar({ userId, username, size = 'md', onClick, className = '' }: UserAvatarProps) {
  const [hasAvatar, setHasAvatar] = useState(true);
  const [avatarKey, setAvatarKey] = useState(Date.now());

  // Construct avatar URL
  const avatarUrl = `/api/profile/avatar/${userId}?t=${avatarKey}`;

  // Reset avatar state when userId changes
  useEffect(() => {
    setHasAvatar(true);
    setAvatarKey(Date.now());
  }, [userId]);

  const handleError = () => {
    setHasAvatar(false);
  };

  // Also fallback if the image loads but is a tiny placeholder (1x1 pixel)
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    // If natural dimensions are 1x1, it's the transparent placeholder
    if (img.naturalWidth === 1 && img.naturalHeight === 1) {
      setHasAvatar(false);
    }
  };

  const baseClasses = `rounded-full overflow-hidden flex items-center justify-center ${sizeClasses[size]} ${className}`;
  const interactiveClasses = onClick
    ? 'cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 dark:hover:ring-offset-gray-800 transition-all'
    : '';

  // Use button only when onClick is provided, otherwise use div to avoid nested button issues
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? { type: 'button' as const, onClick }
    : {};

  if (hasAvatar) {
    return (
      <Wrapper
        {...wrapperProps}
        className={`${baseClasses} ${interactiveClasses}`}
        title={username}
      >
        <img
          src={avatarUrl}
          alt={`${username}'s avatar`}
          className="w-full h-full object-cover"
          onError={handleError}
          onLoad={handleLoad}
        />
      </Wrapper>
    );
  }

  // Fallback: show user icon with initials background
  const initial = username.charAt(0).toUpperCase();

  return (
    <Wrapper
      {...wrapperProps}
      className={`${baseClasses} ${interactiveClasses} bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400`}
      title={username}
    >
      <span className="text-xs font-medium">{initial}</span>
    </Wrapper>
  );
}
