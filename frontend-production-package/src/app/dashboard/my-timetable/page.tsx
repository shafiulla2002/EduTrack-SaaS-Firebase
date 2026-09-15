'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Clock, BookOpen, MapPin, CalendarDays, ChevronRight } from 'lucide-react';

export default function MyTimetablePage() {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState('Monday');

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    async function loadTimetable() {
      try {
        const res = await api.get('/teacher-portal/timetable');
        setPeriods(res.data);
      } catch (err) {
        console.error('Failed to load timetable:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTimetable();
  }, []);

  const filteredPeriods = periods.filter(p => p.dayOfWeek === activeDay);

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-[#2E5BFF]" />
          My Lecture Timetable
        </h2>
      </div>

      {/* Touch Friendly Day Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none select-none">
        {daysOfWeek.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeDay === day
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Periods list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex justify-between items-center animate-pulse">
              <div className="flex items-start gap-4 w-full">
                <div className="w-12 h-12 rounded-2xl bg-slate-200 shrink-0"></div>
                <div className="space-y-2 w-full">
                  <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          ))
        ) : filteredPeriods.length === 0 ? (
          <div className="bg-white py-12 text-center text-slate-400 text-xs italic rounded-3xl border border-slate-200 shadow-sm">
            No lectures scheduled for {activeDay}.
          </div>
        ) : (
          filteredPeriods.map((p, idx) => {
            const isBreak = p.isBreak || p.periodTiming?.isBreak;

            if (isBreak) {
              const breakName = (p.subject?.name || p.periodTiming?.name || 'Break').toUpperCase();
              let badgeLine1 = 'BREAK';
              let badgeLine2 = '';

              if (breakName.includes('LUNCH') || breakName === 'BREAK') {
                badgeLine1 = 'LUNCH';
                badgeLine2 = 'BREAK';
              } else if (breakName.includes('SHORT')) {
                badgeLine1 = 'SHORT';
                badgeLine2 = 'BREAK';
              } else {
                const words = breakName.split(' ');
                badgeLine1 = words[0] || 'BREAK';
                badgeLine2 = words[1] || '';
              }

              return (
                <div key={idx} className="bg-slate-50/50 p-4 rounded-3xl border border-dashed border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex flex-col items-center justify-center font-bold shrink-0 border border-slate-200/60">
                      <span className="text-[9px] text-slate-400 uppercase leading-none font-bold">{badgeLine1}</span>
                      {badgeLine2 && (
                        <span className="text-[8px] text-slate-400 uppercase leading-none font-bold mt-1">{badgeLine2}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-650 text-xs uppercase tracking-wider">
                        {breakName === 'BREAK' ? 'LUNCH BREAK' : breakName}
                      </h3>
                      <p className="text-[11px] text-slate-450 font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {p.periodTiming.startTime} - {p.periodTiming.endTime}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex justify-between items-center group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2E5BFF] flex flex-col items-center justify-center font-bold shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase leading-none">Period</span>
                    <span className="text-lg leading-none mt-1">{p.periodTiming.displayPeriodNumber ?? p.periodTiming.periodNumber}</span>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 text-[14px]">
                      {p.classSection?.class?.name} - {p.classSection?.section?.name}
                    </h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 font-semibold">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        {p.subject?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {p.periodTiming.startTime} - {p.periodTiming.endTime}
                      </span>
                    </div>
                  </div>
                </div>

                {p.substituteTeacherId && (
                  <span className="bg-amber-50 text-amber-700 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-amber-100 shrink-0">
                    Substituted
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
