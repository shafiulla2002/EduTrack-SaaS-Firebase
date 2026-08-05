'use client';

import React, { useState, useRef } from 'react';
import { Download, Upload, CheckCircle, AlertCircle, RefreshCw, X, FileText, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedCount: number) => void;
}

interface ParsedRecord {
  [key: string]: string;
}

export default function BulkImportModal({ isOpen, onClose, onImportSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<ParsedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templateHeaders = [
    'First Name', 'Last Name', 'Father Name', 'Mother Name', 'DOB',
    'Phone', 'Email', 'Aadhar No', 'Village', 'City', 'Pincode',
    'State', 'Country', 'Class', 'Section', 'Academic Year'
  ];

  // Triggers template download
  const handleDownloadTemplate = () => {
    const csvContent = templateHeaders.join(',') + '\n' +
      'Rohan,Sharma,Vijay Sharma,Sunita Sharma,2011-04-12,9876543210,rohan.sharma@example.com,123456789012,Rohini,New Delhi,110085,Delhi,India,Grade 10,Section A,2026-2027\n' +
      'Anjali,Verma,Rajesh Verma,Anita Verma,2012-08-22,9998887776,anjali.v@example.com,987654321098,Pitampura,New Delhi,110034,Delhi,India,Grade 9,Section B,2026-2027';

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', 'EduTrack_Student_Import_Template.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // CSV Parsing logic
  const parseCSV = (text: string) => {
    try {
      const lines = text.split(/\r\n|\n/);
      if (lines.length === 0 || !lines[0].trim()) {
        alert('CSV file is empty.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      // Basic check for templates headers matching
      const hasCorrectHeaders = templateHeaders.every(h => headers.includes(h));
      if (!hasCorrectHeaders) {
        alert('Invalid CSV template format. Please download and use the official template.');
        return;
      }

      const rows: ParsedRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const currentLine = line.split(',');
        const obj: ParsedRecord = {};
        
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = currentLine[j] ? currentLine[j].trim() : '';
        }
        rows.push(obj);
      }

      if (rows.length === 0) {
        alert('No data rows found in CSV.');
        return;
      }

      setParsedData(rows);
      setStep(2);
    } catch (err) {
      alert('Error parsing CSV file: ' + (err as Error).message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      parseCSV(reader.result as string);
    };
    reader.readAsText(file);
  };

  // Run validations and upload via backend API
  const handleConfirmImport = async () => {
    setStep(3);
    setIsProcessing(true);
    setErrors([]);

    try {
      const response = await api.post('/students/import', { students: parsedData });
      const { successCount, errors } = response.data;
      
      setSuccessCount(successCount || 0);
      setErrors(errors || []);
      
      if (successCount > 0) {
        onImportSuccess(successCount);
      }
    } catch (err: any) {
      console.error('Students bulk import error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Server failed to process bulk import';
      setErrors([`Critical Error: ${errMsg}`]);
      setSuccessCount(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDone = () => {
    setStep(1);
    setFileName('');
    setParsedData([]);
    setSuccessCount(0);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleBack = () => {
    setStep(1);
    setFileName('');
    setParsedData([]);
    setErrors([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDone}
      title="Bulk Student Import"
      subtitle="Import student rosters in bulk via official CSV template"
      size="2xl"
    >
      <div className="space-y-6">
        {/* STEP 1: UPLOAD ZONE */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
              Import student rosters in bulk. Download the official CSV templates layout, fill in personal &amp; registration information, and re-upload the file.
            </div>

            <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 text-[#2E5BFF] flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-slate-900 dark:text-white">Upload Filled CSV Template</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">Accepts UTF-8 formatted CSV rosters only</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[13px] shadow-xs cursor-pointer"
              >
                Select CSV File
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[12px] text-slate-400 font-semibold uppercase tracking-wider">Instructions</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white font-semibold text-[13px] flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download CSV Template
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIRM DATA ROWS */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">Confirm Data Import</h3>
              <p className="text-[13px] text-slate-600 dark:text-slate-400">
                We parsed <strong>{parsedData.length}</strong> record rows from <strong>{fileName}</strong>.
              </p>
            </div>

            {/* Sample grid preview */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-slate-50/50 dark:bg-slate-900/50">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Roster Preview (First 3 rows)
              </div>
              <div className="overflow-x-auto max-h-[160px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[11px] text-slate-400 uppercase">
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Class</th>
                      <th className="px-4 py-2">Father Name</th>
                      <th className="px-4 py-2">Aadhar No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px] text-slate-700 dark:text-slate-300">
                    {parsedData.slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">
                          {row['First Name']} {row['Last Name']}
                        </td>
                        <td className="px-4 py-2">{row['Class']} - {row['Section']}</td>
                        <td className="px-4 py-2">{row['Father Name']}</td>
                        <td className="px-4 py-2 font-mono">{row['Aadhar No']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-[13px] cursor-pointer text-center"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="flex-1 py-2.5 rounded-xl bg-[#2E5BFF] text-white hover:bg-blue-600 font-semibold text-[13px] cursor-pointer text-center shadow-md shadow-blue-500/10"
              >
                Confirm and Upload
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSING & ERROR RESOLUTION */}
        {step === 3 && (
          <div className="space-y-6">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <RefreshCw className="w-8 h-8 text-[#2E5BFF] animate-spin" />
                <div className="text-center">
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">Processing Bulk Import</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">Creating Accounts records and allocating fee lines...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Results Overview */}
                <div className="text-center space-y-2">
                  <span className="text-[32px] block">
                    {successCount === parsedData.length ? '✅' : '⚠️'}
                  </span>
                  <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                    {successCount === parsedData.length ? 'Import Complete' : 'Import Partially Completed'}
                  </h3>
                  <p className="text-[13px] text-slate-600 dark:text-slate-400">
                    Successfully Imported: <strong>{successCount}</strong> / {parsedData.length} records.
                  </p>
                </div>

                {/* Errors log box */}
                {errors.length > 0 && (
                  <div className="border border-rose-200 dark:border-rose-900/50 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 p-4 space-y-2">
                    <div className="text-[12px] font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5 border-b border-rose-100 dark:border-rose-900/50 pb-2">
                      <AlertCircle className="w-4 h-4" />
                      Errors Encountered ({errors.length}):
                    </div>
                    <ul className="text-[11px] text-rose-700 dark:text-rose-400 font-mono space-y-1 max-h-[120px] overflow-y-auto pl-4 list-disc">
                      {errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDone}
                    className="px-6 py-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white font-bold text-[13px] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

