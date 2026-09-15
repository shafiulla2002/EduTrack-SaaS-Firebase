import React, { useState, useEffect } from 'react';

interface StudentAvatarProps {
  studentName: string;
  profilePhotoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
  return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-50 text-blue-600 border-blue-100',
    'bg-indigo-50 text-indigo-600 border-indigo-100',
    'bg-purple-50 text-purple-600 border-purple-100',
    'bg-pink-50 text-pink-600 border-pink-100',
    'bg-teal-50 text-teal-600 border-teal-100',
    'bg-emerald-50 text-emerald-600 border-emerald-100',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getStudentPhotoUrl = (url: string | null | undefined) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `/api${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function StudentAvatar({ studentName, profilePhotoUrl, size = 'sm', className = '' }: StudentAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Reset the error state if the URL changes (e.g. photo updated)
  useEffect(() => {
    setHasError(false);
  }, [profilePhotoUrl]);

  let sizeClasses = 'w-10 h-10 text-xs';
  if (size === 'md') {
    sizeClasses = 'w-12 h-12 text-sm';
  } else if (size === 'lg') {
    sizeClasses = 'w-14 h-14 text-base';
  }

  if (profilePhotoUrl && !hasError) {
    return (
      <img
        src={getStudentPhotoUrl(profilePhotoUrl)}
        alt={studentName}
        className={`${sizeClasses} rounded-full object-cover border border-slate-200 shadow-xs shrink-0 ${className}`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full flex items-center justify-center font-bold border select-none shrink-0 ${getAvatarColor(studentName)} shadow-xs ${className}`}>
      {getInitials(studentName)}
    </div>
  );
}
