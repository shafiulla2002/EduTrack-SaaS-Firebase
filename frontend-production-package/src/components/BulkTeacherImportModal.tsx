'use client';

import React, { useState, useRef } from 'react';
import { Download, Upload, AlertCircle, RefreshCw, X, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import Modal from '@/components/Modal';

interface BulkTeacherImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedCount: number) => void;
  allSubjects: any[];
}

interface ParsedRecord {
  [key: string]: string;
}

export default function BulkTeacherImportModal({ isOpen, onClose, onImportSuccess, allSubjects }: BulkTeacherImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState<ParsedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templateHeaders = [
    'First Name', 'Last Name', 'Email', 'Phone', 'Qualification',
    'Designation', 'Basic Salary', 'Allowances', 'Deductions', 'PF',
    'Joining Date', 'Subject 1', 'Skill Level 1', 'Subject 2',
    'Skill Level 2', 'Subject 3', 'Skill Level 3'
  ];

  // Triggers template download
  const handleDownloadTemplate = () => {
    const csvContent = templateHeaders.join(',') + '\n' +
      'Ramesh,Kumar,ramesh.kumar@example.com,9876543210,M.Sc Mathematics,Mathematics Teacher,45000,5000,2000,1800,2026-06-01,Mathematics,Expert,Physics,Intermediate,,\n' +
      'Suresh,Singh,suresh.singh@example.com,9998887776,MA English,English Teacher,40000,4000,1500,1500,2026-06-01,English,Expert,,,,';

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
    element.setAttribute('download', 'EduTrack_Teacher_Import_Template.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // RFC-4180 compliant CSV row parser
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, '').trim());
    return result;
  };

  // Helper to split CSV text into lines, respecting quotes across newlines
  const splitCSVLines = (text: string): string[] => {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') {
          i++;
        }
        if (current.trim()) {
          lines.push(current);
        }
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      lines.push(current);
    }
    return lines;
  };

  // Case-insensitive & quote-stripped helper to retrieve a field value from a row record
  const getRowVal = (row: ParsedRecord, key: string): string => {
    if (!row) return '';
    let rawVal = row[key];
    if (rawVal === undefined) {
      const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey) rawVal = row[foundKey];
    }
    if (!rawVal) return '';
    return String(rawVal).replace(/^"|"$/g, '').trim();
  };

  // CSV Parsing logic
  const parseCSV = (text: string) => {
    try {
      const lines = splitCSVLines(text);
      if (lines.length === 0) {
        alert('CSV file is empty.');
        return;
      }

      const rawHeaderLine = lines[0].replace(/^\uFEFF/, '');
      const headers = parseCSVLine(rawHeaderLine).map(h => h.toLowerCase());
      const originalHeaders = parseCSVLine(rawHeaderLine);

      const required = ['first name', 'last name', 'email'];
      const missing = required.filter(req => !headers.includes(req));

      if (missing.length > 0) {
        alert(`Invalid CSV template format. Missing required headers: ${missing.join(', ')}. Please download and use the official CSV template.`);
        return;
      }

      const rows: ParsedRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const currentValues = parseCSVLine(line);
        const obj: ParsedRecord = {};

        for (let j = 0; j < originalHeaders.length; j++) {
          const headerName = originalHeaders[j];
          obj[headerName] = currentValues[j] !== undefined ? currentValues[j] : '';
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

  const handleConfirmImport = async () => {
    setStep(3);
    setIsProcessing(true);
    setErrors([]);

    const teachersToUpload: any[] = [];
    const errorLogs: string[] = [];

    parsedData.forEach((row, index) => {
      const rowNum = index + 2;
      const firstName = getRowVal(row, 'First Name');
      const lastName = getRowVal(row, 'Last Name');
      const email = getRowVal(row, 'Email');

      if (!firstName) {
        errorLogs.push(`Row ${rowNum}: First Name is missing.`);
        return;
      }
      if (!lastName) {
        errorLogs.push(`Row ${rowNum}: Last Name is missing.`);
        return;
      }
      if (!email) {
        errorLogs.push(`Row ${rowNum}: Email is missing.`);
        return;
      }
      if (!email.includes('@')) {
        errorLogs.push(`Row ${rowNum}: Invalid email format "${email}".`);
        return;
      }

      const parseNumVal = (raw: string) => {
        if (!raw) return undefined;
        const clean = raw.replace(/[^0-9.]/g, '');
        const num = Number(clean);
        return isNaN(num) ? undefined : num;
      };

      const basicSalaryRaw = getRowVal(row, 'Basic Salary');
      const allowancesRaw = getRowVal(row, 'Allowances');
      const deductionsRaw = getRowVal(row, 'Deductions');
      const pfRaw = getRowVal(row, 'PF');

      const basicSalary = parseNumVal(basicSalaryRaw);
      const allowances = parseNumVal(allowancesRaw);
      const deductions = parseNumVal(deductionsRaw);
      const pf = parseNumVal(pfRaw);

      const skills: any[] = [];
      const mapSkill = (subNameKey: string, skillLevelKey: string) => {
        const sName = getRowVal(row, subNameKey);
        if (sName) {
          const matchedSub = allSubjects.find(s => s.name.toLowerCase() === sName.toLowerCase());
          if (matchedSub) {
            skills.push({
              subjectId: matchedSub.id,
              skillLevel: getRowVal(row, skillLevelKey) || 'Expert',
              yearsOfExperience: 5
            });
          }
        }
      };

      mapSkill('Subject 1', 'Skill Level 1');
      mapSkill('Subject 2', 'Skill Level 2');
      mapSkill('Subject 3', 'Skill Level 3');

      teachersToUpload.push({
        firstName,
        lastName,
        email,
        phone: getRowVal(row, 'Phone') || undefined,
        qualification: getRowVal(row, 'Qualification') || undefined,
        designation: getRowVal(row, 'Designation') || undefined,
        basicSalary,
        allowances,
        deductions,
        pf,
        joiningDate: getRowVal(row, 'Joining Date') || undefined,
        skills
      });
    });

    if (errorLogs.length > 0) {
      setErrors(errorLogs);
      setIsProcessing(false);
      return;
    }

    try {
      const res = await api.post('/timetable/teachers/bulk', { teachers: teachersToUpload });
      const createdCount = res.data.created || 0;
      setSuccessCount(createdCount);
      setIsProcessing(false);
      if (createdCount > 0) {
        onImportSuccess(createdCount);
      }
    } catch (err: any) {
      console.error('Bulk teacher import failed:', err);
      setErrors([err.response?.data?.message || 'Error occurred while calling bulk import API.']);
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setFileName('');
    setParsedData([]);
    setErrors([]);
  };

  const handleClose = () => {
    setStep(1);
    setFileName('');
    setParsedData([]);
    setSuccessCount(0);
    setErrors([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Teacher Import"
      subtitle="Import teaching staff in bulk via official CSV template"
      size="2xl"
    >
      <div className="space-y-6">
        {/* STEP 1: UPLOAD ZONE */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
              Import teaching staff in bulk. Download the official CSV template, fill in details like qualification, designation, and up to 3 subject skills, and upload the file.
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
                We parsed <strong>{parsedData.length}</strong> teacher records from <strong>{fileName}</strong>.
              </p>
            </div>

            {/* Sample grid preview */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-slate-50/50 dark:bg-slate-900/50">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Teacher Preview (First 3 rows)
              </div>
              <div className="overflow-x-auto max-h-[160px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[11px] text-slate-400 uppercase">
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Designation</th>
                      <th className="px-4 py-2">Subject 1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px] text-slate-700 dark:text-slate-300">
                    {parsedData.slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">
                          {getRowVal(row, 'First Name')} {getRowVal(row, 'Last Name')}
                        </td>
                        <td className="px-4 py-2">{getRowVal(row, 'Email')}</td>
                        <td className="px-4 py-2">{getRowVal(row, 'Designation') || '—'}</td>
                        <td className="px-4 py-2">{getRowVal(row, 'Subject 1') || '—'}</td>
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
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">Creating Staff profiles and mapping qualifications...</p>
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
                    onClick={handleClose}
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
