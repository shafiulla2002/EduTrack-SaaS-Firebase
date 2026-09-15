'use client';

import React, { useState, useEffect } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import {
  BookOpen,
  Calendar,
  Paperclip,
  CheckCircle,
  Clock,
  Upload,
  X,
  ShieldAlert,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Eye,
  FileText,
  File,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface PreviewState {
  attachmentsList: string[];
  currentIndex: number;
  url: string;
  blobUrl?: string;
  fileName: string;
  category: 'pdf' | 'image' | 'text' | 'unsupported';
  extension: string;
  rawText?: string;
  fileSizeStr?: string;
  loading: boolean;
  error: boolean;
}

export default function HomeworkPage() {
  const { selectedChild } = useParent();
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Submit modal states
  const [submittingHomework, setSubmittingHomework] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Preview Modal States
  const [previewAttachment, setPreviewAttachment] = useState<PreviewState | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isDownloading, setIsDownloading] = useState(false);

  // Lock body scroll and handle keyboard navigation (ESC, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (previewAttachment) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closePreview();
        } else if (e.key === 'ArrowLeft') {
          if (previewAttachment.currentIndex > 0) {
            handleNavAttachment(previewAttachment.currentIndex - 1);
          }
        } else if (e.key === 'ArrowRight') {
          if (previewAttachment.currentIndex < previewAttachment.attachmentsList.length - 1) {
            handleNavAttachment(previewAttachment.currentIndex + 1);
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [previewAttachment]);

  const closePreview = () => {
    if (previewAttachment?.blobUrl) {
      URL.revokeObjectURL(previewAttachment.blobUrl);
    }
    setPreviewAttachment(null);
    setZoomLevel(100);
    document.body.style.overflow = '';
  };

  const getFormattedFileSize = (att: string): string => {
    if (!att) return '';
    let bytes = 0;
    if (att.startsWith('data:')) {
      const base64Str = att.split(',')[1] || '';
      bytes = Math.round(base64Str.length * 0.75);
    } else {
      return '';
    }
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const loadAttachmentDetails = (attachmentsList: string[], index: number): PreviewState => {
    const att = attachmentsList[index] || '';
    let category: 'pdf' | 'image' | 'text' | 'unsupported' = 'unsupported';
    let extension = 'file';
    let blobUrl: string | undefined = undefined;
    let rawText: string | undefined = undefined;
    let error = false;
    const fileSizeStr = getFormattedFileSize(att);

    if (!att || att === '#') {
      return {
        attachmentsList,
        currentIndex: index,
        url: att,
        fileName: `Attachment File ${index + 1}`,
        category: 'unsupported',
        extension: 'file',
        fileSizeStr: '',
        loading: false,
        error: true,
      };
    }

    if (att.startsWith('data:')) {
      const mimeMatch = att.match(/^data:([a-zA-Z0-9-]+\/[a-zA-Z0-9-+.]+);base64,/);
      const mime = mimeMatch ? mimeMatch[1].toLowerCase() : '';
      extension = mime.split('/')[1] || 'file';

      try {
        const parts = att.split(';base64,');
        const contentType = parts[0].split(':')[1] || 'application/octet-stream';
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        blobUrl = URL.createObjectURL(blob);

        if (mime.includes('pdf')) {
          category = 'pdf';
        } else if (mime.includes('image')) {
          category = 'image';
        } else if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) {
          category = 'text';
          rawText = raw;
        } else {
          category = 'unsupported';
        }
      } catch (err) {
        console.error('Failed to parse base64 file:', err);
        error = true;
      }
    } else {
      const cleanUrl = att.split('?')[0].toLowerCase();
      if (cleanUrl.endsWith('.pdf')) {
        category = 'pdf';
        extension = 'pdf';
      } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanUrl)) {
        category = 'image';
        extension = cleanUrl.split('.').pop() || 'image';
      } else if (/\.(txt|csv|json|log|md)$/i.test(cleanUrl)) {
        category = 'text';
        extension = cleanUrl.split('.').pop() || 'txt';
      } else {
        category = 'unsupported';
        extension = cleanUrl.split('.').pop() || 'file';
      }
    }

    return {
      attachmentsList,
      currentIndex: index,
      url: att,
      blobUrl,
      fileName: `Attachment File ${index + 1}`,
      category,
      extension,
      rawText,
      fileSizeStr,
      loading: false,
      error,
    };
  };

  const handleOpenPreview = (attachmentsList: string[], index: number) => {
    if (!attachmentsList || attachmentsList.length === 0) return;
    setZoomLevel(100);
    const details = loadAttachmentDetails(attachmentsList, index);
    setPreviewAttachment(details);
  };

  const handleNavAttachment = (newIndex: number) => {
    if (!previewAttachment) return;
    if (newIndex < 0 || newIndex >= previewAttachment.attachmentsList.length) return;

    if (previewAttachment.blobUrl) {
      URL.revokeObjectURL(previewAttachment.blobUrl);
    }

    setZoomLevel(100);
    const details = loadAttachmentDetails(previewAttachment.attachmentsList, newIndex);
    setPreviewAttachment(details);
  };

  const handleDownloadAttachment = async (preview: PreviewState) => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      const targetUrl = preview.blobUrl || (preview.url.startsWith('http') || preview.url.startsWith('/uploads') ? preview.url : `http://${preview.url}`);
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = `${preview.fileName.replace(/\s+/g, '_')}.${preview.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 800);
    }
  };

  const fetchHomework = async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent-portal/children/${childId}/homework`);
      setHomeworkList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch homework:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChild) {
      fetchHomework(selectedChild.id);
    }
  }, [selectedChild]);

  // Listen to switcher events
  useEffect(() => {
    const handleChildChange = (e: any) => {
      fetchHomework(e.detail);
    };
    window.addEventListener('parentChildChanged', handleChildChange);
    return () => window.removeEventListener('parentChildChanged', handleChildChange);
  }, []);

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !submittingHomework || !uploadFile) return;
    
    setSubmitLoading(true);
    setMessage('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(uploadFile);
      reader.onload = async () => {
        const base64File = reader.result as string;
        try {
          await api.post(`/parent-portal/children/${selectedChild.id}/homework/${submittingHomework.id}/submit`, {
            base64File,
            fileName: uploadFile.name,
          });
          setMessage('Assignment submitted successfully!');
          fetchHomework(selectedChild.id);
          setTimeout(() => {
            setSubmittingHomework(null);
            setUploadFile(null);
            setMessage('');
          }, 1500);
        } catch (err) {
          console.error(err);
          setMessage('Failed to submit assignment. Please try again.');
          setSubmitLoading(false);
        }
      };
      reader.onerror = () => {
        setMessage('Failed to process submission attachment.');
        setSubmitLoading(false);
      };
    } catch (err) {
      console.error(err);
      setMessage('Failed to submit assignment.');
      setSubmitLoading(false);
    }
  };

  const formatDateDDMMYYYY = (dateStr: string) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view homework.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-t-[#2E5BFF] border-r-[#2E5BFF] border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in relative">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          Homework Desk: <span className="text-[#2E5BFF] font-extrabold">{selectedChild.name}</span>
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-light">Monitor pending and completed class assignments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {homeworkList.length === 0 ? (
          <div className="col-span-2 bg-white border border-slate-200 p-12 rounded-3xl text-center text-slate-500 shadow-sm">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold">No homework assigned yet.</p>
            <p className="text-xs font-light mt-1">Excellent! Your child is all caught up.</p>
          </div>
        ) : (
          homeworkList.map((hw: any) => (
            <div
              key={hw.id}
              className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all space-y-5"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-[#2E5BFF] font-black uppercase tracking-wider bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                      {hw.subject}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-2">Assigned by: {hw.teacher}</span>
                  </div>
                  
                  {hw.submitted ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {hw.submissionStatus}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      Pending
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-slate-700 text-sm leading-snug">{hw.title}</h3>
                  <p className="text-slate-500 text-xs font-normal leading-relaxed whitespace-pre-line">{hw.description}</p>
                </div>

                {hw.attachments && hw.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {hw.attachments.map((att: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleOpenPreview(hw.attachments, idx)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 hover:text-[#2E5BFF] hover:border-[#2E5BFF]/40 hover:bg-blue-50/40 transition-all cursor-pointer font-semibold"
                      >
                        <Paperclip className="w-3 h-3 text-[#2E5BFF]" />
                        Attachment File {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-slate-400">
                <span>Due Date: <strong className="text-slate-700 font-bold">{formatDateDDMMYYYY(hw.dueDate)}</strong></span>
                {hw.submitted ? (
                  <button
                    onClick={() => setSubmittingHomework(hw)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold tracking-wide hover:bg-slate-200 hover:text-slate-900 transition-all flex items-center gap-1.5 cursor-pointer text-[10px]"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    Edit / Update Submission
                  </button>
                ) : (
                  <button
                    onClick={() => setSubmittingHomework(hw)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2E5BFF] text-white font-bold tracking-wide hover:bg-blue-600 transition-all flex items-center gap-1.5 cursor-pointer text-[10px]"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Submit Work
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Submission Modal Dialog */}
      {submittingHomework && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 relative animate-scale-up space-y-4">
            <button
              onClick={() => {
                setSubmittingHomework(null);
                setUploadFile(null);
                setMessage('');
              }}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-800">
                {submittingHomework.submitted ? 'Edit / Update Submission' : 'Submit Assignment'}
              </h3>
              <p className="text-xs text-slate-400 font-light mt-0.5">{submittingHomework.title}</p>
            </div>

            {submittingHomework.submitted && !message && (
              <div className="p-3 bg-blue-50 border border-blue-100 text-blue-800 rounded-2xl text-xs font-semibold leading-relaxed flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Uploading a new file will replace your previously submitted work.</span>
              </div>
            )}

            {message && (
              <div className={`p-3 border rounded-2xl text-xs font-semibold leading-relaxed flex items-center gap-2 ${
                message.includes('successfully') 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                  : 'bg-rose-50 border-rose-100 text-rose-700'
              }`}>
                {message.includes('successfully') ? <CheckCircle className="w-4.5 h-4.5 shrink-0" /> : <ShieldAlert className="w-4.5 h-4.5 shrink-0" />}
                <span>{message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Attachment File (PDF, PNG, JPG, DOC, DOCX)
                </label>
                <div className="border border-dashed border-slate-200 hover:border-slate-350 bg-slate-50 rounded-2xl p-6 text-center transition-all relative cursor-pointer flex flex-col items-center justify-center">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                    }}
                    required
                  />
                  <Upload className="w-7 h-7 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 font-semibold block truncate max-w-[250px]">
                    {uploadFile ? uploadFile.name : 'Select or drag file to upload'}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-1">Maximum upload size: 5MB</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitLoading || !uploadFile}
                className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    {submittingHomework.submitted ? 'Updating Assignment...' : 'Uploading Assignment...'}
                  </>
                ) : (
                  submittingHomework.submitted ? 'Confirm & Update Work' : 'Confirm & Submit'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* In-App Homework Attachment Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 animate-fade-in"
          onClick={closePreview}
        >
          <div
            className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="flex flex-wrap justify-between items-center px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Navigation Buttons for multiple attachments */}
                {previewAttachment.attachmentsList.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => handleNavAttachment(previewAttachment.currentIndex - 1)}
                      disabled={previewAttachment.currentIndex === 0}
                      className="p-1 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      title="Previous Attachment (←)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 px-1">
                      {previewAttachment.currentIndex + 1} / {previewAttachment.attachmentsList.length}
                    </span>
                    <button
                      onClick={() => handleNavAttachment(previewAttachment.currentIndex + 1)}
                      disabled={previewAttachment.currentIndex === previewAttachment.attachmentsList.length - 1}
                      className="p-1 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                      title="Next Attachment (→)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 rounded-xl flex items-center justify-center text-[#2E5BFF] shrink-0">
                  {previewAttachment.category === 'pdf' ? (
                    <FileText className="w-5 h-5" />
                  ) : previewAttachment.category === 'image' ? (
                    <Eye className="w-5 h-5" />
                  ) : previewAttachment.category === 'text' ? (
                    <File className="w-5 h-5" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {previewAttachment.fileName}
                  </h3>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider block">
                    Type: {previewAttachment.category.toUpperCase()} ({previewAttachment.extension})
                    {previewAttachment.fileSizeStr ? ` • ${previewAttachment.fileSizeStr}` : ''}
                  </span>
                </div>
              </div>

              {/* Image Zoom Controls */}
              {previewAttachment.category === 'image' && !previewAttachment.loading && !previewAttachment.error && (
                <div className="flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-800/80 px-3 py-1.5 rounded-2xl border border-slate-300/40 dark:border-slate-700/40 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                    className="p-1 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="min-w-[40px] text-center text-[11px]">{zoomLevel}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(300, z + 25))}
                    className="p-1 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(100)}
                    className="p-1 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer ml-1 text-slate-500 dark:text-slate-400"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadAttachment(previewAttachment)}
                  disabled={isDownloading}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </>
                  )}
                </button>

                <button
                  onClick={closePreview}
                  className="p-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  title="Close Preview (ESC)"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 bg-slate-900/90 dark:bg-slate-950 flex items-center justify-center p-4 overflow-auto relative">
              {previewAttachment.loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-[#2E5BFF]" />
                  <span className="text-xs font-semibold">Fetching attachment preview...</span>
                </div>
              ) : previewAttachment.error ? (
                <div className="text-center p-8 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
                  <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldAlert className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">Failed to Load Attachment</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-light leading-relaxed">
                      An error occurred while attempting to render this attachment preview.
                    </p>
                  </div>
                  <button
                    onClick={() => handleNavAttachment(previewAttachment.currentIndex)}
                    className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry Loading
                  </button>
                </div>
              ) : previewAttachment.category === 'pdf' ? (
                <iframe
                  src={previewAttachment.blobUrl || (previewAttachment.url.startsWith('http') || previewAttachment.url.startsWith('/uploads') ? previewAttachment.url : `http://${previewAttachment.url}`)}
                  className="w-full h-full border-0 rounded-2xl bg-white shadow-md"
                  title={previewAttachment.fileName}
                />
              ) : previewAttachment.category === 'image' ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4 relative">
                  {/* Floating Prev / Next arrows over image */}
                  {previewAttachment.attachmentsList.length > 1 && (
                    <>
                      {previewAttachment.currentIndex > 0 && (
                        <button
                          onClick={() => handleNavAttachment(previewAttachment.currentIndex - 1)}
                          className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-xl transition-all cursor-pointer z-10"
                          title="Previous Attachment"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}
                      {previewAttachment.currentIndex < previewAttachment.attachmentsList.length - 1 && (
                        <button
                          onClick={() => handleNavAttachment(previewAttachment.currentIndex + 1)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-xl transition-all cursor-pointer z-10"
                          title="Next Attachment"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}
                  <img
                    src={previewAttachment.blobUrl || previewAttachment.url}
                    alt={previewAttachment.fileName}
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transition: 'transform 0.15s ease-out',
                    }}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-xl border border-slate-700/50"
                  />
                </div>
              ) : previewAttachment.category === 'text' ? (
                <pre className="w-full h-full p-6 bg-slate-950 text-slate-100 rounded-2xl overflow-auto text-xs font-mono whitespace-pre-wrap border border-slate-800">
                  {previewAttachment.rawText || 'Text file content unavailable for inline display.'}
                </pre>
              ) : (
                /* Unsupported File Preview Card */
                <div className="text-center p-8 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
                  <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/40 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">Preview Not Available</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-light leading-relaxed">
                      Inline preview is not supported for <strong className="font-semibold text-slate-700 dark:text-slate-200">.{previewAttachment.extension.toUpperCase()}</strong> files.
                      Please download the attachment to view it on your device.
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownloadAttachment(previewAttachment)}
                    disabled={isDownloading}
                    className="w-full py-3 bg-[#2E5BFF] hover:bg-blue-600 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
