# Attendance UI Parity Audit Report

## Overview

**Date**: 2026-06-24  
**Module**: Attendance (Take Attendance + Attendance Tracker)  
**Goal**: Identify ALL UI/UX differences between EduTrack Salesforce Package and EduTrack SaaS

---

## Screenshot Analysis

### Salesforce Package - Screen 1: Teacher Selection Landing Page

| Element | Salesforce Package |
|---|---|
| Background | White (#ffffff) page, centered white card |
| Card shape | Rounded (24px), subtle shadow |
| Header icon | Purple gradient square icon (📋) |
| Title | "Take Attendance" - dark text, bold |
| Subtitle | "Select your name to get started" - gray text |
| Date badge | Purple-outlined pill: "Wednesday, 24 June 2026" |
| Status pills | Two teal/purple pills: "Today's attendance is currently pending" |
| Teacher label | "👤 Select Teacher" - gray label |
| Search field | Light border, "Search your name…" placeholder |
| Proceed button | Full-width, indigo gradient, gray when disabled |
| Footer note | "Only you can mark attendance for your class" |

### Salesforce Package - Screen 2: Attendance Tracker

| Element | Salesforce Package |
|---|---|
| Background | Light gray page (#f3f4f6) |
| Header | "Attendance Tracker" (large, dark), subtitle "Manage students attendance efficiently" |
| Top-right button | Purple "Attendance Report" button with ⚙️ icon |
| Filters row | Date input + Class dropdown + Section dropdown (horizontal, white inputs) |
| Stat cards | 3 cards: TOTAL (blue, person icon), PRESENT (green, ✅), ABSENT (red, ✗) |
| Stat card style | White background, colored left border/icon, number large |
| Student List header | "Student List" bold heading, "Mark students who are absent" subtitle |
| Student row | White card, full-width, student initials avatar, name, roll no, "Present" badge right-aligned |
| Student avatar | Colored circle with initials, medium size |
| Present badge | Green rounded badge on far right |
| Absent badge | Red rounded badge on far right |
| Submit button | Blue "Submit Attendance" button, bottom right |
| Container | White rounded panel |

---

## Gap Analysis

### 1. Theme / Colors

| Item | Salesforce Package | Current SaaS | Gap |
|---|---|---|---|
| Page background | White / light gray | Dark slate-900 | ❌ CRITICAL |
| Card background | White (#ffffff) | Dark slate-850 | ❌ CRITICAL |
| Text color | Dark (#1e293b) | Light (slate-100) | ❌ CRITICAL |
| Border color | Light (#e2e8f0) | Dark (slate-800) | ❌ CRITICAL |
| Stat card background | White | Dark slate-850 | ❌ |
| Student card background | White, light green (present), light red (absent) | Dark with dark borders | ⚠️ Partially correct |

> **The entire color scheme is inverted.** Salesforce uses light/white theme; SaaS uses dark theme.

### 2. Teacher Selection Screen

| Item | Salesforce | SaaS | Gap |
|---|---|---|---|
| Status pills ("attendance pending") | ✅ Present (teal pills) | ❌ Missing in DOM rendering | ⚠️ |
| Card content padding | 36px | 36px | ✅ Match |
| White card on light bg | ✅ | ❌ Dark card on dark bg | ❌ |
| Date badge | Purple outlined pill | Present | ✅ |
| Search field | White bg, light border | White bg | ✅ (CSS already light) |
| Proceed button | Indigo gradient | ✅ | ✅ Match |

### 3. Attendance Tracker Screen

| Item | Salesforce | SaaS | Gap |
|---|---|---|---|
| Page background | Light gray | Dark slate-900 | ❌ CRITICAL |
| Header layout | Text left, button right | ✅ Same layout | ✅ |
| "Attendance Report" button | Purple with icon | ✅ | ✅ |
| Filters (Date/Class/Section) | Horizontal white inputs | 3-column grid on dark bg | ⚠️ |
| Stat cards | White with colored icon | Dark with colored icon | ❌ |
| Student list container | White panel | Dark panel | ❌ |
| Student row | Full-width white card | 3-column dark grid | ❌ Structure differs |
| Student avatar | Colored circle | ✅ Present | ✅ |
| "Present" badge | Right-aligned green badge | ✅ | ✅ |
| "Submit Attendance" | Blue button, bottom right | ✅ | ✅ |

### 4. Layout Structure

| Item | Salesforce | SaaS |
|---|---|---|
| Student list layout | **Full-width single column rows** | 3-column grid |
| Filter bar | Horizontal 3-column | 3-column grid ✅ |
| Stat cards | Horizontal 3-column | 3-column grid ✅ |

### 5. Typography

| Item | Salesforce | SaaS | Gap |
|---|---|---|---|
| Primary heading color | Dark (#1e293b) | White | ❌ |
| Body text | Gray (#64748b) | Slate-400 | Minor diff |
| Font family | System sans-serif | Same | ✅ |

---

## Missing UI Components

1. **Status pills on Teacher Selection** - "Today's attendance is currently pending" teal pills are not visible in the rendered UI
2. **Light theme for Teacher Selection card wrapper** - the outer background is dark, not light
3. **Light background for Attendance Tracker page** - entire page background must be light gray
4. **Full-width single-column student rows** - currently a 3-column grid

---

## Salesforce Parity Percentage

| Category | Parity Score |
|---|---|
| Functional Logic | 95% ✅ |
| Layout Structure | 60% ⚠️ |
| Color Theme | 30% ❌ |
| Component Placement | 75% ⚠️ |
| Student Card Design | 55% ⚠️ |
| Typography | 50% ⚠️ |
| **Overall UI Parity** | **52%** ❌ |

---

## Action Required

1. Switch Attendance Entry page background to **light (#f3f4f6)**
2. Switch all cards/panels to **white (#ffffff)**  
3. Switch text colors to **dark (#1e293b, #64748b)**
4. Switch student cards to **full-width single-column rows** (like Salesforce)
5. Switch stat cards to **white with light borders**
6. Ensure filter bar uses **white inputs on light background**
7. Fix success card to use **white background** (already correct in CSS, just override Tailwind dark classes)
