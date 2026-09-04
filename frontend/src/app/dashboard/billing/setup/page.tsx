'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, CheckCircle, Package, Tag } from 'lucide-react';
import { api, cachedGet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSchoolSetupUpdate, dispatchSchoolSetupUpdated } from '@/lib/events';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  productCode?: string;
  isActive: boolean;
}

interface PriceItem {
  productId: string;
  name: string;
  price: string;
  selected: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  isActive?: boolean;
}

interface ClassOption {
  id: string;
  name: string;
}

const HARDCODED_SUGGESTIONS = [
  'School Fee', 'Tuition Fee', 'Exam Fee', 'Library Fee', 'Sports Fee',
  'Lab Fee', 'Transport Fee', 'Hostel Fee', 'Activity Fee', 'Admission Fee',
  'Annual Fee', 'Development Fee', 'Computer Lab Fee', 'Stationery Fee', 'Miscellaneous Fee',
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FeeSetupPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'addFees' | 'setPriceBook'>('addFees');

  // ── Add Fee Products tab ──
  const [inputFields, setInputFields] = useState([{ id: 1, value: '', showSuggestions: false }]);
  const [isLoading, setIsLoading] = useState(false);
  const [submittedProducts, setSubmittedProducts] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Set Price Book tab ──
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [yearsList, setYearsList] = useState<AcademicYear[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [loadingPriceBook, setLoadingPriceBook] = useState(false);
  const [savingPriceBook, setSavingPriceBook] = useState(false);
  const [syncingFees, setSyncingFees] = useState(false);

  // ── Load dropdowns on mount ──────────────────────────────────────────────

  const loadDropdownData = useCallback(async (academicYearId?: string) => {
    try {
      const [classesRes, yearsRes, productsRes] = await Promise.all([
        cachedGet('/academics/classes', { params: academicYearId ? { academicYearId } : {} }, 60000),
        cachedGet('/academics/academic-years', undefined, 60000),
        api.get('/billing/products'),
      ]);
      setClassesList(classesRes.data || []);
      setYearsList(yearsRes.data || []);
      setAllProducts(productsRes.data || []);
    } catch (err) {
      console.error('Failed to load dropdown data:', err);
    }
  }, []);

  useEffect(() => {
    loadDropdownData();
  }, [loadDropdownData]);

  useSchoolSetupUpdate(() => loadDropdownData(selectedYear || undefined));

  // When academic year changes in the price book tab, reload classes filtered by that year
  // and clear the selected class to force re-selection
  useEffect(() => {
    if (selectedYear) {
      loadDropdownData(selectedYear);
      setSelectedClass('');
    }
  }, [selectedYear, loadDropdownData]);

  // ── Auto-load pricebook when class + year are both selected ──────────────

  useEffect(() => {
    if (!selectedClass || !selectedYear) {
      // Reset price items to the full product list with empty prices
      const items = allProducts.map((p) => ({
        productId: p.id,
        name: p.name,
        price: '',
        selected: false,
      }));
      setPriceItems(items);
      return;
    }

    const fetchPriceBook = async () => {
      setLoadingPriceBook(true);
      try {
        const res = await api.get('/billing/pricebook', {
          params: { classId: selectedClass, academicYearId: selectedYear },
        });
        const existing = res.data; // null or { entries: [...] }

        // Build items: merge saved entries with all products
        const savedMap: Record<string, number> = {};
        if (existing && existing.entries) {
          existing.entries.forEach((e: any) => {
            savedMap[e.productId] = e.unitPrice;
          });
        }

        const items: PriceItem[] = allProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          price: savedMap[p.id] !== undefined ? String(savedMap[p.id]) : '',
          selected: savedMap[p.id] !== undefined,
        }));

        setPriceItems(items);
      } catch {
        // No pricebook found — show all products with empty prices
        setPriceItems(
          allProducts.map((p) => ({
            productId: p.id,
            name: p.name,
            price: '',
            selected: false,
          })),
        );
      } finally {
        setLoadingPriceBook(false);
      }
    };

    fetchPriceBook();
  }, [selectedClass, selectedYear, allProducts]);

  // ── Add Fee Products handlers ─────────────────────────────────────────────

  const handleInputChange = (fieldId: number, value: string) => {
    setInputFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, value, showSuggestions: value.length > 0 } : f)),
    );
  };

  const handleSuggestionClick = (fieldId: number, suggestion: string) => {
    setInputFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, value: suggestion, showSuggestions: false } : f)),
    );
  };

  const handleAddField = () => {
    const newId = Math.max(...inputFields.map((f) => f.id)) + 1;
    setInputFields([...inputFields, { id: newId, value: '', showSuggestions: false }]);
  };

  const handleRemoveField = (fieldId: number) => {
    if (inputFields.length === 1) return;
    setInputFields(inputFields.filter((f) => f.id !== fieldId));
  };

  const getSuggestions = (value: string) => {
    const q = value.toLowerCase();
    return HARDCODED_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  };

  const handleSubmitProducts = async () => {
    const products = inputFields.map((f) => f.value.trim()).filter(Boolean);
    if (products.length === 0) {
      showToast('Please enter at least one product name!', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      await api.post('/billing/products', { productNames: products });
      setSubmittedProducts(products);
      setShowSuccess(true);
      setInputFields([{ id: 1, value: '', showSuggestions: false }]);
      showToast(`${products.length} product(s) created successfully.`, 'success');
      // Reload products so the price book tab shows them
      const res = await api.get('/billing/products');
      setAllProducts(res.data || []);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create products.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Save Price Book handler ───────────────────────────────────────────────

  const handleSubmitPriceBook = async () => {
    if (!selectedClass) {
      showToast('Please select a class!', 'warning');
      return;
    }
    if (!selectedYear) {
      showToast('Please select an academic year!', 'warning');
      return;
    }
    const selected = priceItems.filter((p) => p.selected && p.price);
    if (selected.length === 0) {
      showToast('Please select at least one product and enter its price!', 'warning');
      return;
    }

    setSavingPriceBook(true);
    try {
      await api.post('/billing/pricebook', {
        classId: selectedClass,
        academicYearId: selectedYear,
        priceItems: priceItems.map((item) => ({
          productId: item.productId,
          price: Number(item.price) || 0,
          selected: item.selected && Number(item.price) > 0,
        })),
      });

      showToast('Price Book saved successfully.', 'success');
      dispatchSchoolSetupUpdated();

      // Re-fetch to confirm saved state
      const res = await api.get('/billing/pricebook', {
        params: { classId: selectedClass, academicYearId: selectedYear },
      });
      if (res.data && res.data.entries) {
        const savedMap: Record<string, number> = {};
        res.data.entries.forEach((e: any) => { savedMap[e.productId] = e.unitPrice; });
        setPriceItems((prev) =>
          prev.map((p) => ({
            ...p,
            price: savedMap[p.productId] !== undefined ? String(savedMap[p.productId]) : p.price,
            selected: savedMap[p.productId] !== undefined,
          })),
        );
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save price book.', 'error');
    } finally {
      setSavingPriceBook(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Tab Header */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab('addFees')}
              className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'addFees'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Package className="w-4 h-4" /> Add Fee Products
            </button>
            <button
              onClick={() => setActiveTab('setPriceBook')}
              className={`flex-1 py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'setPriceBook'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-4 h-4" /> Set Price Book
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'addFees' ? (
              /* ── ADD FEE PRODUCTS TAB ── */
              <>
                {!showSuccess ? (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-[22px] font-extrabold text-slate-850">Create Fee Products</h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Add new fee items to your school&apos;s fee structure.
                      </p>
                    </div>

                    <div className="space-y-3 mb-5">
                      {inputFields.map((field, idx) => (
                        <div key={field.id} className="relative">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <label className="block text-xs text-slate-500 font-semibold mb-1">
                                Product Name
                              </label>
                              <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden focus-within:border-indigo-400 transition-all">
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                                  onFocus={() =>
                                    setInputFields((prev) =>
                                      prev.map((f) =>
                                        f.id === field.id ? { ...f, showSuggestions: true } : f,
                                      ),
                                    )
                                  }
                                  onBlur={() =>
                                    setTimeout(
                                      () =>
                                        setInputFields((prev) =>
                                          prev.map((f) =>
                                            f.id === field.id ? { ...f, showSuggestions: false } : f,
                                          ),
                                        ),
                                      200,
                                    )
                                  }
                                  placeholder="e.g. Tuition Fee, Library Fee, Sports Fee"
                                  className="flex-1 px-4 py-2.5 text-sm text-slate-800 outline-none bg-transparent"
                                />
                                {idx === 0 && (
                                  <button
                                    type="button"
                                    onClick={handleAddField}
                                    className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white text-lg font-bold hover:bg-indigo-700 transition-colors"
                                  >
                                    +
                                  </button>
                                )}
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveField(field.id)}
                                    className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              {/* Suggestions Dropdown */}
                              {field.showSuggestions && field.value && getSuggestions(field.value).length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden mt-1">
                                  {getSuggestions(field.value).map((s) => (
                                    <div
                                      key={s}
                                      onMouseDown={() => handleSuggestionClick(field.id, s)}
                                      className="px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 cursor-pointer flex items-center gap-2"
                                    >
                                      <span className="text-base">💡</span>
                                      <span>{s}</span>
                                      <span className="ml-auto text-[10px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                                        Suggested
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSubmitProducts}
                      disabled={isLoading}
                      className="w-full py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-750 text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md hover:shadow-indigo-500/10 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Creating products...
                        </>
                      ) : (
                        <>Submit Products</>
                      )}
                    </button>
                  </>
                ) : (
                  /* Success State */
                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center text-3xl mx-auto mb-4">
                      ✅
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-lg mb-2">Products Created!</h3>
                    <div className="space-y-1.5 mb-5 text-left">
                      {submittedProducts.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          <span className="text-emerald-500">✓</span> {p}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowSuccess(false);
                          setSubmittedProducts([]);
                        }}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                      >
                        + Add More
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('setPriceBook');
                          setShowSuccess(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-750"
                      >
                        Set Price Book
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── SET PRICE BOOK TAB ── */
              <>
                <div className="text-center mb-6">
                  <h2 className="text-[22px] font-extrabold text-slate-800">Set Price Book</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Assign prices to fee products for each class.
                  </p>
                </div>

                {/* Class + Year selectors */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold mb-1">
                      Academic Year *
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:border-indigo-400"
                    >
                      <option value="">Select Year...</option>
                      {yearsList.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.isActive ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold mb-1">Class *</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:border-indigo-400"
                    >
                      <option value="">Choose a class...</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Loading indicator */}
                {loadingPriceBook && (
                  <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-sm font-semibold">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading saved price book...
                  </div>
                )}

                {/* Auto-load info hint */}
                {selectedClass && selectedYear && !loadingPriceBook && (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-3">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Previously saved prices loaded automatically.
                  </div>
                )}

                {/* Product list */}
                {!loadingPriceBook && (
                  <>
                    {allProducts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <p className="font-semibold">No products found.</p>
                        <p className="text-xs mt-1">
                          Create products in the &quot;Add Fee Products&quot; tab first.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-5 max-h-56 overflow-y-auto font-sans">
                        {priceItems.map((item, idx) => (
                          <div
                            key={item.productId}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={(e) =>
                                setPriceItems((prev) =>
                                  prev.map((p, i) =>
                                    i === idx
                                      ? { ...p, selected: e.target.checked, price: e.target.checked ? p.price : '' }
                                      : p,
                                  ),
                                )
                              }
                              className="w-4 h-4 text-indigo-600 rounded accent-indigo-600 cursor-pointer"
                            />
                            <span className="flex-1 text-sm font-semibold text-slate-700">{item.name}</span>
                            {item.selected && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-500 font-semibold">₹</span>
                                <input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) =>
                                    setPriceItems((prev) =>
                                      prev.map((p, i) =>
                                        i === idx ? { ...p, price: e.target.value } : p,
                                      ),
                                    )
                                  }
                                  className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm font-mono outline-none focus:border-indigo-400"
                                  placeholder="0"
                                  min={0}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={handleSubmitPriceBook}
                  disabled={savingPriceBook || loadingPriceBook}
                  className="w-full py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
                >
                  {savingPriceBook ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Submit Price Book'
                  )}
                </button>

                {/* Retroactive sync for students imported before pricebook was created */}
                <button
                  onClick={async () => {
                    if (!selectedClass || !selectedYear) {
                      showToast('Please select a class and academic year first.', 'error');
                      return;
                    }
                    setSyncingFees(true);
                    try {
                      await api.post('/billing/pricebook/sync', { classId: selectedClass, academicYearId: selectedYear });
                      showToast('✅ Fee structure synced to all students in this class!', 'success');
                    } catch (err: any) {
                      showToast(err?.response?.data?.message || 'Sync failed. Please try again.', 'error');
                    } finally {
                      setSyncingFees(false);
                    }
                  }}
                  disabled={syncingFees || !selectedClass || !selectedYear}
                  className="w-full py-2.5 rounded-xl font-bold border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {syncingFees ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      Syncing fees to students...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Sync Fees to All Students
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-4">
          <a
            href="/dashboard/billing"
            className="text-slate-500 hover:text-indigo-600 text-sm font-semibold underline"
          >
            ← Back to Fee Management
          </a>
        </div>
      </div>
    </div>
  );
}
