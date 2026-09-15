'use client';

import React, { useState, useEffect } from 'react';
import { Library, BookOpen, UserPlus, CheckCircle, Save, Plus, ArrowLeftRight, X, AlertTriangle, BookMarked, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface BookCopy {
  id: string;
  barcode: string;
  status: 'AVAILABLE' | 'ISSUED' | 'LOST' | 'DAMAGED';
}

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  copies?: BookCopy[];
}

interface Student {
  id: string;
  rollNo: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  classSection?: {
    class: { name: string };
    section: { name: string };
  };
}

interface BorrowLog {
  id: string;
  bookCopy: {
    barcode: string;
    book: {
      title: string;
      author: string;
    };
  };
  borrower: {
    name: string;
    email: string;
  };
  issueDate: string;
  dueDate: string;
  returnDate: string | null;
  fineAmount: number;
  finePaid: boolean;
}

export default function LibraryCatalogPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'issue'>('catalog');
  const [books, setBooks] = useState<Book[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loans, setLoans] = useState<BorrowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState('');
  const [errorToast, setErrorToast] = useState('');

  // Add Book Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    category: 'General',
    totalCopies: 1,
  });

  // Issue Book State Form
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [daysToBorrow, setDaysToBorrow] = useState(14);

  const loadData = async () => {
    try {
      setLoading(true);
      const [booksRes, studentsRes, logsRes] = await Promise.all([
        api.get('/library/books'),
        api.get('/students'),
        api.get('/library/borrow-logs'),
      ]);

      setBooks(booksRes.data);
      setStudents(studentsRes.data);
      setLoans(logsRes.data);

      if (booksRes.data.length > 0) {
        setSelectedBookId(booksRes.data[0].id);
      }
      if (studentsRes.data.length > 0) {
        setSelectedStudentId(studentsRes.data[0].user.id);
      }
    } catch (err: any) {
      console.error('Failed to load library data:', err);
      setErrorToast('Could not load library details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author) {
      setErrorToast('Title and Author are required.');
      return;
    }

    try {
      setLoading(true);
      await api.post('/library/books', {
        title: newBook.title,
        author: newBook.author,
        isbn: newBook.isbn || undefined,
        category: newBook.category || undefined,
        totalCopies: Number(newBook.totalCopies) || 1,
      });

      setSuccessToast('Book added successfully to catalog!');
      setShowAddModal(false);
      setNewBook({
        title: '',
        author: '',
        isbn: '',
        category: 'General',
        totalCopies: 1,
      });
      await loadData();
    } catch (err: any) {
      console.error('Failed to add book:', err);
      setErrorToast(err.response?.data?.message || 'Error occurred while saving book.');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId || !selectedStudentId) {
      setErrorToast('Please select both a book and a student.');
      return;
    }

    const book = books.find((b) => b.id === selectedBookId);
    if (!book) {
      setErrorToast('Selected book not found.');
      return;
    }

    // Find available copy barcode
    const availableCopy = book.copies?.find((c) => c.status === 'AVAILABLE');
    if (!availableCopy) {
      setErrorToast('This book has no available copies for checkout!');
      return;
    }

    try {
      setLoading(true);
      await api.post('/library/borrow', {
        barcode: availableCopy.barcode,
        borrowerId: selectedStudentId,
        daysToBorrow: Number(daysToBorrow) || 14,
      });

      setSuccessToast(`Book "${book.title}" checked out successfully!`);
      await loadData();
      setActiveTab('catalog');
    } catch (err: any) {
      console.error('Failed to borrow book:', err);
      setErrorToast(err.response?.data?.message || 'Failed to borrow book copy.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnBook = async (barcode: string) => {
    if (!window.confirm(`Are you sure you want to return book copy with barcode ${barcode}?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.post('/library/return', {
        barcode,
        finePaid: true,
      });

      setSuccessToast(`Book copy ${barcode} returned successfully!`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to return book:', err);
      setErrorToast(err.response?.data?.message || 'Failed to process return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-3">
            <Library className="w-8 h-8 text-brand-500" />
            Library Catalog & Loans
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            Manage books metadata directories, check student loan cards, and track checkout registers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Book
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-4 font-bold transition-all border-b-2 ${
            activeTab === 'catalog' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Book Directory ({books.length})
        </button>
        <button
          onClick={() => setActiveTab('issue')}
          className={`pb-4 font-bold transition-all border-b-2 ${
            activeTab === 'issue' ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Issue Book / Loan Card
        </button>
      </div>

      {/* Toast Alerts */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between gap-3 text-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')} className="text-emerald-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorToast && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between gap-3 text-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorToast}</span>
          </div>
          <button onClick={() => setErrorToast('')} className="text-rose-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-10 h-10 text-brand-500 animate-spin" />
          <p className="text-slate-400 text-sm">Querying AWS PostgreSQL Database...</p>
        </div>
      ) : (
        <>
          {activeTab === 'catalog' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Books List table */}
              <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden shadow-xl h-fit">
                {books.length === 0 ? (
                  <div className="p-12 text-center space-y-4">
                    <BookMarked className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="font-bold text-slate-300">No Books Found</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                      There are no library books cataloged for your school yet. Click "Add New Book" to start compiling.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-900/60 bg-slate-900/10 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="px-6 py-4">Title / Author</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">ISBN</th>
                            <th className="px-6 py-4 text-right">Available Copies</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 text-slate-300 text-sm">
                          {books.map((book) => (
                            <tr key={book.id} className="hover:bg-slate-900/10 transition-colors">
                              <td className="px-6 py-4 font-semibold text-slate-200">
                                <div>{book.title}</div>
                                <div className="text-xs text-slate-500 font-light">by {book.author}</div>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400">{book.category || 'General'}</td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-500">{book.isbn || '—'}</td>
                              <td className="px-6 py-4 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  book.availableCopies > 0 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                  {book.availableCopies} / {book.totalCopies} Left
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block md:hidden divide-y divide-slate-900/60">
                      {books.map((book) => (
                        <div key={book.id} className="p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-slate-200">{book.title}</h4>
                              <p className="text-xs text-slate-500 font-light mt-0.5">by {book.author}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              book.availableCopies > 0 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {book.availableCopies} / {book.totalCopies} Left
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
                            <span className="px-2 py-0.5 rounded bg-slate-900/30 text-slate-400 border border-slate-800 text-[10px] font-semibold">
                              {book.category || 'General'}
                            </span>
                            <span className="font-mono text-slate-500 text-[11px]">
                              ISBN: {book.isbn || '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Active borrowing cards log */}
              <div className="glass-panel p-6 rounded-2xl shadow-xl h-fit space-y-4">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-brand-400" />
                  Active Checkouts Log ({loans.filter(l => !l.returnDate).length})
                </h3>
                {loans.filter(l => !l.returnDate).length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No active student loans recorded.</p>
                ) : (
                  <div className="divide-y divide-slate-900/60 max-h-[500px] overflow-y-auto pr-1">
                    {loans
                      .filter((loan) => !loan.returnDate)
                      .map((loan) => (
                        <div key={loan.id} className="py-3 flex justify-between items-start gap-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{loan.bookCopy.book.title}</p>
                            <p className="text-[10px] text-slate-500 font-light mt-0.5">
                              Borrower: {loan.borrower.name}
                            </p>
                            <p className="text-[9px] text-slate-600 font-mono">
                              Barcode: {loan.bookCopy.barcode}
                            </p>
                            <p className="text-[9px] text-amber-500/80 mt-1">
                              Due: {new Date(loan.dueDate).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleReturnBook(loan.bookCopy.barcode)}
                            className="text-[9px] font-bold text-brand-300 hover:text-white bg-brand-500/10 hover:bg-brand-500/30 border border-brand-500/20 px-2.5 py-1 rounded transition-all"
                          >
                            Return
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'issue' && (
            <div className="max-w-xl glass-panel p-6 rounded-2xl shadow-xl">
              <h3 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-400" />
                Checkout Library Loan
              </h3>

              {books.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  Please add books to the catalog first before checking them out.
                </div>
              ) : (
                <form onSubmit={handleIssueBook} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 font-semibold mb-1">Select Book Title</label>
                    <select
                      value={selectedBookId}
                      onChange={(e) => setSelectedBookId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                    >
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title} (by {b.author}) — {b.availableCopies} available
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 font-semibold mb-1">Assign to Student</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                    >
                      {students.map((s) => (
                        <option key={s.user.id} value={s.user.id}>
                          {s.rollNo ? `Roll ${s.rollNo}: ` : ''}{s.user.name} {s.classSection ? `(${s.classSection.class.name}-${s.classSection.section.name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 font-semibold mb-1">Duration (Days)</label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      required
                      value={daysToBorrow}
                      onChange={(e) => setDaysToBorrow(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all"
                  >
                    Issue Book & Record Loan
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-2xl relative border border-slate-850 animate-zoom-in">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="w-6 h-6 text-brand-500" />
              Add Book to Catalog
            </h3>
            <form onSubmit={handleAddBookSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Book Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Algorithms"
                  value={newBook.title}
                  onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-250 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Author Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thomas H. Cormen"
                  value={newBook.author}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-250 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">ISBN Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. 9780262033848"
                  value={newBook.isbn}
                  onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-250 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Category Genre</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science"
                  value={newBook.category}
                  onChange={(e) => setNewBook({ ...newBook, category: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-250 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1">Total Copies</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={newBook.totalCopies}
                  onChange={(e) => setNewBook({ ...newBook, totalCopies: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-850 rounded-xl px-4 py-2 text-sm text-slate-250 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/10 transition-all"
                >
                  Save Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
