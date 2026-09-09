'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, Search, Edit2, Trash2 } from 'lucide-react';
import { api, fastGet } from '@/lib/api';

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  status: string;
  paymentMode: string;
  description?: string;
}

const CATEGORY_OPTIONS = ['Salary', 'Utilities', 'Supplies', 'Maintenance', 'Rent', 'Other'];
const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PAID', label: 'Paid' }
];

const PAYMENT_OPTIONS = ['Cash', 'Bank Transfer', 'Cheque'];

const CATEGORY_ICONS: Record<string, string> = {
  Salary: '💰', Utilities: '💡', Supplies: '📦', Maintenance: '🔧', Rent: '🏠', Other: '📋'
};

const CATEGORY_COLORS: Record<string, string> = {
  Salary: 'border-l-purple-400 bg-purple-50/30',
  Utilities: 'border-l-amber-400 bg-amber-50/30',
  Supplies: 'border-l-blue-400 bg-blue-50/30',
  Maintenance: 'border-l-slate-400 bg-slate-50/30',
  Rent: 'border-l-emerald-400 bg-emerald-50/30',
  Other: 'border-l-slate-300 bg-slate-50/20',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ currentMonth: 0, prevMonth: 0, yearly: 0 });
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showAll, setShowAll] = useState(false);

  // Form
  const [currentExpense, setCurrentExpense] = useState<Partial<Expense>>({
    amount: 0, category: '', date: new Date().toISOString().split('T')[0],
    status: 'PENDING', description: '', paymentMode: 'Cash'
  });

  const isEditing = !!(currentExpense as Expense).id;

  const loadExpenses = async () => {
    try {
      const monthParam = showAll ? undefined : selectedMonth;
      const [expRes, sumRes] = await Promise.all([
        fastGet('/expenses', { params: monthParam ? { month: monthParam } : undefined }),
        fastGet('/expenses/summary')
      ]);
      setExpenses((expRes.data || []).map((e: any) => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount),
        date: new Date(e.date).toISOString().split('T')[0],
        status: e.status,
        paymentMode: e.paymentMode,
        description: e.description || ''
      })));
      if (sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth, showAll]);

  // Filtered list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (selectedCategory && e.category !== selectedCategory) return false;
      if (selectedStatus && e.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      if (!showAll && selectedMonth) {
        const expMonth = e.date.substring(0, 7);
        if (expMonth !== selectedMonth) return false;
      }
      return true;
    });
  }, [expenses, selectedCategory, selectedStatus, selectedMonth, showAll]);

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setCurrentExpense({ ...expense });
    } else {
      setCurrentExpense({
        amount: 0, category: '', date: new Date().toISOString().split('T')[0],
        status: 'PENDING', description: '', paymentMode: 'Cash'
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!currentExpense.amount || !currentExpense.category) {
      alert('Amount and Category are required!');
      return;
    }
    try {
      if (isEditing) {
        await api.put(`/expenses/${(currentExpense as Expense).id}`, {
          amount: Number(currentExpense.amount),
          category: currentExpense.category,
          date: currentExpense.date,
          status: currentExpense.status,
          paymentMode: currentExpense.paymentMode,
          description: currentExpense.description
        });
      } else {
        await api.post('/expenses', {
          amount: Number(currentExpense.amount),
          category: currentExpense.category,
          date: currentExpense.date,
          status: currentExpense.status,
          paymentMode: currentExpense.paymentMode,
          description: currentExpense.description
        });
      }
      setShowModal(false);
      loadExpenses();
    } catch (err) {
      console.error('Failed to save expense:', err);
      alert('Failed to save expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      try {
        await api.delete(`/expenses/${id}`);
        loadExpenses();
      } catch (err) {
        console.error('Failed to delete expense:', err);
        alert('Failed to delete expense');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-[24px] font-bold text-slate-900 leading-none">Expense Management</h2>
          <p className="text-slate-500 text-xs font-medium mt-1">Track and manage school expenses with category breakdown</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">This Month</span>
          <span className="text-2xl font-extrabold text-slate-800 mt-1 block">₹{summary.currentMonth.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Previous Month</span>
          <span className="text-2xl font-extrabold text-slate-800 mt-1 block">₹{summary.prevMonth.toLocaleString()}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Yearly Total</span>
          <span className="text-2xl font-extrabold text-slate-800 mt-1 block">₹{summary.yearly.toLocaleString()}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-50/50 border border-slate-200 rounded-xl p-4">
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none">
          <option value="">All Categories</option>
          {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold bg-white outline-none"
        />
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
          Show All
        </label>
      </div>

      {/* Expense Cards */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            <p className="font-semibold">No expenses found for selected filters</p>
          </div>
        ) : (
          filteredExpenses.map(exp => (
            <div key={exp.id} className={`bg-white border border-slate-200 border-l-4 rounded-xl p-4 flex items-center gap-4 shadow-xs hover:shadow-sm transition-all ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other}`}>
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl flex-shrink-0">
                {CATEGORY_ICONS[exp.category] || '📋'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{exp.category}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[exp.status] || STATUS_COLORS.Pending}`}>
                    {exp.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex gap-3">
                  <span>📅 {exp.date}</span>
                  <span>💳 {exp.paymentMode}</span>
                  {exp.description && <span className="truncate max-w-[200px]">{exp.description}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-extrabold text-slate-800 font-mono">₹{exp.amount.toLocaleString()}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleOpenModal(exp)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500" title="Edit">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(exp.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base">{isEditing ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Amount *</label>
                  <input type="number" value={currentExpense.amount || ''} onChange={e => setCurrentExpense({...currentExpense, amount: Number(e.target.value)})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" placeholder="₹0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Category *</label>
                  <select value={currentExpense.category || ''} onChange={e => setCurrentExpense({...currentExpense, category: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="">Select...</option>
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Date</label>
                  <input type="date" value={currentExpense.date || ''} onChange={e => setCurrentExpense({...currentExpense, date: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Status</label>
                  <select value={currentExpense.status || 'PENDING'} onChange={e => setCurrentExpense({...currentExpense, status: e.target.value})}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Payment Mode</label>
                <select value={currentExpense.paymentMode || 'Cash'} onChange={e => setCurrentExpense({...currentExpense, paymentMode: e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none">
                  {PAYMENT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Description</label>
                <textarea value={currentExpense.description || ''} onChange={e => setCurrentExpense({...currentExpense, description: e.target.value})}
                  rows={3} placeholder="Optional description..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md">
                {isEditing ? 'Update' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
