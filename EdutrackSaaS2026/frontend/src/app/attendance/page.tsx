"use client";

import { useState, useEffect } from "react";

type Attendance = {
  id: string;
  student_id: string;
  date: string;
  status: string;
};

type CreateAttendance = {
  studentId: string;
  date: string;
  status: string;
};

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [form, setForm] = useState<CreateAttendance>({
    studentId: "",
    date: "",
    status: "PRESENT",
  });

  const fetchAttendances = async () => {
    const res = await fetch("/attendance", {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setAttendances(data);
    }
  };

  useEffect(() => {
    fetchAttendances();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        studentId: form.studentId,
        date: form.date,
        status: form.status,
      }),
    });
    setForm({ studentId: "", date: "", status: "PRESENT" });
    fetchAttendances();
  };

  return (
    <div className="attendance-container glass">
      <h2 className="mb-4 text-2xl font-bold">Attendance</h2>
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="form-group">
          <label>Student ID</label>
          <input
            type="text"
            name="studentId"
            value={form.studentId}
            onChange={handleChange}
            required
            className="input"
          />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className="input"
          />
        </div>
        <div className="form-group">
          <label>Status</label>
          <select name="status" value={form.status} onChange={handleChange} className="input">
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="LATE">LATE</option>
            <option value="EXCUSED">EXCUSED</option>
          </select>
        </div>
        <button type="submit" className="btn-primary mt-2 w-full">
          Record Attendance
        </button>
      </form>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Student ID</th>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {attendances.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="p-2">{a.student_id}</td>
              <td className="p-2">{new Date(a.date).toLocaleDateString()}</td>
              <td className="p-2">{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
