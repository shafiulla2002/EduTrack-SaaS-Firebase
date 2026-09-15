'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { dispatchSchoolSetupUpdated } from '@/lib/events';
import PhotoUpload from '@/components/PhotoUpload';

interface Product {
  id: string;
  product2Id: string;
  productName: string;
  productDescription: string;
  unitPrice: number;
  pricebook2Id: string;
}

export default function AdmissionsPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  // Options
  const [academicYears, setAcademicYears] = useState<{ label: string; value: string }[]>([]);
  const [classes, setClasses] = useState<{ label: string; value: string }[]>([]);
  const [sections, setSections] = useState<{ label: string; value: string }[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Concessions
  const [concessionPercent, setConcessionPercent] = useState<string>('0');
  const [concessionAmount, setConcessionAmount] = useState<string>('0');

  // Form profile
  const [tempStudent, setTempStudent] = useState<{
    firstName: string;
    lastName: string;
    fatherName: string;
    motherName: string;
    dob: string;
    phone: string;
    emergencyContact: string;
    email: string;
    aadharNo: string;
    village: string;
    city: string;
    pincode: string;
    state: string;
    country: string;
    selectedClass: string;
    selectedSection: string;
    academicYear: string;
    profilePhotoUrl: string | null;
  }>({
    firstName: '',
    lastName: '',
    fatherName: '',
    motherName: '',
    dob: '',
    phone: '',
    emergencyContact: '',
    email: '',
    aadharNo: '',
    village: '',
    city: '',
    pincode: '',
    state: '',
    country: '',
    selectedClass: '',
    selectedSection: '',
    academicYear: '',
    profilePhotoUrl: null,
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [yRes, cRes] = await Promise.all([
          api.get('/billing/options/years'),
          api.get('/billing/options/classes')
        ]);
        setAcademicYears(yRes.data);
        setClasses(cRes.data);
        
        let initialYear = '';
        let initialClass = '';

        if (yRes.data.length > 0) {
          initialYear = yRes.data[0].value;
        }
        if (cRes.data.length > 0) {
          initialClass = cRes.data[0].value;
        }

        setTempStudent(prev => ({
          ...prev,
          academicYear: initialYear,
          selectedClass: initialClass
        }));
      } catch (err) {
        console.error('Failed to fetch options', err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (tempStudent.selectedClass) {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/billing/options/sections?classId=${tempStudent.selectedClass}`);
          setSections(res.data);
          if (res.data.length > 0) {
            setTempStudent(prev => ({ ...prev, selectedSection: res.data[0].value }));
          } else {
            setTempStudent(prev => ({ ...prev, selectedSection: '' }));
          }
        } catch (err) {
          console.error('Failed to fetch sections', err);
        }
      };
      fetchSections();
    }
  }, [tempStudent.selectedClass]);

  const fetchProducts = async () => {
    if (!tempStudent.selectedClass) return;
    try {
      setIsLoading(true);
      const res = await api.get(`/billing/products/active`, {
        params: {
          classId: tempStudent.selectedClass,
          academicYearId: tempStudent.academicYear
        }
      });
      setAvailableProducts(res.data);
      // Select all products by default to match SF behavior
      setSelectedProductIds(res.data.map((p: any) => p.id));
    } catch (err) {
      console.error('Failed to fetch active products', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTempStudent(prev => ({ ...prev, [name]: value }));
  };

  const handleProductToggle = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(item => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  // Calculations
  const selectedProducts = availableProducts.filter(p => selectedProductIds.includes(p.id));
  const selectedServicesTotal = selectedProducts.reduce((sum, p) => sum + p.unitPrice, 0);
  
  const concessionVal = parseFloat(concessionAmount) || 0;
  const netFeeTotal = Math.max(0, selectedServicesTotal - concessionVal);

  const handlePercentChange = (val: string) => {
    setConcessionPercent(val);
    const pct = parseFloat(val) || 0;
    const calculatedAmount = Math.round((selectedServicesTotal * pct) / 100);
    setConcessionAmount(String(calculatedAmount));
  };

  const handleAmountChange = (val: string) => {
    setConcessionAmount(val);
    const amt = parseFloat(val) || 0;
    if (selectedServicesTotal > 0) {
      const calculatedPct = ((amt / selectedServicesTotal) * 100).toFixed(2);
      setConcessionPercent(calculatedPct);
    } else {
      setConcessionPercent('0');
    }
  };

  const getStepProgressStyle = () => {
    const stepVal = currentStep === 5 ? 4 : currentStep;
    return { width: `${(stepVal / 4) * 100}%` };
  };

  const stepTitle = () => {
    const titles = ['Student Admission', 'Academic Details', 'Fee Structure', 'Review & Submit'];
    return currentStep > 4 ? 'Admission Complete' : titles[currentStep - 1];
  };

  const stepSubtitle = () => {
    const subs = [
      'Step 1 of 4 · Personal & address information',
      'Step 2 of 4 · Class and year selection',
      'Step 3 of 4 · Choose applicable fee items',
      'Step 4 of 4 · Verify and confirm admission'
    ];
    return currentStep > 4 ? 'Record created · Awaiting fee payment' : subs[currentStep - 1];
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!tempStudent.firstName || !tempStudent.lastName || !tempStudent.fatherName || !tempStudent.phone || !tempStudent.dob) {
        alert('Please fill out all required profile details.');
        return;
      }
    }
    if (currentStep === 2) {
      fetchProducts();
      setCurrentStep(3);
    } else if (currentStep === 4) {
      const submitAdmission = async () => {
        setIsLoading(true);
        try {
          await api.post('/billing/admissions', {
            studentData: {
              firstName: tempStudent.firstName,
              lastName: tempStudent.lastName,
              fatherName: tempStudent.fatherName,
              motherName: tempStudent.motherName,
              dob: tempStudent.dob,
              phone: tempStudent.phone,
              emergencyContact: tempStudent.emergencyContact,
              email: tempStudent.email || '',
              aadharNo: tempStudent.aadharNo,
              selectedClass: tempStudent.selectedClass,
              selectedSection: tempStudent.selectedSection,
              academicYear: tempStudent.academicYear,
              village: tempStudent.village,
              city: tempStudent.city,
              pincode: tempStudent.pincode,
              state: tempStudent.state,
              country: tempStudent.country,
              profilePhotoUrl: tempStudent.profilePhotoUrl
            },
            selectedPricebookEntryIds: selectedProductIds,
            concessionAmount: concessionVal
          });
          dispatchSchoolSetupUpdated();
          setCurrentStep(5);
        } catch (err: any) {
          console.error('Admission failed:', err);
          alert(`Admission failed: ${err.response?.data?.message || err.message}`);
        } finally {
          setIsLoading(false);
        }
      };
      submitAdmission();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const getClassNameById = (id: string) => {
    return classes.find(c => c.value === id)?.label || id;
  };

  const getSectionNameById = (id: string) => {
    return sections.find(s => s.value === id)?.label || id;
  };

  const getAYNameById = (id: string) => {
    return academicYears.find(y => y.value === id)?.label || id;
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-slate-700">
      {/* STEPPER BAR */}
      <div className="p-6 border-b border-slate-100 bg-slate-50">
        <div className="flex justify-between items-start gap-4 flex-col sm:flex-row">
          <div>
            <h2 className="text-[20px] font-bold text-slate-900 leading-none">{stepTitle()}</h2>
            <p className="text-[12px] text-slate-400 font-medium mt-1.5">{stepSubtitle()}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            {[1, 2, 3, 4].map((stepNum) => {
              const isActive = currentStep === stepNum;
              const isDone = currentStep > stepNum;
              return (
                <React.Fragment key={stepNum}>
                  {stepNum > 1 && <div className={`h-1 w-8 rounded-full ${isDone ? 'bg-[#2E5BFF]' : 'bg-slate-200'}`} />}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-[#2E5BFF] text-white' 
                      : isDone 
                        ? 'bg-blue-50 text-[#2E5BFF] border border-blue-100' 
                        : 'bg-white border border-slate-200 text-slate-400'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="w-full bg-slate-100 h-1">
        <div className="bg-[#2E5BFF] h-full transition-all duration-300" style={getStepProgressStyle()} />
      </div>

      {/* CARD BODY */}
      <div className="p-8 min-h-[300px]">
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <span className="text-slate-400 text-sm font-semibold animate-pulse">Loading / Processing Admission...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* STEP 1: STUDENT PROFILE */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">First Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      value={tempStudent.firstName}
                      onChange={handleInputChange}
                      placeholder="e.g. Arjun"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none focus:border-[#2E5BFF] focus:bg-white"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Last Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      value={tempStudent.lastName}
                      onChange={handleInputChange}
                      placeholder="e.g. Sharma"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none focus:border-[#2E5BFF] focus:bg-white"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Father's Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      name="fatherName"
                      value={tempStudent.fatherName}
                      onChange={handleInputChange}
                      placeholder="Father's full name"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none focus:border-[#2E5BFF] focus:bg-white"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Mother's Name</label>
                    <input
                      type="text"
                      name="motherName"
                      value={tempStudent.motherName}
                      onChange={handleInputChange}
                      placeholder="Mother's full name"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none focus:border-[#2E5BFF] focus:bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Date of Birth <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      name="dob"
                      value={tempStudent.dob}
                      onChange={handleInputChange}
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none focus:border-[#2E5BFF] focus:bg-white"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Phone Number <span className="text-rose-500">*</span></label>
                    <input
                      type="tel"
                      name="phone"
                      value={tempStudent.phone}
                      onChange={handleInputChange}
                      placeholder="+91 00000 00000"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none focus:border-[#2E5BFF] focus:bg-white"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Emergency Contact</label>
                    <input
                      type="tel"
                      name="emergencyContact"
                      value={tempStudent.emergencyContact}
                      onChange={handleInputChange}
                      placeholder="Alternate number"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={tempStudent.email}
                      onChange={handleInputChange}
                      placeholder="name@example.com"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Aadhar Card No.</label>
                    <input
                      type="text"
                      name="aadharNo"
                      value={tempStudent.aadharNo}
                      onChange={handleInputChange}
                      placeholder="e.g. 1234 5678 9012"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                      maxLength={14}
                    />
                  </div>
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="font-semibold text-slate-700">Student Profile Photo</label>
                    <PhotoUpload
                      value={tempStudent.profilePhotoUrl}
                      onChange={(val) => setTempStudent(prev => ({ ...prev, profilePhotoUrl: val }))}
                    />
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 pt-6">
                  Residential Address
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Village / City</label>
                    <input
                      type="text"
                      name="village"
                      value={tempStudent.village}
                      onChange={handleInputChange}
                      placeholder="Village or town"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">City (Official)</label>
                    <input
                      type="text"
                      name="city"
                      value={tempStudent.city}
                      onChange={handleInputChange}
                      placeholder="Official city name"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      value={tempStudent.pincode}
                      onChange={handleInputChange}
                      placeholder="6-digit code"
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                      maxLength={6}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">State</label>
                    <select
                      name="state"
                      value={tempStudent.state}
                      onChange={handleInputChange}
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    >
                      <option value="">Select State</option>
                      <option>Delhi</option>
                      <option>Maharashtra</option>
                      <option>Telangana</option>
                      <option>Karnataka</option>
                      <option>Andhra Pradesh</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Country</label>
                    <select
                      name="country"
                      value={tempStudent.country}
                      onChange={handleInputChange}
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    >
                      <option value="">Select Country</option>
                      <option>India</option>
                      <option>United States</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: ACADEMIC DETAILS */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-sm text-[#2E5BFF]">
                  <span className="text-[20px]">📚</span>
                  <div>
                    <h4 className="font-bold">Academic Placement</h4>
                    <p className="text-slate-500 font-medium text-xs mt-1">
                      Select the class, section and academic year for this student's enrollment.
                    </p>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Enrollment Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <label className="font-semibold text-slate-700">Academic Year <span className="text-rose-500">*</span></label>
                    <select
                      name="academicYear"
                      value={tempStudent.academicYear}
                      onChange={handleInputChange}
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                      required
                    >
                      {academicYears.map(ay => (
                        <option key={ay.value} value={ay.value}>{ay.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Class <span className="text-rose-500">*</span></label>
                    <select
                      name="selectedClass"
                      value={tempStudent.selectedClass}
                      onChange={handleInputChange}
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                      required
                    >
                      {classes.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-semibold text-slate-700">Section</label>
                    <select
                      name="selectedSection"
                      value={tempStudent.selectedSection}
                      onChange={handleInputChange}
                      className="border border-slate-200 bg-slate-50 px-4 py-2.5 rounded-xl outline-none"
                    >
                      {sections.map(sec => (
                        <option key={sec.value} value={sec.value}>{sec.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: FEE STRUCTURE */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Fee Structure
                </h3>

                {availableProducts.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl">
                    No active fee products found in the pricebook for this class. You can proceed without fee products or configure them first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableProducts.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleProductToggle(p.id)}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-36 ${
                            isSelected 
                              ? 'border-[#2E5BFF] bg-blue-50/20 shadow-sm' 
                              : 'border-slate-200 hover:bg-slate-50 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[20px]">💰</span>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'bg-[#2E5BFF] border-[#2E5BFF] text-white' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && <span className="text-[10px] font-bold">✓</span>}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-bold text-[14px] text-slate-800 leading-tight">{p.productName}</h4>
                            <p className="text-[11px] text-slate-400 truncate mt-1 leading-normal">{p.productDescription}</p>
                          </div>
                          <div className="text-[16px] font-bold text-[#2E5BFF] mt-2 font-mono">
                            ₹{p.unitPrice.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs font-semibold">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-wider">
                    <span>{selectedProductIds.length} item(s) selected</span>
                    <span>Fee Concessions</span>
                  </div>
                  <div className="flex gap-4 flex-col sm:flex-row">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-slate-500 shrink-0">Discount (%)</span>
                      <input
                        type="number"
                        value={concessionPercent}
                        onChange={(e) => handlePercentChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none font-mono"
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-slate-500 shrink-0">Discount (₹)</span>
                      <input
                        type="number"
                        value={concessionAmount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none font-mono"
                        step="1"
                      />
                    </div>
                  </div>

                  {concessionVal > 0 && (
                    <div className="border-t border-slate-200 pt-3 flex gap-2 text-xs font-mono text-slate-500">
                      <span className="font-bold text-slate-400">Calculation:</span>
                      <span>₹ {selectedServicesTotal.toLocaleString()} - ₹ {concessionVal.toLocaleString()} = ₹ {netFeeTotal.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-sm font-bold">
                    <span className="text-slate-500">Total: ₹ {selectedServicesTotal.toLocaleString()}</span>
                    <span className="text-[#2E5BFF] text-base">Net Payable: ₹ {netFeeTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                  {tempStudent.profilePhotoUrl ? (
                    <img
                      src={tempStudent.profilePhotoUrl}
                      alt="Student Preview"
                      className="w-14 h-14 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white flex items-center justify-center font-extrabold text-[20px]">
                      {((tempStudent.firstName || '?')[0] + (tempStudent.lastName || '')[0]).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{tempStudent.firstName} {tempStudent.lastName}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {getClassNameById(tempStudent.selectedClass)} · {getSectionNameById(tempStudent.selectedSection)} · Academic Year {getAYNameById(tempStudent.academicYear)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Personal Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Father's Name</span>
                      <span className="text-slate-800 font-bold">{tempStudent.fatherName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Mother's Name</span>
                      <span className="text-slate-800 font-bold">{tempStudent.motherName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">DOB</span>
                      <span className="text-slate-800 font-bold">{tempStudent.dob}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Phone Number</span>
                      <span className="text-slate-800 font-bold">{tempStudent.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Aadhar Number</span>
                      <span className="text-slate-800 font-bold">{tempStudent.aadharNo || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Village / City</span>
                      <span className="text-slate-800 font-bold">{tempStudent.village || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Fee Breakdown
                  </h4>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <tbody className="divide-y divide-slate-100">
                        {selectedProducts.map((p) => (
                          <tr key={p.id}>
                            <td className="px-6 py-3 font-semibold text-slate-700">💰 {p.productName}</td>
                            <td className="px-6 py-3 text-right font-bold font-mono text-slate-900">₹{p.unitPrice.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-6 py-3">Subtotal</td>
                          <td className="px-6 py-3 text-right font-mono">₹{selectedServicesTotal.toLocaleString()}</td>
                        </tr>
                        {concessionVal > 0 && (
                          <tr className="bg-rose-50/30 text-rose-600 font-semibold">
                            <td className="px-6 py-3">Discount Concession</td>
                            <td className="px-6 py-3 text-right font-mono">- ₹{concessionVal.toLocaleString()}</td>
                          </tr>
                        )}
                        <tr className="bg-blue-50 text-[#2E5BFF] font-bold text-sm">
                          <td className="px-6 py-3.5">Net Payable</td>
                          <td className="px-6 py-3.5 text-right font-mono">₹{netFeeTotal.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: SUCCESS */}
            {currentStep === 5 && (
              <div className="p-8 text-center space-y-6 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#00C48C] flex items-center justify-center text-[28px] mx-auto animate-bounce">
                  🎉
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Admission Successful!</h2>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    The student record has been created and the admission opportunity is ready. Proceed to complete the fee payment.
                  </p>
                </div>
                <div className="flex gap-3 pt-4 justify-center">
                  <Link
                    href="/dashboard/billing"
                    className="px-5 py-2.5 rounded-xl bg-[#00C48C] hover:bg-[#00b07e] text-white font-bold text-xs shadow-md shadow-emerald-500/10 transition-all flex items-center gap-1.5"
                  >
                    Proceed to Fee Payment
                  </Link>
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setTempStudent({
                        firstName: '',
                        lastName: '',
                        fatherName: '',
                        motherName: '',
                        dob: '',
                        phone: '',
                        emergencyContact: '',
                        email: '',
                        aadharNo: '',
                        village: '',
                        city: '',
                        pincode: '',
                        state: '',
                        country: '',
                        selectedClass: classes.length > 0 ? classes[0].value : '',
                        selectedSection: '',
                        academicYear: academicYears.length > 0 ? academicYears[0].value : '',
                        profilePhotoUrl: null,
                      });
                      setSelectedProductIds([]);
                      setConcessionAmount('0');
                      setConcessionPercent('0');
                    }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition-all flex items-center gap-1.5"
                  >
                    New Admission
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* CARD FOOTER */}
      {currentStep <= 4 && (
        <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs font-semibold text-slate-400 flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            256-bit encrypted · data never shared
          </div>
          <div className="flex gap-3 self-end sm:self-center">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-slate-500 font-bold flex items-center gap-1 min-h-[44px]"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-[#2E5BFF] hover:bg-[#1E3FCC] text-white rounded-lg font-bold flex items-center gap-1 shadow-md shadow-blue-500/10 transition-all min-h-[44px]"
            >
              {currentStep === 4 ? 'Confirm Admission' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
