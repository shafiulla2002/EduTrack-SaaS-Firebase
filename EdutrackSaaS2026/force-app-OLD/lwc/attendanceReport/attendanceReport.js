import { LightningElement, track, wire } from 'lwc';
import getAttendanceData from '@salesforce/apex/AttendanceReportController.getAttendanceData';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AttendanceReport extends LightningElement {
    @track calendarView = 'daily';
    @track currentDate = new Date();
    @track selectedStudent = null;
    @track searchTerm = '';
    @track selectedClass = 'all';
    @track selectedSection = 'all';
    @track isClassDropdownOpen = false;
    @track isSectionDropdownOpen = false;
    @track monthlySearchSelectedStudent = null;
    @track isLoading = true;
    @track error = null;

    @track filteredStudents = [];
    @track attendanceMap = new Map(); // Map<date, Map<studentId, status>>
    @track sessionMap = new Map();    // Map<date, Set<classKey>>

    wiredAttendanceResult;

    // --- Life Cycle ---
    connectedCallback() {
        // Initial state set
    }

    // --- Wire Service ---
    @wire(getAttendanceData, { startDate: '$startDate', endDate: '$endDate' })
    wiredAttendance(result) {
        this.wiredAttendanceResult = result;
        if (result.data) {
            this.processAttendanceData(result.data);
            this.isLoading = false;
            this.error = null;
        } else if (result.error) {
            this.handleError('Error fetching attendance data', result.error);
        }
    }

    // --- Date Getters ---
    get startDate() {
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1);
        return date.toISOString().split('T')[0];
    }

    get endDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toISOString().split('T')[0];
    }

    get formattedDate() {
        return this.currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    get datePickerValue() {
        return this.currentDate.toISOString().split('T')[0];
    }

    get formattedMonth() {
        return this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    get datePickerValue() {
        const year = this.currentDate.getFullYear();
        const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(this.currentDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    get formattedYear() {
        return this.currentDate.getFullYear();
    }

    get weekRangeText() {
        const { startDate, endDate } = this.getWeekRange();
        return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    get selectedClassLabel() {
        if (this.selectedClass === 'all') return 'All Classes';
        // Avoid "Class Class-1"
        const cleanClass = this.selectedClass.replace(/^Class-?\s*/i, '');
        return `Class ${cleanClass}`;
    }

    get selectedSectionLabel() {
        if (this.selectedSection === 'all') return 'All Sections';
        // Avoid "Section Section A"
        const cleanSection = this.selectedSection.replace(/^Section\s*/i, '');
        return `Section ${cleanSection}`;
    }

    toggleClassNameDropdown() {
        this.isClassDropdownOpen = !this.isClassDropdownOpen;
        this.isSectionDropdownOpen = false;
    }

    toggleSectionDropdown() {
        this.isSectionDropdownOpen = !this.isSectionDropdownOpen;
        this.isClassDropdownOpen = false;
    }

    handleSelectClass(event) {
        this.selectedClass = event.currentTarget.dataset.value;
        this.selectedSection = 'all'; // Reset section when class changes
        this.isClassDropdownOpen = false;
        this.updateFilteredStudents();
    }

    handleSelectSection(event) {
        this.selectedSection = event.currentTarget.dataset.value;
        this.isSectionDropdownOpen = false;
        this.updateFilteredStudents();
    }

    handlePrevWeek() { this.handlePrevious(); }
    handleNextWeek() { this.handleNext(); }

    getWeekRange() {
        const dayOfWeek = this.currentDate.getDay();
        const diff = this.currentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const startDate = new Date(this.currentDate);
        startDate.setDate(diff);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        return { startDate, endDate };
    }

    // --- Data Processing ---
    processAttendanceData(data) {
        this.students = (data.students || []).map(student => ({
            id: student.id,
            sfId: student.id,
            name: student.name,
            rollNo: student.rollNo || '',
            classId: student.classValue || '',
            className: (student.className || student.classValue || '').replace(/Class-?/i, '').trim(),
            section: (student.section || '').replace(/Section\s+/i, '').trim(),
            classValue: student.classValue,
            initial: student.name ? student.name.charAt(0) : ''
        })).sort((a, b) => a.name.localeCompare(b.name));

        this.classes = (data.classes || []).map(cls => ({ label: cls, value: cls.replace(/Class-?/i, '').trim() }));
        this.sections = (data.sections || []).map(s => s.replace(/Section\s+/i, '').trim());
        this.sessions = (data.sessions || []).map(session => ({
            ...session,
            className: session.className ? session.className.replace(/Class-?/i, '').trim() : session.classValue ? session.classValue.replace(/Class-?/i, '').trim() : '',
            section: session.section ? session.section.replace(/Section\s+/i, '').trim() : ''
        }));

        this.attendance = (data.attendanceRecords || []).map(record => ({
            studentId: record.studentId,
            date: record.attendanceDate,
            status: record.status || 'Holiday',
            checkInTime: '-',
            className: (record.className || record.classValue || '').replace(/Class-?/i, '').trim(),
            section: (record.section || '').replace(/Section\s+/i, '').trim()
        }));

        this.indexData();
        this.updateFilteredStudents();
    }

    indexData() {
        // Build Session Map: Map<date, Set<classSectionKey>>
        this.sessionMap = new Map();
        this.sessions.forEach(s => {
            if (!this.sessionMap.has(s.attendanceDate)) {
                this.sessionMap.set(s.attendanceDate, new Set());
            }
            const key = `${String(s.className).replace(/Class-?/i, '').trim()}-${String(s.section).trim()}`;
            this.sessionMap.get(s.attendanceDate).add(key);
        });

        // Build Attendance Map: Map<date, Map<studentId, status>>
        this.attendanceMap = new Map();
        this.attendance.forEach(a => {
            if (!this.attendanceMap.has(a.date)) {
                this.attendanceMap.set(a.date, new Map());
            }
            this.attendanceMap.get(a.date).set(a.studentId, a.status);
        });

        // Add attendance records to session map to ensure "working day" logic holds
        this.attendance.forEach(a => {
            if (!this.sessionMap.has(a.date)) {
                this.sessionMap.set(a.date, new Set());
            }
            const key = `${a.className}-${a.section}`;
            this.sessionMap.get(a.date).add(key);
        });
    }

    updateFilteredStudents() {
        this.filteredStudents = this.students.filter(student => {
            const isDaily = this.calendarView === 'daily';
            const isActiveSearch = !!this.searchTerm;

            const matchesSearch = !isActiveSearch || 
                student.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                (student.rollNo && String(student.rollNo).includes(this.searchTerm));
            
            // Ensure class/section filters always apply alongside search
            const matchesClass = this.selectedClass === 'all' || student.className == this.selectedClass;
            const matchesSection = this.selectedSection === 'all' || student.section === this.selectedSection;
            
            return matchesSearch && matchesClass && matchesSection;
        });
    }

    renderedCallback() {
        // Reserved for future UI adjustments
    }

    // --- UI Getters ---
    get showFilters() {
        return false; 
    }

    get showGlobalFilters() {
        // Only show global date nav for Daily View. 
        // Weekly/Monthly/Yearly have their own internal controls.
        return this.isDailyView; 
    }
    get isDailyView() { return this.calendarView === 'daily'; }
    get isWeeklyView() { return this.calendarView === 'weekly'; }
    get isMonthlyView() { return this.calendarView === 'monthly'; }
    get isYearlyView() { return this.calendarView === 'yearly'; }

    get dailyBtnClass() { return `view-btn ${this.isDailyView ? 'active active-daily' : ''}`; }
    get weeklyBtnClass() { return `view-btn ${this.isWeeklyView ? 'active active-weekly' : ''}`; }
    get monthlyBtnClass() { return `view-btn ${this.isMonthlyView ? 'active active-monthly' : ''}`; }
    get yearlyBtnClass() { return `view-btn ${this.isYearlyView ? 'active active-yearly' : ''}`; }

    get mainContainerClass() {
        return this.isDailyView ? 'main-container daily-full-screen' : 'main-container';
    }

    get showLoadingSpinner() { return this.isLoading; }
    get showContent() { return !this.isLoading && !this.error; }

    get hasActiveFilters() { return this.searchTerm !== '' || this.selectedClass !== 'all' || this.selectedSection !== 'all'; }
    get isNoData() { return this.isDailyView && (!this.classSectionSummary || this.classSectionSummary.length === 0); }

    get classOptions() {
        return [
            { label: 'All Classes', value: 'all', isSelected: this.selectedClass === 'all' }, 
            ...this.classes.map(c => ({ ...c, isSelected: this.selectedClass === c.value }))
        ];
    }

    get availableSections() {
        return [
            { label: 'All Sections', value: 'all', isSelected: this.selectedSection === 'all' }, 
            ...this.sections.map(s => ({ label: s, value: s, isSelected: this.selectedSection === s }))
        ];
    }

    // --- Daily Summary Logic ---
    get classSectionSummary() {
        if (!this.students.length || !this.isDailyView) return [];

        const dateStr = this.currentDate.toLocaleDateString('en-CA');
        const isSunday = this.currentDate.getDay() === 0;

        const groups = {};
        this.students.forEach(student => {
            const key = `${student.classValue}-${student.section}`;
            if (!groups[key]) {
                groups[key] = { 
                    key, 
                    classValue: student.classValue,
                    className: student.className, 
                    section: student.section, 
                    students: [] 
                };
            }
            groups[key].students.push(student);
        });

        return Object.values(groups).map((group, index) => {
            const themeClass = `attendance-card theme-${(index % 5) + 1}`;
            
            if (isSunday) {
                return { 
                    ...group, 
                    totalCount: group.students.length, 
                    presentCount: 0, 
                    absentCount: 0, 
                    attendanceRate: 0,
                    absentees: [], 
                    isHoliday: true, 
                    badgeLabel: 'Sunday Holiday', 
                    badgeClass: 'status-badge holiday', 
                    hasAbsentees: false,
                    themeClass,
                    absentNames: 'None'
                };
            }

            const sessionKey = `${String(group.classValue).replace(/Class-?/i, '').trim()}-${String(group.section).trim()}`;
            const datesSessions = this.sessionMap.get(dateStr);
            const isSubmitted = datesSessions && datesSessions.has(sessionKey);
            
            const groupAttendance = this.attendanceMap.get(dateStr);
            const absentees = group.students
                .filter(s => groupAttendance && groupAttendance.get(s.id) === 'Absent')
                .map(s => ({ ...s, initial: s.name ? s.name.charAt(0) : '' }));

            const presentCount = group.students.length - absentees.length;
            const attendanceRate = (isSubmitted && group.students.length > 0) ? ((presentCount / group.students.length) * 100).toFixed(0) : 0;

            return {
                ...group,
                totalCount: group.students.length,
                presentCount,
                presentDisplay: isSubmitted ? presentCount : 'N/A', // Show N/A if not submitted
                absentCount: absentees.length,
                attendanceRate,
                absentNames: absentees.length > 0 ? absentees.map(s => s.name).join(', ') : 'None',
                absentees,
                hasAbsentees: absentees.length > 0,
                isHoliday: false,
                badgeLabel: isSubmitted ? 'Attendance Submitted' : 'Not Submitted',
                badgeClass: isSubmitted ? 'status-badge submitted' : 'status-badge not-submitted',
                themeClass
            };
        }).sort((a, b) => {
            // Extract first number found in string "Class 10" -> 10
            const getClassNum = (str) => {
                const match = String(str).match(/(\d+)/);
                return match ? parseInt(match[0], 10) : 0;
            };
            
            const classA = getClassNum(a.classValue);
            const classB = getClassNum(b.classValue);
            
            if (classA !== classB) {
                return classA - classB;
            }
            return a.section.localeCompare(b.section);
        });
    }

    // --- Daily Overall Summary ---
    get overallDailySummary() {
        const summary = this.classSectionSummary;
        if (!summary.length) return null;

        let totalPotential = 0;
        let totalPresent = 0;
        let totalAbsent = 0;

        summary.forEach(group => {
            totalPotential += group.totalCount || 0;
            totalPresent += group.presentCount || 0;
            totalAbsent += group.absentCount || 0;
        });

        const rate = totalPotential > 0 ? ((totalPresent / totalPotential) * 100).toFixed(0) : 0;

        return {
            totalPotential,
            totalPresent,
            totalAbsent,
            rate,
            dateLabel: this.currentDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        };
    }

    // --- Event Handlers ---
    handleViewChange(event) {
        this.calendarView = event.target.dataset.view;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
        // We can force a re-render or check if the getter updates
        this.updateFilteredStudents();
    }

    handleDateSelect(event) {
        const selectedDate = event.target.value;
        if (selectedDate) {
            // Parse YYYY-MM-DD manually to prevent timezone offset issues
            const [year, month, day] = selectedDate.split('-').map(Number);
            this.currentDate = new Date(year, month - 1, day);
        }
    }

    handleClassChange(event) {
        this.selectedClass = event.target.value;
        this.selectedSection = 'all';
        this.updateFilteredStudents();
    }

    handleSectionChange(event) {
        this.selectedSection = event.target.value;
        this.updateFilteredStudents();
    }

    handleClearFilters() {
        this.searchTerm = '';
        this.selectedClass = 'all';
        this.selectedSection = 'all';
        this.updateFilteredStudents();
    }

    handlePrevious() {
        const d = new Date(this.currentDate);
        if (this.isDailyView) d.setDate(d.getDate() - 1);
        else if (this.isWeeklyView) d.setDate(d.getDate() - 7);
        else if (this.isMonthlyView) d.setMonth(d.getMonth() - 1);
        else if (this.isYearlyView) d.setFullYear(d.getFullYear() - 1);
        this.currentDate = d;
    }

    handleNext() {
        const d = new Date(this.currentDate);
        if (this.isDailyView) d.setDate(d.getDate() + 1);
        else if (this.isWeeklyView) d.setDate(d.getDate() + 7);
        else if (this.isMonthlyView) d.setMonth(d.getMonth() + 1);
        else if (this.isYearlyView) d.setFullYear(d.getFullYear() + 1);
        this.currentDate = d;
    }

    handlePrevSlide() { if (this.currentSlide > 0) this.currentSlide--; }
    handleNextSlide() { if (this.currentSlide < this.classSectionSummary.length - 1) this.currentSlide++; }
    handleIndicatorClick(event) { this.currentSlide = parseInt(event.target.dataset.index, 10); }

    handleNavigateToClass() {
        // No-op for now as carousel is removed
    }

    handleOpenModal(event) {
        const studentId = event.currentTarget.dataset.studentId;
        this.selectedStudent = this.students.find(s => s.id === studentId);
        this.showStudentModal = true;
    }

    handleCloseModal() {
        this.showStudentModal = false;
        this.selectedStudent = null;
    }

    // --- Detailed Data Getters (for analytics & modal) ---
    get dailyViewData() {
        if (!this.selectedStudent) return {};
        const dateStr = this.currentDate.toLocaleDateString('en-CA');
        const isSunday = this.currentDate.getDay() === 0;
        
        if (isSunday) return { status: 'Holiday', statusIcon: '🏖️', isHoliday: true, statusTextClass: 'status-text-large text-slate-400' };

        const att = this.attendance.find(a => a.studentId === this.selectedStudent.id && a.date === dateStr);
        const status = att ? att.status : 'Present'; // Record = Absent, No Record = Present

        return {
            status,
            statusIcon: status === 'Present' ? '✅' : '❌',
            isPresent: status === 'Present',
            isAbsent: status === 'Absent',
            statusTextClass: status === 'Present' ? 'status-text-large text-emerald-500' : 'status-text-large text-rose-500',
            present: status === 'Present' ? 1 : 0,
            absent: status === 'Absent' ? 1 : 0,
            holiday: 0
        };
    }

    get weeklyViewData() {
        const { startDate } = this.getWeekRange();
        const weekDays = [];
        let totalAbsences = 0;
        let workingDaysCount = 0;

        // Loop Monday to Saturday (6 days)
        for (let i = 0; i < 6; i++) {
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);
            const dateStr = day.toLocaleDateString('en-CA');
            const isToday = dateStr === new Date().toLocaleDateString('en-CA');
            
            const targetClassKey = `${String(this.selectedClass).replace(/Class-?/i, '').trim()}-${String(this.selectedSection).trim()}`;
            const datesSessions = this.sessionMap.get(dateStr);
            let hasSession = false;
            if (datesSessions) {
                if (this.selectedClass === 'all') hasSession = datesSessions.size > 0;
                else if (this.selectedSection === 'all') {
                    const classPrefix = `${String(this.selectedClass).replace(/Class-?/i, '').trim()}-`;
                    for (let key of datesSessions) if (key.startsWith(classPrefix)) { hasSession = true; break; }
                } else hasSession = datesSessions.has(targetClassKey);
            }

            if (hasSession) {
                workingDaysCount++;
                const groupAttendance = this.attendanceMap.get(dateStr);
                let dayAbsences = 0;
                if (groupAttendance) {
                    this.filteredStudents.forEach(s => {
                        if (groupAttendance.get(s.id) === 'Absent') dayAbsences++;
                    });
                }
                
                const presentCount = this.filteredStudents.length - dayAbsences;
                totalAbsences += dayAbsences;

                weekDays.push({
                    dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
                    dayNum: day.getDate(),
                    presentCount,
                    absentCount: dayAbsences,
                    rate: this.filteredStudents.length > 0 ? ((presentCount / this.filteredStudents.length) * 100).toFixed(0) : 0,
                    cardClass: `week-day-card day-${i} ${isToday ? 'active' : ''}`,
                    dayKey: `wd-${i}`,
                    isHoliday: false
                });
            } else {
                weekDays.push({
                    dayName: day.toLocaleDateString('en-US', { weekday: 'short' }),
                    dayNum: day.getDate(),
                    presentCount: '-',
                    absentCount: '-',
                    rate: '-',
                    cardClass: `week-day-card holiday day-${i} ${isToday ? 'active' : ''}`,
                    dayKey: `wd-${i}`,
                    isHoliday: true,
                    holidayLabel: day > new Date() ? 'No Session' : 'No attendance'
                });
            }
        }

        const totalPossible = this.filteredStudents.length * workingDaysCount;
        const totalPresent = totalPossible - totalAbsences;
        const overallRate = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(0) : 0;
        
        return {
            weekDays,
            attendanceRate: overallRate,
            present: totalPresent,
            absent: totalAbsences,
            totalStudents: this.filteredStudents.length,
            workingDays: workingDaysCount,
            selectedClassLabel: this.selectedClass ? `${this.selectedClass === 'all' ? 'All Classes' : 'Class ' + this.selectedClass}${this.selectedSection !== 'all' ? '-' + this.selectedSection : ''}` : 'All Classes'
        };
    }

    get progressBarWidth() {
        return `width: ${this.weeklyViewData.attendanceRate}%`;
    }

    get monthlyViewData() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const allDays = [];

        // Aggregate stats for month
        let totalWorkingDays = 0;
        let totalAbsences = 0;
        let studentPresentCount = 0;
        let studentAbsentCount = 0;

        for (let i = 0; i < firstDay; i++) {
            allDays.push({ empty: true, key: `e-${i}` });
        }

        const searchedStudent = this.monthlySearchSelectedStudent || 
                               (this.searchTerm && this.filteredStudents.length === 1 ? this.filteredStudents[0] : null);

        const targetClass = searchedStudent ? searchedStudent.className : this.selectedClass;
        const targetSection = searchedStudent ? searchedStudent.section : this.selectedSection;
        const targetClassKey = `${String(targetClass).replace(/Class-?/i, '').trim()}-${String(targetSection).trim()}`;

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toLocaleDateString('en-CA');
            const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            const datesSessions = this.sessionMap.get(dateStr);
            let hasSession = false;
            if (datesSessions) {
                if (targetClass === 'all') hasSession = datesSessions.size > 0;
                else if (targetSection === 'all') {
                    const classPrefix = `${String(targetClass).replace(/Class-?/i, '').trim()}-`;
                    for (let key of datesSessions) if (key.startsWith(classPrefix)) { hasSession = true; break; }
                } else hasSession = datesSessions.has(targetClassKey);
            }

            let rate = 0;
            let status = 'holiday';
            let isAbsent = false;
            let isPresent = false;
            
            if (hasSession) {
                totalWorkingDays++;
                const groupAttendance = this.attendanceMap.get(dateStr);
                
                // If we have a specific student, we only care about THEIR attendance
                if (searchedStudent) {
                     const statusVal = groupAttendance ? groupAttendance.get(searchedStudent.id) : 'Present';
                     
                     if (statusVal === 'Absent') {
                         studentAbsentCount++;
                         isAbsent = true;
                     } else {
                         studentPresentCount++;
                         isPresent = true;
                     }
                     // Rate for single student is 100 or 0
                     rate = isPresent ? 100 : 0;
                     totalAbsences += (isAbsent ? 1 : 0);
                } else {
                    // Aggregate View
                    let absentCount = 0;
                    if (groupAttendance) {
                        this.filteredStudents.forEach(s => {
                            if (groupAttendance.get(s.id) === 'Absent') absentCount++;
                        });
                    }

                    totalAbsences += absentCount;
                    rate = this.filteredStudents.length > 0 ? (((this.filteredStudents.length - absentCount) / this.filteredStudents.length) * 100).toFixed(0) : 0;
                }
                
                status = rate >= 90 ? 'high' : rate >= 75 ? 'mid' : 'low';
            }

            const todayStr = new Date().toLocaleDateString('en-CA');
            const isToday = dateStr === todayStr;

            allDays.push({ 
                day, 
                key: `day-${day}`,
                rate: hasSession ? rate : '-', 
                cellClass: `day-cell ${status}${isWeekend ? ' weekend' : ''}${isAbsent ? ' is-absent' : ''}${isPresent ? ' is-present' : ''}${isToday ? ' is-today' : ''}`,
                isHoliday: !hasSession,
                isWeekend,
                isAbsent,
                isPresent,
                isToday
            });
        }

        const totalPossible = (searchedStudent ? 1 : this.filteredStudents.length) * totalWorkingDays;
        const totalPresent = totalPossible - totalAbsences;
        const overallRate = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) : 0;

        return { 
            allDays,
            attendanceRate: overallRate,
            present: totalPresent,
            absent: totalAbsences,
            workingDays: totalWorkingDays,
            searchedStudent,
            isSearching: !!this.searchTerm,
            hasResults: this.filteredStudents.length > 0,
            studentPresentCount,
            studentAbsentCount
        };
    }

    get showMonthlySearchDropdown() {
        return this.isMonthlyView && this.searchTerm && !this.monthlySearchSelectedStudent;
    }

    get hasSearchResults() {
        return this.filteredStudents && this.filteredStudents.length > 0;
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
        this.monthlySearchSelectedStudent = null; // Reset selection on new search
        console.log('SEARCH DEBUG: Term:', this.searchTerm);
        this.updateFilteredStudents();
    }

    handleSelectMonthlyStudent(event) {
        const studentId = event.currentTarget.dataset.id;
        this.monthlySearchSelectedStudent = this.students.find(s => s.id === studentId);
        this.searchTerm = this.monthlySearchSelectedStudent.name; // Optional: fill input
        // Force update if needed, but reactivity handles it
    }

    get showYearlySearchDropdown() {
        return this.isYearlyView && this.searchTerm && !this.monthlySearchSelectedStudent;
    }

    handleSelectYearlyStudent(event) {
        const studentId = event.currentTarget.dataset.id;
        this.monthlySearchSelectedStudent = this.students.find(s => s.id === studentId);
        this.searchTerm = this.monthlySearchSelectedStudent.name;
    }

    handlePrevYear() {
        this.currentDate = new Date(this.currentDate.getFullYear() - 1, 0, 1);
    }

    handleNextYear() {
        this.currentDate = new Date(this.currentDate.getFullYear() + 1, 0, 1);
    }

    get yearlyViewData() {
        const year = this.currentDate.getFullYear();
        const today = new Date();
        const currentMonthIndex = today.getFullYear() === year ? today.getMonth() : -1;
        
        let totalWorkingDays = 0;
        let totalPresent = 0;
        let totalPossible = 0;
        let totalAbsences = 0; // Track total absences for global calc
        const months = [];
        
        // SEARCH LOGIC (CONTEXT AWARE):
        // 1. If Class/Section is selected (!= 'all'), search ONLY within filteredStudents.
        // 2. If Class/Section is 'all', search GLOBALLY across this.students.
        
        const searchTerm = this.searchTerm ? this.searchTerm.toLowerCase() : '';
        if (searchTerm) {
            // debug removed
        }

        let searchPool = [];
        // Determine the pool:
        if (this.selectedClass !== 'all') {
             // Context: specific class selected
             searchPool = this.filteredStudents;
        } else {
             // Context: global
             searchPool = this.students;
        }

        const searchedStudent = this.monthlySearchSelectedStudent || (searchTerm 
            ? searchPool.find(s => 
                (s.name && s.name.toLowerCase().includes(searchTerm)) || 
                (s.rollNo && s.rollNo.toString().includes(searchTerm))
              ) 
            : null);




        // If a student is found, use THEIR class/section for scope
        // BUT if we are in a specific filter context and found nothing, we show nothing.
        // Refined Scope Logic:
        // 1. Searching & Found -> [student]
        // 2. Searching & Not Found -> [] (Show "No results")
        // 3. Not Searching -> this.filteredStudents
        // Logic check: if no search, default to filteredStudents.
        // If search exists but no student found -> empty scope.
        const scopeStudents = searchTerm 
            ? (searchedStudent ? [searchedStudent] : []) 
            : this.filteredStudents;
        
        // Determine the filtering parameters for Sessions
        // If searching: use searchedStudent's className/section
        // If not searching: use selectedClass/selectedSection
        const targetClassName = searchedStudent ? searchedStudent.className : this.selectedClass;
        const targetSection = searchedStudent ? searchedStudent.section : this.selectedSection;

        const targetClassKey = `${String(targetClassName).replace(/Class-?/i, '').trim()}-${String(targetSection).trim()}`;

        for (let m = 0; m < 12; m++) {
            const monthName = new Date(year, m, 1).toLocaleDateString('en-US', { month: 'short' });
            const isCurrentMonth = m === currentMonthIndex;
            
            // 1. Identify valid working dates in month
            let mWorkingDays = 0;
            const daysInMonth = new Date(year, m + 1, 0).getDate();
            const validDatesInMonth = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, m, d);
                const dateStr = date.toLocaleDateString('en-CA');
                const datesSessions = this.sessionMap.get(dateStr);
                
                let hasSession = false;
                if (datesSessions) {
                    if (targetClassName === 'all') hasSession = datesSessions.size > 0;
                    else if (targetSection === 'all') {
                        const classPrefix = `${String(targetClassName).replace(/Class-?/i, '').trim()}-`;
                        for (let key of datesSessions) if (key.startsWith(classPrefix)) { hasSession = true; break; }
                    } else hasSession = datesSessions.has(targetClassKey);
                }

                if (hasSession) {
                    mWorkingDays++;
                    validDatesInMonth.push(dateStr);
                }
            }

            if (mWorkingDays === 0) {
                months.push({ 
                    monthName, 
                    present: 0, 
                    absent: 0, 
                    rate: 0, 
                    workingDays: 0, 
                    cardClass: `month-card month-${m} empty ${isCurrentMonth ? 'is-current-month' : ''}`,
                    isCurrentMonth
                });
                continue;
            }

            // 2. Count Absences using indexed Map
            let monthAbsences = 0;
            validDatesInMonth.forEach(dateStr => {
                const groupAttendance = this.attendanceMap.get(dateStr);
                if (groupAttendance) {
                    scopeStudents.forEach(s => {
                        if (groupAttendance.get(s.id) === 'Absent') monthAbsences++;
                    });
                }
            });

            // 3. Calculate Totals
            const mTotalPossible = scopeStudents.length * mWorkingDays;
            const mTotalPresent = mTotalPossible - monthAbsences;
            const mRate = mTotalPossible > 0 ? ((mTotalPresent / mTotalPossible) * 100).toFixed(0) : 0;
            
            // Accumulate Global Globals
            totalWorkingDays += mWorkingDays;
            totalPossible += mTotalPossible;
            totalAbsences += monthAbsences;

            // Determine status class
            const statusClass = mRate >= 90 ? 'high' : mRate >= 75 ? 'mid' : 'low';

            months.push({ 
                monthName, 
                present: mTotalPresent, 
                absent: monthAbsences, 
                rate: mRate, 
                workingDays: mWorkingDays,
                cardClass: `month-card month-${m} ${statusClass} ${isCurrentMonth ? 'is-current-month' : ''}`,
                rateClass: `status-text-large ${mRate >= 90 ? 'text-emerald-500' : mRate >= 75 ? 'text-amber-500' : 'text-rose-500'}`,
                isCurrentMonth
            });
        }

        // Final Global Rate
        totalPresent = totalPossible - totalAbsences;
        const overallRate = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) : 0;

        return { 
            months, 
            year,
            workingDays: totalWorkingDays, // Total sessions for the year
            present: totalPresent,
            absent: totalAbsences,
            attendanceRate: overallRate,
            isSearching: !!this.searchTerm,
            searchedStudent,
            hasResults: !!searchedStudent,
            // Per-student stats if searching
            studentPresentCount: searchedStudent ? totalPresent : 0,
            studentAbsentCount: searchedStudent ? totalAbsences : 0
        };
    }

    get selectedStudentInitial() { return this.selectedStudent ? this.selectedStudent.initial : ''; }
    get presentCardClass() { return `status-checkbox-card ${this.dailyViewData.isPresent ? 'checked-present' : ''}`; }
    get absentCardClass() { return `status-checkbox-card ${this.dailyViewData.isAbsent ? 'checked-absent' : ''}`; }
    get holidayCardClass() { return `status-checkbox-card ${this.dailyViewData.isHoliday ? 'checked-holiday' : ''}`; }

    // --- Utilities ---
    handleError(title, error) {
        this.isLoading = false;
        const message = error?.body?.message || error?.message || 'Unknown error';
        this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
    }
}