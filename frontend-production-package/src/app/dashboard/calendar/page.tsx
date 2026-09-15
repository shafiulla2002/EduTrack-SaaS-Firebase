'use client';

import React, { useState, useEffect } from 'react';
import { api, fastGet } from '@/lib/api';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pin, BookOpen, Clock, Tag } from 'lucide-react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const res = await fastGet(`/teacher-portal/calendar?month=${month + 1}&year=${year}`, undefined, { ttlMs: 30000 });
        setEvents(res.data);
      } catch (err) {
        console.error('Failed to load calendar events:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [currentDate]);

  // Calendar dates generation
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0: Sun, 1: Mon, etc.

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month); // Adjust to make Monday first if desired, but default Sunday is simple

  const daysArray = [];
  // Empty blocks for padding before first day
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  // Days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(new Date(year, month, i));
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(e => e.date === dateStr);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const getSelectedDateEvents = () => {
    if (!selectedDate) return [];
    return getEventsForDate(selectedDate);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none pb-20">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarIcon className="w-6 h-6 text-[#2E5BFF]" />
          Timeline Calendar
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Calendar Grid Card */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-800 text-sm">{monthNames[month]} {year}</h3>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>

          {/* Days Grid */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-t-[#2E5BFF] border-slate-200 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-y-3">
              {daysArray.map((date, idx) => {
                if (!date) return <div key={`pad-${idx}`} className="h-10" />;
                const dateEvents = getEventsForDate(date);
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                const isSunday = date.getDay() === 0;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(date)}
                    className={`h-10 w-10 mx-auto rounded-full flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                      isSelected ? 'bg-slate-900 text-white font-bold' :
                      isToday ? 'bg-blue-50 text-[#2E5BFF] font-bold border border-blue-200' :
                      isSunday ? 'text-rose-600 font-semibold hover:bg-rose-50' :
                      'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">{date.getDate()}</span>
                    {dateEvents.length > 0 && (
                      <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' :
                        dateEvents.some(e => e.type === 'HOLIDAY') ? 'bg-emerald-500' :
                        'bg-[#2E5BFF]'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Date Details panel */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-[14px] pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Timeline Schedule</span>
              {selectedDate && (
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  {selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              )}
            </h3>

            <div className="mt-4 space-y-3 flex-1 overflow-y-auto max-h-72">
              {getSelectedDateEvents().length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">No items scheduled for this day.</div>
              ) : (
                getSelectedDateEvents().map((ev, idx) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-1.5">
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase border ${
                      ev.type === 'EXAM' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      ev.type === 'LEAVE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      ev.type === 'HOMEWORK' ? 'bg-blue-50 text-[#2E5BFF] border-blue-100' :
                      ev.type === 'HOLIDAY' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      'bg-purple-50 text-purple-600 border-purple-100'
                    }`}>
                      {ev.type}
                    </span>
                    <h4 className="font-bold text-slate-800 text-xs leading-normal">{ev.title}</h4>
                    <p className="text-[10px] text-slate-500 font-light leading-relaxed">{ev.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
