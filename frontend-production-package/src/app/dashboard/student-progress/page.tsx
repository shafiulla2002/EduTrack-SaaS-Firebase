'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AreaChart, TrendingUp, BookOpen, Clock, FileText, CheckCircle2, ChevronRight, User } from 'lucide-react';

export default function StudentProgressPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [loadingStudentData, setLoadingStudentData] = useState(false);
  const [progress, setProgress] = useState<any | null>(null);
  const [hoveredBar, setHoveredBar] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await api.get('/teacher-portal/classes');
        setClasses(res.data);
      } catch (err) {
        console.error('Failed to load classes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setSelectedStudent('');
      setProgress(null);
      return;
    }
    async function loadStudents() {
      try {
        const res = await api.get(`/teacher-portal/classes/${selectedClass}/students`);
        setStudents(res.data);
        setSelectedStudent('');
        setProgress(null);
      } catch (err) {
        console.error('Failed to load students:', err);
      }
    }
    loadStudents();
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedStudent) {
      setProgress(null);
      return;
    }
    async function loadProgressDetails() {
      setLoadingStudentData(true);
      try {
        const res = await api.get(`/teacher-portal/student-progress/${selectedStudent}`);
        setProgress(res.data);
      } catch (err) {
        console.error('Failed to load progress details:', err);
      } finally {
        setLoadingStudentData(false);
      }
    }
    loadProgressDetails();
  }, [selectedStudent]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-md mx-auto sm:max-w-none">
        {/* Filter skeleton */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-pulse">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-slate-200 rounded-xl"></div>
            <div className="h-10 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm animate-pulse text-center">
              <div className="h-3 bg-slate-200 rounded w-16 mx-auto mb-2"></div>
              <div className="h-6 bg-slate-200 rounded w-12 mx-auto"></div>
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-slate-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Draw Raw SVG Bar Chart of Marks Trend
  const renderSVGChart = (marksHistory: any[]) => {
    if (!marksHistory || marksHistory.length === 0) return null;
    
    const validMarks = marksHistory.filter(m => m.score !== null);
    if (validMarks.length === 0) return null;

    // Calculate summaries
    const scores = validMarks.map(m => m.score);
    const highestScore = Math.max(...scores);
    const lowestScore = Math.min(...scores);
    const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    const latestExam = validMarks[validMarks.length - 1];
    const latestScore = latestExam ? latestExam.score : 0;
    
    // Overall Performance Trend
    let trend = 'Stable';
    let trendColor = 'text-blue-500 bg-blue-50 border-blue-100';
    if (validMarks.length >= 2) {
      // Simple compare: Latest score vs overall average
      if (latestScore > averageScore + 3) {
        trend = 'Improving';
        trendColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
      } else if (latestScore < averageScore - 3) {
        trend = 'Declining';
        trendColor = 'text-rose-600 bg-rose-50 border-rose-100';
      }
    }

    // Chart parameters
    const width = isMobile ? 380 : 600;
    const height = isMobile ? 200 : 280;
    const paddingLeft = isMobile ? 35 : 45;
    const paddingRight = isMobile ? 12 : 20;
    const paddingTop = isMobile ? 25 : 30;
    const paddingBottom = isMobile ? 50 : 75; // More room for rotated labels

    const xMin = paddingLeft;
    const xMax = width - paddingRight;
    const yMin = height - paddingBottom;
    const yMax = paddingTop;

    const chartWidth = xMax - xMin;
    const chartHeight = yMin - yMax;

    // Scale helpers
    const getBarX = (index: number) => {
      const slotWidth = chartWidth / validMarks.length;
      return xMin + index * slotWidth + (slotWidth * 0.2); // 20% gap left, 20% gap right
    };

    const getBarWidth = () => {
      const slotWidth = chartWidth / validMarks.length;
      return slotWidth * 0.6; // 60% of slot width is the bar
    };

    const getY = (score: number) => {
      return yMin - (score / 100) * chartHeight;
    };

    // Color coding helper
    const getBarColor = (score: number) => {
      if (score >= 90) return '#10b981'; // Emerald Green
      if (score >= 75) return '#3b82f6'; // Blue
      if (score >= 50) return '#f59e0b'; // Amber Yellow
      return '#ef4444'; // Rose Red
    };

    // Helper to truncate long exam names
    const truncateText = (text: string, maxLength: number) => {
      if (!text) return '';
      return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    };

    return (
      <div className="space-y-6">
        {/* Summary Statistics Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Highest Score</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-xl font-black text-emerald-600">{highestScore}%</span>
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lowest Score</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-xl font-black text-rose-500">{lowestScore}%</span>
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Average Score</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-xl font-black text-blue-600">{averageScore}%</span>
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Latest Exam</span>
            <div className="mt-1 text-slate-800">
              <div className="text-sm font-black truncate">{latestExam?.examName}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{latestScore}%</div>
            </div>
          </div>
          <div className={`p-3.5 rounded-2xl border shadow-xs flex flex-col justify-between ${trendColor}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">Performance Trend</span>
            <div className="flex items-center gap-1.5 mt-2 font-black text-xs uppercase tracking-wide">
              {trend}
            </div>
          </div>
        </div>

        {/* SVG Container with Custom Bar Chart */}
        <div className="relative w-full overflow-hidden bg-slate-50 p-3 sm:p-4 rounded-3xl border border-slate-100/80">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Gridlines */}
            {[0, 25, 50, 75, 100].map((val) => (
              <g key={val}>
                <line
                  x1={xMin}
                  y1={getY(val)}
                  x2={xMax}
                  y2={getY(val)}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <text
                  x={xMin - (isMobile ? 6 : 10)}
                  y={getY(val) + (isMobile ? 3 : 4)}
                  className={`font-bold fill-slate-400 ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}
                  textAnchor="end"
                >
                  {val}%
                </text>
              </g>
            ))}

            {/* Vertical Bars */}
            {validMarks.map((m, idx) => {
              const x = getBarX(idx);
              const barW = getBarWidth();
              const y = getY(m.score);
              const barH = yMin - y;
              const color = getBarColor(m.score);

              return (
                <g 
                  key={idx} 
                  className="group/bar cursor-pointer"
                  onMouseMove={(e) => {
                    setHoveredBar({
                      x: e.clientX,
                      y: e.clientY,
                      examName: m.examName,
                      score: m.score,
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Invisible padding rect for larger hover target area */}
                  <rect
                    x={x - (barW * 0.25)}
                    y={yMax}
                    width={barW * 1.5}
                    height={yMin - yMax}
                    fill="transparent"
                  />
                  {/* The visible score bar */}
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(barH, 4)} // ensure at least a small sliver is visible
                    fill={color}
                    opacity="0.85"
                    rx={3}
                    ry={3}
                    className="transition-all duration-200 group-hover/bar:opacity-100"
                  />
                  {/* Percentage value text on top of the bar */}
                  <text
                    x={x + barW / 2}
                    y={y - (isMobile ? 6 : 8)}
                    className={`font-extrabold fill-slate-700 transition-all group-hover/bar:fill-slate-900 ${isMobile ? 'text-[9px]' : 'text-[10px]'}`}
                    textAnchor="middle"
                  >
                    {m.score}%
                  </text>
                  {/* X-axis Label rotated slightly */}
                  <text
                    x={0}
                    y={0}
                    transform={`translate(${x + barW / 2}, ${yMin + (isMobile ? 10 : 16)}) rotate(-25)`}
                    className={`font-bold fill-slate-500 transition-colors group-hover/bar:fill-slate-800 ${isMobile ? 'text-[8.5px]' : 'text-[9px]'}`}
                    textAnchor="end"
                  >
                    {truncateText(m.examName, isMobile ? 8 : 12)}
                  </text>
                </g>
              );
            })}

            {/* Base X-Axis Line */}
            <line
              x1={xMin}
              y1={yMin}
              x2={xMax}
              y2={yMin}
              stroke="#CBD5E1"
              strokeWidth={1.5}
            />
          </svg>

          {/* Floating Tooltip Component */}
          {hoveredBar && (
            <div 
              className="fixed pointer-events-none z-50 bg-slate-950/95 text-white text-[11px] p-3 rounded-2xl shadow-xl border border-slate-800 backdrop-blur-md transition-all duration-100 flex flex-col gap-1 w-44"
              style={{ left: hoveredBar.x + 15, top: hoveredBar.y - 15 }}
            >
              <div className="font-extrabold text-slate-200 border-b border-slate-800 pb-1.5 truncate">
                {hoveredBar.examName}
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-slate-400 font-semibold">Percentage:</span>
                <span className="font-extrabold text-emerald-400">{hoveredBar.score}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Marks:</span>
                <span className="font-bold text-slate-300">{hoveredBar.score} / 100</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Grade:</span>
                <span className={`font-black ${
                  hoveredBar.score >= 90 ? 'text-emerald-400' : hoveredBar.score >= 75 ? 'text-blue-400' : hoveredBar.score >= 50 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {hoveredBar.score >= 90 ? 'Excellent' : hoveredBar.score >= 75 ? 'Good' : hoveredBar.score >= 50 ? 'Average' : 'Needs Imp.'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-md mx-auto sm:max-w-none pb-20">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#2E5BFF]" />
          Student Performance Analytics
        </h2>
      </div>

      {/* Select Filters Form */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class Section</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
            >
              <option value="">Select...</option>
              {classes.map(c => <option key={c.classSectionId} value={c.classSectionId}>{c.className}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Student</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2E5BFF] text-sm"
              disabled={!selectedClass}
            >
              <option value="">Select student...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.user.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loadingStudentData && (
        <div className="space-y-4">
          {/* Student profile skeleton */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 bg-slate-200 rounded-2xl shrink-0"></div>
            <div className="space-y-2 w-full">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-200 rounded w-1/4"></div>
            </div>
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm animate-pulse text-center">
                <div className="h-3 bg-slate-200 rounded w-16 mx-auto mb-2"></div>
                <div className="h-6 bg-slate-200 rounded w-12 mx-auto"></div>
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="h-48 bg-slate-100 rounded-2xl"></div>
          </div>
        </div>
      )}

      {/* Dashboard analytics */}
      {progress && (() => {
        // Calculations
        const validMarks = progress.marksHistory?.filter((m: any) => m.score !== null) || [];
        const scores = validMarks.map((m: any) => m.score);
        const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
        const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length) : 0;

        // Group marks by exam name for Exam Performance Comparison (one bar per exam)
        const examMap: Record<string, { totalScore: number; count: number; examName: string }> = {};
        validMarks.forEach((m: any) => {
          if (!examMap[m.examName]) {
            examMap[m.examName] = { totalScore: 0, count: 0, examName: m.examName };
          }
          examMap[m.examName].totalScore += m.score;
          examMap[m.examName].count += 1;
        });

        const aggregatedExams = Object.values(examMap).map(e => ({
          examName: e.examName,
          score: Math.round(e.totalScore / e.count)
        }));

        const latestExam = aggregatedExams[aggregatedExams.length - 1];
        const latestScore = latestExam ? latestExam.score : 0;
        const latestExamName = latestExam ? latestExam.examName : 'N/A';

        // Group marks by subject name for Subject Performance
        const subjectMap: Record<string, { totalScore: number; count: number; subjectName: string }> = {};
        validMarks.forEach((m: any) => {
          const subName = m.subjectName || 'Unknown';
          if (!subjectMap[subName]) {
            subjectMap[subName] = { totalScore: 0, count: 0, subjectName: subName };
          }
          subjectMap[subName].totalScore += m.score;
          subjectMap[subName].count += 1;
        });

        const subjectPerformance = Object.values(subjectMap).map(s => ({
          subjectName: s.subjectName,
          score: Math.round(s.totalScore / s.count)
        })).sort((a, b) => b.score - a.score); // sort by score desc

        // Calculate dynamic teacher insights
        const bestSubject = subjectPerformance[0];
        const worstSubject = subjectPerformance[subjectPerformance.length - 1];
        
        let mostImprovedExam = null;
        let largestDropExam = null;
        let maxImprovement = 0;
        let maxDrop = 0;

        for (let i = 1; i < aggregatedExams.length; i++) {
          const diff = aggregatedExams[i].score - aggregatedExams[i - 1].score;
          if (diff > maxImprovement) {
            maxImprovement = diff;
            mostImprovedExam = { examName: aggregatedExams[i].examName, diff };
          } else if (diff < maxDrop) {
            maxDrop = diff;
            largestDropExam = { examName: aggregatedExams[i].examName, diff };
          }
        }

        const attendanceVal = progress.stats?.attendanceRate ?? 100;
        const hwCompletionVal = progress.stats?.homeworkCompletion ?? 0;

        // Performance Trend
        let trendText = 'Stable';
        let trendIcon = '➡';
        let trendBadgeColor = 'text-slate-600 bg-slate-50 border-slate-200/60';
        let trendSubtext = 'No change from previous exam';
        
        if (aggregatedExams.length >= 2) {
          const latest = aggregatedExams[aggregatedExams.length - 1].score;
          const previous = aggregatedExams[aggregatedExams.length - 2].score;
          const diff = latest - previous;
          if (diff > 0) {
            trendText = 'Improving';
            trendIcon = '⬆';
            trendBadgeColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
            trendSubtext = `+${diff}% from previous exam`;
          } else if (diff < 0) {
            trendText = 'Declining';
            trendIcon = '⬇';
            trendBadgeColor = 'text-rose-600 bg-rose-50 border-rose-100';
            trendSubtext = `${diff}% from previous exam`;
          }
        }

        const getScoreColor = (score: number) => {
          if (score >= 90) return 'text-emerald-600';
          if (score >= 75) return 'text-blue-600';
          if (score >= 50) return 'text-amber-600';
          return 'text-rose-600';
        };

        const getScoreBg = (score: number) => {
          if (score >= 90) return 'bg-emerald-500';
          if (score >= 75) return 'bg-blue-500';
          if (score >= 50) return 'bg-amber-500';
          return 'bg-rose-500';
        };

        const getGrade = (score: number) => {
          if (score >= 90) return 'A+';
          if (score >= 75) return 'A';
          if (score >= 50) return 'B';
          return 'C';
        };

        const getResult = (score: number) => {
          return score >= 50 ? 'Pass' : 'Fail';
        };

        return (
          <div className="space-y-6">
            
            {/* Card Summary Profile */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 text-[#2E5BFF] rounded-2xl flex items-center justify-center font-bold text-lg shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[15px]">{progress.student?.name}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Roll No: {progress.student?.rollNo || 'N/A'}</p>
                </div>
              </div>
              
              {/* Performance Trend Indicator */}
              <div className={`px-4 py-2 rounded-2xl border flex flex-col items-end shrink-0 ${trendBadgeColor}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Trend</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-sm font-extrabold">{trendIcon} {trendText}</span>
                </div>
                {trendSubtext && (
                  <span className="text-[9px] font-semibold opacity-75 mt-0.5">{trendSubtext}</span>
                )}
              </div>
            </div>

            {/* KPI Cards Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Overall Score</span>
                <span className={`text-xl font-black ${getScoreColor(averageScore)}`}>{averageScore}%</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Highest Score</span>
                <span className={`text-xl font-black ${getScoreColor(highestScore)}`}>{highestScore}%</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Lowest Score</span>
                <span className={`text-xl font-black ${getScoreColor(lowestScore)}`}>{lowestScore}%</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Average Score</span>
                <span className={`text-xl font-black ${getScoreColor(averageScore)}`}>{averageScore}%</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Latest Exam</span>
                <span className={`text-xl font-black ${getScoreColor(latestScore)}`}>{latestScore}%</span>
                <span className="text-[9px] text-slate-500 font-medium block truncate mt-0.5" title={latestExamName}>{latestExamName}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Attendance</span>
                <span className={`text-xl font-black ${getScoreColor(attendanceVal)}`}>{attendanceVal}%</span>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Homework</span>
                <span className={`text-xl font-black ${getScoreColor(hwCompletionVal)}`}>{hwCompletionVal}%</span>
              </div>
            </div>

            {/* Performance Charts Section (Grid: Exam performance vs Subject performance) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Exam Performance Comparison */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-[14px]">Exam Performance Comparison</h3>
                {aggregatedExams.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs italic">No exam grades submitted yet.</div>
                ) : (
                  renderSVGChart(aggregatedExams)
                )}
              </div>

              {/* Subject Performance */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-[14px] mb-4">Subject Performance</h3>
                  {subjectPerformance.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs italic">No subject marks available.</div>
                  ) : (
                    <div className="space-y-4">
                      {subjectPerformance.map((sub, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                            <span>{sub.subjectName}</span>
                            <span className={getScoreColor(sub.score)}>{sub.score}%</span>
                          </div>
                          {/* Horizontal Progress bar */}
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${getScoreBg(sub.score)}`}
                              style={{ width: `${sub.score}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Legend standard indicator */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-500 mt-4">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Excellent (90-100%)
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Good (75-89%)
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Average (50-74%)
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Needs Imp. (&lt;50%)
                  </div>
                </div>
              </div>
            </div>

            {/* Insights & Recent Table Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Teacher Insights */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 lg:col-span-1">
                <h3 className="font-bold text-slate-800 text-[14px]">Teacher Insights</h3>
                <div className="space-y-3">
                  {bestSubject && (
                    <div className="flex gap-2.5 items-start p-2.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-xs font-semibold text-slate-800">
                      <span className="text-sm">✅</span>
                      <div>
                        <div className="text-emerald-800 font-bold">Best Subject</div>
                        <div className="text-[11px] text-emerald-700/90 mt-0.5">{bestSubject.subjectName} ({bestSubject.score}%)</div>
                      </div>
                    </div>
                  )}
                  {worstSubject && worstSubject.score < 75 && (
                    <div className="flex gap-2.5 items-start p-2.5 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs font-semibold text-slate-800">
                      <span className="text-sm">⚠</span>
                      <div>
                        <div className="text-amber-850 font-bold">Needs Improvement</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">{worstSubject.subjectName} ({worstSubject.score}%)</div>
                      </div>
                    </div>
                  )}
                  {mostImprovedExam && (
                    <div className="flex gap-2.5 items-start p-2.5 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs font-semibold text-slate-800">
                      <span className="text-sm">📈</span>
                      <div>
                        <div className="text-blue-800 font-bold">Most Improved Exam</div>
                        <div className="text-[11px] text-blue-700 mt-0.5">{mostImprovedExam.examName} (+{mostImprovedExam.diff}%)</div>
                      </div>
                    </div>
                  )}
                  {largestDropExam && (
                    <div className="flex gap-2.5 items-start p-2.5 rounded-2xl bg-rose-50/50 border border-rose-100 text-xs font-semibold text-slate-800">
                      <span className="text-sm">📉</span>
                      <div>
                        <div className="text-rose-800 font-bold">Largest Drop</div>
                        <div className="text-[11px] text-rose-700 mt-0.5">{largestDropExam.examName} ({largestDropExam.diff}%)</div>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2.5 items-start p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs font-semibold text-slate-800">
                    <span className="text-sm">⭐</span>
                    <div>
                      <div className="text-slate-800 font-bold">Attendance Record</div>
                      <div className="text-[11px] text-slate-650 mt-0.5">
                        {attendanceVal >= 90 ? 'Excellent Attendance' : 'Standard Attendance'}: {attendanceVal}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Exam Results Table */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2 overflow-hidden flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-[14px]">Recent Exam Results</h3>
                  {aggregatedExams.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs italic">No exam records.</div>
                  ) : (
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50">
                            <th className="py-2.5 px-3">Exam</th>
                            <th className="py-2.5 px-3 text-center">Percentage</th>
                            <th className="py-2.5 px-3 text-center">Grade</th>
                            <th className="py-2.5 px-3 text-center">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {aggregatedExams.map((exam, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors font-medium text-slate-700">
                              <td className="py-3 px-3 font-semibold text-slate-800">{exam.examName}</td>
                              <td className="py-3 px-3 text-center font-bold">{exam.score}%</td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${getScoreColor(exam.score)} bg-slate-50 border border-slate-100`}>
                                  {getGrade(exam.score)}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                                  getResult(exam.score) === 'Pass' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' : 'text-rose-700 bg-rose-50 border border-rose-100'
                                }`}>
                                  {getResult(exam.score)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Homework Completion Log */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-800 text-[14px]">Homework Completion Log</h3>
              {progress.homeworks?.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-xs italic">No assignments logs found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {progress.homeworks?.map((hw: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-2xl border border-slate-100 bg-slate-50/40">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 truncate max-w-[180px]">{hw.title}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Due: {hw.dueDate.split('T')[0]}</p>
                      </div>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase border ${
                        hw.submitted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                        {hw.submitted ? 'Submitted' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        );
      })()}

    </div>
  );
}
