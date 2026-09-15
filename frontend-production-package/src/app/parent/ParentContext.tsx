'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export interface Child {
  id: string;
  name: string;
  rollNo: string;
  avatarUrl: string | null;
  class: string;
  section: string;
  classSectionId: string;
  relationship: string;
  isPrimary: boolean;
  fatherName: string;
  motherName: string;
}

interface ParentContextType {
  children: Child[];
  selectedChild: Child | null;
  setSelectedChildId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ParentContext = createContext<ParentContextType | undefined>(undefined);

export function ParentProvider({ children }: { children: React.ReactNode }) {
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const res = await api.get('/parent-portal/children');
      const list = res.data || [];
      setChildrenList(list);
      
      if (list.length > 0) {
        const cached = localStorage.getItem('parent_selected_child_id');
        const found = list.find((c: any) => c.id === cached);
        if (found) {
          setSelectedChildId(found.id);
        } else {
          setSelectedChildId(list[0].id);
          localStorage.setItem('parent_selected_child_id', list[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch parent children:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  const handleSetSelectedChildId = (id: string) => {
    setSelectedChildId(id);
    localStorage.setItem('parent_selected_child_id', id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('parentChildChanged', { detail: id }));
    }
  };

  const selectedChild = childrenList.find(c => c.id === selectedChildId) || null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center text-slate-800 z-[99999]">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="w-14 h-14 border-4 border-t-[#2E5BFF] border-r-indigo-500 border-b-purple-500 border-l-slate-200 rounded-full animate-spin"></div>
          <div className="text-center mt-2">
            <h2 className="text-sm font-bold tracking-widest text-slate-900 uppercase font-sans">EduTrack Parent Portal</h2>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">Verifying linked student profiles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ParentContext.Provider value={{
      children: childrenList,
      selectedChild,
      setSelectedChildId: handleSetSelectedChildId,
      loading,
      refresh: fetchChildren
    }}>
      {children}
    </ParentContext.Provider>
  );
}

export function useParent() {
  const context = useContext(ParentContext);
  if (!context) {
    throw new Error('useParent must be used within a ParentProvider');
  }
  return context;
}
