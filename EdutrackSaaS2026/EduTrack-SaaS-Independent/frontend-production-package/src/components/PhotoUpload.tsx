import React, { useRef, useState, useEffect } from 'react';
import { Camera, Trash2, UploadCloud, AlertCircle } from 'lucide-react';

interface PhotoUploadProps {
  value?: string | null;
  onChange: (base64: string | null) => void;
  className?: string;
}

export default function PhotoUpload({ value, onChange, className = '' }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  useEffect(() => {
    setPreview(value || null);
    setImageLoadError(false);
  }, [value]);

  const validateAndProcessFile = (file: File) => {
    setError(null);
    setImageLoadError(false);
    
    // 1. Format Validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, JPEG, PNG, and WEBP image formats are supported.');
      return;
    }

    // 2. Size Validation (2MB = 2 * 1024 * 1024 bytes)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image file size must be less than 2MB.');
      return;
    }

    // 3. Image Compression & Resizing (512x512)
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setError('Failed to process image helper canvas context.');
          return;
        }

        // Set dimensions to 512x512
        canvas.width = 512;
        canvas.height = 512;

        // Calculate aspect-ratio cropping (center-crop)
        const size = Math.min(img.width, img.height);
        const sourceX = (img.width - size) / 2;
        const sourceY = (img.height - size) / 2;

        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          size,
          size, // Source dimensions
          0,
          0,
          512,
          512 // Destination dimensions
        );

        // Convert canvas to base64 jpeg data URL
        const base64Data = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(base64Data);
        setImageLoadError(false);
        onChange(base64Data);
      };
      img.onerror = () => {
        setError('Failed to load image file.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreview(null);
    setError(null);
    setImageLoadError(false);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to map paths to backend proxy / absolute urls if local relative path
  const getDisplayUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Proxied relative backend URL
    return `/api${url.startsWith('/') ? '' : '/'}${url}`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />

      {preview ? (
        <div className="flex items-center gap-5">
          <div className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-slate-200 shadow-md">
            {preview && !imageLoadError ? (
              <img
                src={getDisplayUrl(preview)}
                alt="Profile Preview"
                className="w-full h-full object-cover"
                onError={() => {
                  setImageLoadError(true);
                  setError('Failed to load the uploaded profile photo.');
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-400">
                <Camera className="w-8 h-8" />
              </div>
            )}
            <button
              type="button"
              onClick={handleSelectClick}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold cursor-pointer"
            >
              <Camera className="w-5 h-5 mb-1" />
              Change Photo
            </button>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-800">Profile Photo Uploaded</h4>
            <p className="text-[11px] text-slate-400 font-medium">JPG, PNG, or WEBP (Max 2MB). Auto-resized to 512x512 px.</p>
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300 transition-all text-xs font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove Photo
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleSelectClick}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
            dragActive
              ? 'border-brand-500 bg-brand-50/10'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-200/50">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-700 block">Upload Student Photo</span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">Drag & drop or click to browse</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl leading-relaxed">
          <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
