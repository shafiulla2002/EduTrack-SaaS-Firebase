"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ClassSection = {
  Id: string;
  Name: string;
  className: string;
  sectionName: string;
  classId: string;
};

type Teacher = {
  Id: string;
  Name: string;
};

type Subject = {
  id: string;
  name: string;
};

type Timing = {
  id?: string;
  num: number;
  label: string;
  startTime: string;
  endTime: string;
  timeLabel?: string;
};

type TeacherWorkload = {
  teacherId: string;
  teacherName: string;
  subjectCount: number;
  classCount: number;
  totalPeriods: number;
  loadPercent: number;
};

type ClassWorkload = {
  classSectionId: string;
  name: string;
  academicYear: string;
  subjectCount: number;
  staffedCount: number;
  loadPercent: number;
};

export default function TimetablePage() {
  const [activeTab, setActiveTab] = useState<"grid" | "sections" | "teachers" | "subjects">("grid");
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timings, setTimings] = useState<Timing[]>([]);

  // Selected filters for grid
  const [selectedClassSectionId, setSelectedClassSectionId] = useState("");
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [timetableData, setTimetableData] = useState<Record<string, any>>({});
  
  // Workload and summary data
  const [workloadSummary, setWorkloadSummary] = useState<any>(null);
  const [teacherWorkloads, setTeacherWorkloads] = useState<TeacherWorkload[]>([]);
  const [classWorkloads, setClassWorkloads] = useState<ClassWorkload[]>([]);

  // Modals and form states
  const [editingCell, setEditingCell] = useState<{ day: string; num: number } | null>(null);
  const [substituteCell, setSubstituteCell] = useState<{ day: string; num: number; periodId: string } | null>(null);
  const [cellSubjectId, setCellSubjectId] = useState("");
  const [cellTeacherId, setCellTeacherId] = useState("");
  const [cellSubTeacherId, setCellSubTeacherId] = useState("");
  const [cellTeachersOptions, setCellTeachersOptions] = useState<any[]>([]);

  // Class Section Setup Form
  const [setupClassId, setSetupClassId] = useState("");
  const [setupSectionId, setSetupSectionId] = useState("");
  const [setupStrength, setSetupStrength] = useState(40);
  const [setupSubjects, setSetupSubjects] = useState<{ subjectId: string; teacherId: string; periods: number }[]>([
    { subjectId: "", teacherId: "", periods: 5 }
  ]);

  // Timing inputs
  const [timingInputs, setTimingInputs] = useState<Timing[]>([]);

  // Subject inputs
  const [newSubName, setNewSubName] = useState("");
  const [bulkSubText, setBulkSubText] = useState("");

  // Teacher inputs
  const [newTeacher, setNewTeacher] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    qualification: "",
    designation: "",
    basicSalary: 0,
    allowances: 0,
    deductions: 0,
    pf: 0,
    bankAccountNumber: "",
    ifscCode: "",
    skills: [{ subjectId: "", skillLevel: "Expert", yearsOfExperience: 2 }]
  });
  const [bulkTeacherText, setBulkTeacherText] = useState("");

  // Notifications
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const API_HEADERS = {
    "Content-Type": "application/json",
  };

  // Fetch initial configuration data
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };

      // Academic Years
      const ayRes = await fetch("/timetable/academic-years", { headers });
      if (ayRes.ok) {
        const data = await ayRes.json();
        setAcademicYears(data);
        if (data.length > 0) setSelectedAcademicYearId(data[0].id);
      }

      // Classes
      const cRes = await fetch("/timetable/classes", { headers });
      if (cRes.ok) setClasses(await cRes.json());

      // Sections
      const sRes = await fetch("/timetable/sections", { headers });
      if (sRes.ok) setSections(await sRes.json());

      // Class Sections
      const csRes = await fetch("/timetable/class-sections", { headers });
      if (csRes.ok) {
        const data = await csRes.json();
        setClassSections(data);
        if (data.length > 0) setSelectedClassSectionId(data[0].Id);
      }

      // Teachers
      const tRes = await fetch("/timetable/teachers", { headers });
      if (tRes.ok) setTeachers(await tRes.json());

      // Subjects
      const subRes = await fetch("/timetable/subjects", { headers });
      if (subRes.ok) setSubjects(await subRes.json());

      // Period Timings
      const ptRes = await fetch("/timetable/period-timings", { headers });
      if (ptRes.ok) {
        const data = await ptRes.json();
        setTimings(data);
        setTimingInputs(data.length > 0 ? data : [
          { num: 1, label: "Period 1", startTime: "08:30 AM", endTime: "09:30 AM" },
          { num: 2, label: "Period 2", startTime: "09:30 AM", endTime: "10:30 AM" },
          { num: 3, label: "Period 3", startTime: "10:45 AM", endTime: "11:45 AM" },
          { num: 4, label: "Period 4", startTime: "11:45 AM", endTime: "12:45 PM" },
          { num: 5, label: "Period 5", startTime: "01:30 PM", endTime: "02:30 PM" },
          { num: 6, label: "Period 6", startTime: "02:30 PM", endTime: "03:30 PM" }
        ]);
      }

      // Workloads
      fetchWorkloads(headers);

    } catch (err) {
      console.error("Error fetching metadata:", err);
    }
  };

  const fetchWorkloads = async (headers: any) => {
    const summaryRes = await fetch("/timetable/workload/summary", { headers });
    if (summaryRes.ok) setWorkloadSummary(await summaryRes.json());

    const tWorkRes = await fetch("/timetable/workload/teachers", { headers });
    if (tWorkRes.ok) setTeacherWorkloads(await tWorkRes.json());

    const cWorkRes = await fetch("/timetable/workload/classes", { headers });
    if (cWorkRes.ok) setClassWorkloads(await cWorkRes.json());
  };

  // Load Timetable Grid when filter changes
  useEffect(() => {
    if (selectedClassSectionId && selectedAcademicYearId) {
      fetchTimetableGrid();
    }
  }, [selectedClassSectionId, selectedAcademicYearId]);

  const fetchTimetableGrid = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/timetable/class/${selectedClassSectionId}/periods?academicYearId=${selectedAcademicYearId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTimetableData(await res.json());
      }
    } catch (err) {
      console.error("Error loading timetable grid:", err);
    }
  };

  // Timetable saving
  const handleSaveTimetable = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const cells = [];
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      for (const day of days) {
        for (const t of timings) {
          const key = `${day}_${t.id}`;
          const cell = timetableData[key];
          if (cell && cell.subjectId && cell.teacherId) {
            cells.push({
              day,
              periodNumber: t.num,
              subjectId: cell.subjectId,
              teacherId: cell.teacherId,
              startTime: t.startTime,
              endTime: t.endTime
            });
          }
        }
      }

      const res = await fetch("/timetable/periods/save", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          classSectionId: selectedClassSectionId,
          academicYearId: selectedAcademicYearId,
          periods: cells
        })
      });

      if (res.ok) {
        showAlert("success", "Timetable grid saved successfully!");
        fetchTimetableGrid();
        const headers = { ...API_HEADERS, Authorization: `Bearer ${token}` };
        fetchWorkloads(headers);
      } else {
        const err = await res.json();
        showAlert("error", err.message || "Failed to save timetable grid.");
      }
    } catch (err) {
      showAlert("error", "Network error occurred.");
    }
  };

  // Edit cell modal opening
  const handleOpenEditCell = async (day: string, num: number, timingId: string) => {
    setEditingCell({ day, num });
    const key = `${day}_${timingId}`;
    const cell = timetableData[key];
    setCellSubjectId(cell?.subjectId || "");
    setCellTeacherId(cell?.teacherId || "");
    setCellTeachersOptions([]);

    if (cell?.subjectId) {
      fetchTeachersForSubject(cell.subjectId);
    }
  };

  const fetchTeachersForSubject = async (subId: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/timetable/teachers/subject?subjectIds=${subId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCellTeachersOptions(data[subId] || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCellSubjectChange = (subId: string) => {
    setCellSubjectId(subId);
    setCellTeacherId("");
    setCellTeachersOptions([]);
    if (subId) {
      fetchTeachersForSubject(subId);
    }
  };

  const handleSaveCell = (timingId: string) => {
    if (!editingCell) return;
    const key = `${editingCell.day}_${timingId}`;
    
    const newGrid = { ...timetableData };
    if (!cellSubjectId || !cellTeacherId) {
      delete newGrid[key];
    } else {
      newGrid[key] = {
        subjectId: cellSubjectId,
        teacherId: cellTeacherId,
        subjectName: subjects.find(s => s.id === cellSubjectId)?.name || "",
        teacherName: teachers.find(t => t.Id === cellTeacherId)?.Name || ""
      };
    }
    setTimetableData(newGrid);
    setEditingCell(null);
  };

  // Leave substitution management
  const handleOpenSubstitute = (day: string, num: number, timingId: string) => {
    const key = `${day}_${timingId}`;
    const cell = timetableData[key];
    if (!cell || !cell.periodId) {
      showAlert("error", "Please save the timetable grid before assigning substitutes.");
      return;
    }
    setSubstituteCell({ day, num, periodId: cell.periodId });
    setCellSubTeacherId(cell.substituteTeacherId || "");
  };

  const handleSaveSubstitute = async () => {
    if (!substituteCell) return;
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/periods/substitute", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          periodId: substituteCell.periodId,
          substituteTeacherId: cellSubTeacherId
        })
      });

      if (res.ok) {
        showAlert("success", "Substitute teacher updated successfully!");
        setSubstituteCell(null);
        fetchTimetableGrid();
      } else {
        showAlert("error", "Failed to update substitute.");
      }
    } catch (err) {
      showAlert("error", "Network error occurred.");
    }
  };

  // Add timing slot helper
  const handleAddTimingInput = () => {
    const nextNum = timingInputs.length + 1;
    setTimingInputs([...timingInputs, {
      num: nextNum,
      label: `Period ${nextNum}`,
      startTime: "",
      endTime: ""
    }]);
  };

  const handleSavePeriodTimings = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/period-timings", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify(timingInputs)
      });

      if (res.ok) {
        showAlert("success", "Period timings configured successfully!");
        fetchMetadata();
      } else {
        showAlert("error", "Failed to save period timings.");
      }
    } catch (err) {
      showAlert("error", "Network error.");
    }
  };

  // Single Class creation
  const handleCreateClass = async (name: string) => {
    if (!name) return;
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/classes", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        showAlert("success", "Class created!");
        fetchMetadata();
      } else {
        showAlert("error", "Duplicate class name or execution error.");
      }
    } catch (err) {}
  };

  // Single Section creation
  const handleCreateSection = async (name: string) => {
    if (!name) return;
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/sections", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        showAlert("success", "Section created!");
        fetchMetadata();
      } else {
        showAlert("error", "Duplicate section name.");
      }
    } catch (err) {}
  };

  // Create Class Section Setup
  const handleClassSectionSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupClassId || !setupSectionId) {
      showAlert("error", "Please select a Class and Section.");
      return;
    }

    const subTeacherMap: Record<string, string[]> = {};
    const subPeriodsMap: Record<string, number[]> = {};

    for (const item of setupSubjects) {
      if (item.subjectId && item.teacherId) {
        if (!subTeacherMap[item.subjectId]) {
          subTeacherMap[item.subjectId] = [];
          subPeriodsMap[item.subjectId] = [];
        }
        subTeacherMap[item.subjectId].push(item.teacherId);
        subPeriodsMap[item.subjectId].push(item.periods);
      }
    }

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/class-sections", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          academicYearId: selectedAcademicYearId,
          classId: setupClassId,
          sectionId: setupSectionId,
          classStrength: setupStrength,
          subjectTeacherMap: subTeacherMap,
          subjectPeriodsMap: subPeriodsMap
        })
      });

      if (res.ok) {
        showAlert("success", "Class section set up successfully!");
        setSetupClassId("");
        setSetupSectionId("");
        setSetupStrength(40);
        setSetupSubjects([{ subjectId: "", teacherId: "", periods: 5 }]);
        fetchMetadata();
      } else {
        const err = await res.json();
        showAlert("error", err.message || "Failed to save setup.");
      }
    } catch (err) {
      showAlert("error", "Network error.");
    }
  };

  // Add Subject row in setup
  const handleAddSetupSubjectRow = () => {
    setSetupSubjects([...setupSubjects, { subjectId: "", teacherId: "", periods: 5 }]);
  };

  // Create single subject
  const handleCreateSubject = async () => {
    if (!newSubName) return;
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/subjects", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newSubName })
      });
      if (res.ok) {
        showAlert("success", "Subject created!");
        setNewSubName("");
        fetchMetadata();
      } else {
        showAlert("error", "Subject already exists.");
      }
    } catch (err) {}
  };

  // Bulk subjects create
  const handleBulkSubjects = async () => {
    if (!bulkSubText) return;
    const items = bulkSubText.split("\n").map(l => l.trim()).filter(Boolean).map(name => ({ name }));
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/subjects/bulk", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjects: items })
      });
      if (res.ok) {
        const result = await res.json();
        showAlert("success", `Bulk process: Created ${result.created}, Skipped ${result.skipped}.`);
        setBulkSubText("");
        fetchMetadata();
      } else {
        showAlert("error", "Failed to process bulk list.");
      }
    } catch (err) {}
  };

  // Create single teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/teachers", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify(newTeacher)
      });
      if (res.ok) {
        showAlert("success", "Teacher created successfully!");
        setNewTeacher({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          qualification: "",
          designation: "",
          basicSalary: 0,
          allowances: 0,
          deductions: 0,
          pf: 0,
          bankAccountNumber: "",
          ifscCode: "",
          skills: [{ subjectId: "", skillLevel: "Expert", yearsOfExperience: 2 }]
        });
        fetchMetadata();
      } else {
        const err = await res.json();
        showAlert("error", err.message || "Failed to create teacher.");
      }
    } catch (err) {}
  };

  // Bulk teachers import
  const handleBulkTeachers = async () => {
    if (!bulkTeacherText) return;
    try {
      // Basic CSV-like parse for demonstration
      const lines = bulkTeacherText.split("\n").map(l => l.trim()).filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim());
      const dataRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || "";
        });
        // Salary parse
        if (rowObj.basicSalary) rowObj.basicSalary = Number(rowObj.basicSalary);
        if (rowObj.da) rowObj.da = Number(rowObj.da);
        if (rowObj.hra) rowObj.hra = Number(rowObj.hra);
        if (rowObj.pf) rowObj.pf = Number(rowObj.pf);
        dataRows.push(rowObj);
      }

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/timetable/teachers/bulk", {
        method: "POST",
        headers: { ...API_HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teachers: dataRows })
      });

      if (res.ok) {
        const result = await res.json();
        showAlert("success", `Bulk imported: Created ${result.created}, Skipped ${result.skipped}, Skills added ${result.skillsCreated}.`);
        setBulkTeacherText("");
        fetchMetadata();
      } else {
        showAlert("error", "Bulk teachers format error.");
      }
    } catch (err) {}
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Alert Component */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg transition-all duration-300 ${
          alert.type === "success" ? "bg-emerald-950/80 border border-emerald-500 text-emerald-200" : "bg-rose-950/80 border border-rose-500 text-rose-200"
        } backdrop-blur-md`}>
          <div className="flex items-center gap-2">
            <span className="font-bold">{alert.type === "success" ? "✓" : "⚠"}</span>
            <p>{alert.message}</p>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Timetable & Scheduler
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Configure periods, assign teaching assignments, plan substitutions, and monitor workload balances dynamically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn-secondary py-2 px-4 rounded text-sm text-gray-300 hover:text-white border border-gray-700 bg-gray-900/40">
            Back to Dashboard
          </Link>
          <button onClick={fetchMetadata} className="btn-primary py-2 px-4 rounded text-sm">
            Refresh Setup
          </button>
        </div>
      </header>

      {/* Workload Widgets */}
      {workloadSummary && (
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass p-5 rounded-lg border border-white/10 flex flex-col justify-between">
            <span className="text-gray-400 text-xs uppercase font-semibold">Active Class Sections</span>
            <span className="text-3xl font-bold mt-2">{workloadSummary.totalClassSections}</span>
          </div>
          <div className="glass p-5 rounded-lg border border-white/10 flex flex-col justify-between">
            <span className="text-gray-400 text-xs uppercase font-semibold">Teachers Engaged</span>
            <span className="text-3xl font-bold mt-2">{workloadSummary.totalTeachers}</span>
          </div>
          <div className="glass p-5 rounded-lg border border-white/10 flex flex-col justify-between">
            <span className="text-gray-400 text-xs uppercase font-semibold">Total Subject Staffings</span>
            <span className="text-3xl font-bold mt-2">{workloadSummary.totalAssignments}</span>
          </div>
          <div className="glass p-5 rounded-lg border border-white/10 flex flex-col justify-between">
            <span className="text-gray-400 text-xs uppercase font-semibold">Average Teacher Load</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-3xl font-bold">{workloadSummary.avgLoadPercent}%</span>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${workloadSummary.avgLoadPercent}%` }}></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <nav className="flex border-b border-gray-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("grid")}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === "grid" ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Timetable Grid
        </button>
        <button
          onClick={() => setActiveTab("sections")}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === "sections" ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Class Section Setup
        </button>
        <button
          onClick={() => setActiveTab("teachers")}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === "teachers" ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Teacher Management
        </button>
        <button
          onClick={() => setActiveTab("subjects")}
          className={`py-3 px-6 font-semibold border-b-2 text-sm transition-all ${
            activeTab === "subjects" ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Subjects & timings
        </button>
      </nav>

      {/* Main Tab Contents */}
      <main className="mb-12">
        {activeTab === "grid" && (
          <div className="flex flex-col gap-6">
            {/* Filters panel */}
            <div className="glass p-5 rounded-lg border border-white/10 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 font-semibold mb-1">Class Section</label>
                  <select
                    value={selectedClassSectionId}
                    onChange={(e) => setSelectedClassSectionId(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded p-2 text-sm min-w-[200px]"
                  >
                    <option value="">Select Class Section</option>
                    {classSections.map((cs) => (
                      <option key={cs.Id} value={cs.Id}>{cs.Name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 font-semibold mb-1">Academic Year</label>
                  <select
                    value={selectedAcademicYearId}
                    onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded p-2 text-sm min-w-[150px]"
                  >
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>{ay.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <button
                  onClick={handleSaveTimetable}
                  className="btn-primary py-2 px-6 rounded text-sm hover:scale-102 transition-transform"
                >
                  Save Timetable
                </button>
              </div>
            </div>

            {/* Grid display */}
            <div className="glass rounded-lg border border-white/10 overflow-x-auto p-4">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="p-3 text-xs uppercase text-gray-400 font-bold w-[120px]">Day</th>
                    {timings.map((t) => (
                      <th key={t.id} className="p-3 text-xs uppercase text-gray-400 font-bold min-w-[150px]">
                        <div>{t.label}</div>
                        <div className="text-[10px] text-gray-500 font-normal">{t.timeLabel}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                    <tr key={day} className="border-b border-gray-900/60 hover:bg-white/2 bg-white/1">
                      <td className="p-3 font-semibold text-gray-200 text-sm">{day}</td>
                      {timings.map((t) => {
                        const key = `${day}_${t.id}`;
                        const cell = timetableData[key];
                        return (
                          <td key={t.id} className="p-2">
                            {cell ? (
                              <div className={`p-3 rounded-md border text-xs flex flex-col justify-between min-h-[90px] relative transition-all group ${
                                cell.isOnLeave 
                                  ? "bg-rose-950/40 border-rose-500/30 text-rose-200" 
                                  : "bg-indigo-950/30 border-indigo-500/20 text-indigo-200 hover:border-indigo-500/40"
                              }`}>
                                <div className="font-bold text-sm mb-1 truncate">{cell.subjectName}</div>
                                <div className="text-[10px] text-gray-400 mb-1 truncate">{cell.teacherName}</div>
                                {cell.isOnLeave && (
                                  <div className="text-[9px] font-bold text-rose-400 flex items-center gap-1">
                                    <span>⚠</span> Substitute
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                  <button
                                    onClick={() => handleOpenEditCell(day, t.num, t.id || "")}
                                    title="Edit assignment"
                                    className="p-1 rounded bg-indigo-900/80 text-indigo-200 hover:bg-indigo-800 text-[10px]"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onClick={() => handleOpenSubstitute(day, t.num, t.id || "")}
                                    title="Assign substitute"
                                    className="p-1 rounded bg-rose-900/80 text-rose-200 hover:bg-rose-800 text-[10px]"
                                  >
                                    ⇄
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenEditCell(day, t.num, t.id || "")}
                                className="w-full p-4 rounded-md border border-dashed border-gray-800 hover:border-gray-600 text-[11px] text-gray-500 hover:text-gray-300 min-h-[90px] transition-colors flex flex-col justify-center items-center gap-1"
                              >
                                <span>+</span> Add Period
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "sections" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Setup Form */}
            <div className="glass p-6 rounded-lg border border-white/10">
              <h2 className="text-xl font-bold mb-4 text-white">Class Section Setup Wizard</h2>
              <form onSubmit={handleClassSectionSetup} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Class Name</label>
                    <select
                      value={setupClassId}
                      onChange={(e) => setSetupClassId(e.target.value)}
                      required
                      className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                    >
                      <option value="">Select Class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-semibold mb-1 block">Section Name</label>
                    <select
                      value={setupSectionId}
                      onChange={(e) => setSetupSectionId(e.target.value)}
                      required
                      className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                    >
                      <option value="">Select Section</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-semibold mb-1 block">Class Strength Capacity</label>
                  <input
                    type="number"
                    value={setupStrength}
                    onChange={(e) => setSetupStrength(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                  />
                </div>

                <div className="border-t border-gray-800 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-300">Staff Assignments</h3>
                    <button
                      type="button"
                      onClick={handleAddSetupSubjectRow}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      + Add Subject
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {setupSubjects.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={row.subjectId}
                          onChange={(e) => {
                            const copy = [...setupSubjects];
                            copy[idx].subjectId = e.target.value;
                            setSetupSubjects(copy);
                          }}
                          required
                          className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                        >
                          <option value="">Choose Subject</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <select
                          value={row.teacherId}
                          onChange={(e) => {
                            const copy = [...setupSubjects];
                            copy[idx].teacherId = e.target.value;
                            setSetupSubjects(copy);
                          }}
                          required
                          className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                        >
                          <option value="">Assign Teacher</option>
                          {teachers.map((t) => (
                            <option key={t.Id} value={t.Id}>{t.Name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          placeholder="Periods"
                          value={row.periods}
                          onChange={(e) => {
                            const copy = [...setupSubjects];
                            copy[idx].periods = Number(e.target.value);
                            setSetupSubjects(copy);
                          }}
                          required
                          className="w-20 bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                        />
                        {setupSubjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSetupSubjects(setupSubjects.filter((_, i) => i !== idx))}
                            className="text-xs text-rose-500 p-2 hover:bg-rose-500/10 rounded"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn-primary py-2 px-6 rounded mt-4 text-sm w-full">
                  Create Class Section & Staff Assignments
                </button>
              </form>
            </div>

            {/* Class Section list & Workload */}
            <div className="glass p-6 rounded-lg border border-white/10 flex flex-col gap-6">
              <h2 className="text-xl font-bold text-white">Class Section Workload Tracking</h2>
              <div className="flex flex-col gap-4">
                {classWorkloads.map((cs) => (
                  <div key={cs.classSectionId} className="p-4 rounded border border-gray-800 bg-white/2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-200">{cs.name}</span>
                      <span className="text-xs text-gray-400">{cs.academicYear}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <span>Staffed: {cs.staffedCount} / {cs.subjectCount} subjects</span>
                      <span>{cs.loadPercent}% Staffed</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${cs.loadPercent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "teachers" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Teacher */}
            <div className="glass p-6 rounded-lg border border-white/10">
              <h2 className="text-xl font-bold mb-4 text-white">Register New Staff Profile</h2>
              <form onSubmit={handleCreateTeacher} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newTeacher.firstName}
                      onChange={(e) => setNewTeacher({ ...newTeacher, firstName: e.target.value })}
                      className="bg-gray-950 border border-gray-800 rounded p-2 text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newTeacher.lastName}
                      onChange={(e) => setNewTeacher({ ...newTeacher, lastName: e.target.value })}
                      className="bg-gray-950 border border-gray-800 rounded p-2 text-sm w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newTeacher.email}
                      onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                      className="bg-gray-950 border border-gray-800 rounded p-2 text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Phone</label>
                    <input
                      type="text"
                      value={newTeacher.phone}
                      onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })}
                      className="bg-gray-950 border border-gray-800 rounded p-2 text-sm w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Qualification</label>
                    <input
                      type="text"
                      value={newTeacher.qualification}
                      onChange={(e) => setNewTeacher({ ...newTeacher, qualification: e.target.value })}
                      className="bg-gray-950 border border-gray-800 rounded p-2 text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Designation</label>
                    <input
                      type="text"
                      value={newTeacher.designation}
                      onChange={(e) => setNewTeacher({ ...newTeacher, designation: e.target.value })}
                      className="bg-gray-950 border border-gray-800 rounded p-2 text-sm w-full"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-300">Skills & Qualifications</h3>
                    <button
                      type="button"
                      onClick={() => setNewTeacher({
                        ...newTeacher,
                        skills: [...newTeacher.skills, { subjectId: "", skillLevel: "Expert", yearsOfExperience: 2 }]
                      })}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      + Add Skill
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {newTeacher.skills.map((skill, idx) => (
                      <div key={idx} className="flex gap-2">
                        <select
                          value={skill.subjectId}
                          onChange={(e) => {
                            const copy = [...newTeacher.skills];
                            copy[idx].subjectId = e.target.value;
                            setNewTeacher({ ...newTeacher, skills: copy });
                          }}
                          required
                          className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                        >
                          <option value="">Subject</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <select
                          value={skill.skillLevel}
                          onChange={(e) => {
                            const copy = [...newTeacher.skills];
                            copy[idx].skillLevel = e.target.value;
                            setNewTeacher({ ...newTeacher, skills: copy });
                          }}
                          required
                          className="w-32 bg-gray-950 border border-gray-800 rounded p-2 text-sm"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Expert">Expert</option>
                        </select>
                        {newTeacher.skills.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewTeacher({
                              ...newTeacher,
                              skills: newTeacher.skills.filter((_, i) => i !== idx)
                            })}
                            className="text-xs text-rose-500 p-2 hover:bg-rose-500/10 rounded"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn-primary py-2 px-6 rounded mt-4 text-sm w-full">
                  Create Teacher Profile
                </button>
              </form>
            </div>

            {/* Bulk Import & Workload */}
            <div className="flex flex-col gap-8">
              {/* Bulk import */}
              <div className="glass p-6 rounded-lg border border-white/10">
                <h2 className="text-xl font-bold mb-4 text-white">Bulk CSV Teacher Import</h2>
                <textarea
                  value={bulkTeacherText}
                  onChange={(e) => setBulkTeacherText(e.target.value)}
                  placeholder="firstName,lastName,email,phone,designation,subject1,skillLevel1&#10;John,Doe,john@school.com,123456,Mathematics Lecturer,Mathematics,Expert"
                  className="bg-gray-950 border border-gray-800 rounded p-2 text-xs w-full h-[150px] font-mono text-gray-300 placeholder:text-gray-600 mb-3 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleBulkTeachers}
                  className="btn-primary py-2 px-6 rounded text-sm w-full"
                >
                  Import Teachers CSV
                </button>
              </div>

              {/* Workloads list */}
              <div className="glass p-6 rounded-lg border border-white/10 flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-2">Teacher Workload Balancing</h2>
                {teacherWorkloads.map((tw) => (
                  <div key={tw.teacherId} className="flex justify-between items-center text-sm p-2 rounded border border-gray-800 bg-white/1">
                    <div>
                      <div className="font-semibold text-gray-200">{tw.teacherName}</div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {tw.subjectCount} subjects • {tw.classCount} class sections • {tw.totalPeriods} periods/week
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${
                        tw.loadPercent > 80 ? "text-rose-400" : tw.loadPercent > 50 ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {tw.loadPercent}%
                      </span>
                      <div className="w-16 bg-gray-800 rounded-full h-1">
                        <div className={`h-1 rounded-full ${
                          tw.loadPercent > 80 ? "bg-rose-500" : tw.loadPercent > 50 ? "bg-amber-500" : "bg-emerald-500"
                        }`} style={{ width: `${tw.loadPercent}%` }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "subjects" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* timings Setup */}
            <div className="glass p-6 rounded-lg border border-white/10">
              <h2 className="text-xl font-bold mb-4 text-white">Period timings settings</h2>
              <div className="flex flex-col gap-4">
                {timingInputs.map((t, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 font-bold w-12">P{t.num}</span>
                    <input
                      type="text"
                      placeholder="Start (e.g. 08:30 AM)"
                      value={t.startTime}
                      onChange={(e) => {
                        const copy = [...timingInputs];
                        copy[idx].startTime = e.target.value;
                        setTimingInputs(copy);
                      }}
                      className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="End (e.g. 09:30 AM)"
                      value={t.endTime}
                      onChange={(e) => {
                        const copy = [...timingInputs];
                        copy[idx].endTime = e.target.value;
                        setTimingInputs(copy);
                      }}
                      className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-xs"
                    />
                    {timingInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTimingInputs(timingInputs.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-500 p-2 hover:bg-rose-500/10 rounded"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center mt-2 gap-4">
                  <button
                    onClick={handleAddTimingInput}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    + Add timing Slot
                  </button>
                  <button
                    onClick={handleSavePeriodTimings}
                    className="btn-primary py-2 px-6 rounded text-xs"
                  >
                    Save timings settings
                  </button>
                </div>
              </div>
            </div>

            {/* Subject creation */}
            <div className="flex flex-col gap-8">
              {/* Single create */}
              <div className="glass p-6 rounded-lg border border-white/10">
                <h2 className="text-xl font-bold mb-4 text-white">Register Single Subject</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Subject Name (e.g. Chemistry)"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleCreateSubject}
                    className="btn-primary py-2 px-6 rounded text-sm"
                  >
                    Create
                  </button>
                </div>
              </div>

              {/* Bulk import */}
              <div className="glass p-6 rounded-lg border border-white/10">
                <h2 className="text-xl font-bold mb-4 text-white">Bulk Subject Import</h2>
                <textarea
                  value={bulkSubText}
                  onChange={(e) => setBulkSubText(e.target.value)}
                  placeholder="Biology&#10;Chemistry&#10;Social Science"
                  className="bg-gray-950 border border-gray-800 rounded p-2 text-xs w-full h-[120px] font-mono text-gray-300 placeholder:text-gray-600 mb-3 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleBulkSubjects}
                  className="btn-primary py-2 px-6 rounded text-sm w-full"
                >
                  Import Subjects List
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Editing Grid Cell Modal Dialog */}
      {editingCell && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="glass p-6 rounded-lg border border-white/10 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white">
              Schedule Assignment: {editingCell.day} - Period {editingCell.num}
            </h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Subject</label>
              <select
                value={cellSubjectId}
                onChange={(e) => handleCellSubjectChange(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm"
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Assigned Teacher</label>
              <select
                value={cellTeacherId}
                onChange={(e) => setCellTeacherId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm"
              >
                <option value="">Select Qualified Teacher</option>
                {cellTeachersOptions.length > 0 ? (
                  cellTeachersOptions.map((t) => (
                    <option key={t.Id} value={t.Id}>{t.Name} ({t.Teacher_Skill__c})</option>
                  ))
                ) : (
                  teachers.map((t) => (
                    <option key={t.Id} value={t.Id}>{t.Name}</option>
                  ))
                )}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingCell(null)}
                className="py-2 px-4 rounded text-xs border border-gray-700 bg-gray-900/40 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetTiming = timings.find(t => t.num === editingCell.num);
                  if (targetTiming) handleSaveCell(targetTiming.id || "");
                }}
                className="btn-primary py-2 px-6 rounded text-xs"
              >
                Set Slot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Substitute Period Modal Dialog */}
      {substituteCell && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="glass p-6 rounded-lg border border-white/10 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white">
              Assign Leave Substitute: {substituteCell.day} - Period {substituteCell.num}
            </h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Substitute Teacher</label>
              <select
                value={cellSubTeacherId}
                onChange={(e) => setCellSubTeacherId(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm"
              >
                <option value="">Mark Teacher Present (No Substitute)</option>
                {teachers.map((t) => (
                  <option key={t.Id} value={t.Id}>{t.Name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setSubstituteCell(null)}
                className="py-2 px-4 rounded text-xs border border-gray-700 bg-gray-900/40 text-gray-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSubstitute}
                className="btn-primary py-2 px-6 rounded text-xs"
              >
                Assign Substitute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
