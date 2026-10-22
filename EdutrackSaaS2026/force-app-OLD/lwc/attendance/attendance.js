import { LightningElement, track, wire } from 'lwc';
import getStudents from '@salesforce/apex/AttendanceController.getStudents';
import getSessionData from '@salesforce/apex/AttendanceController.getSessionData';
import saveAttendance from '@salesforce/apex/AttendanceController.saveAttendance';
import getClasses from '@salesforce/apex/AttendanceController.getClasses';
import getSections from '@salesforce/apex/AttendanceController.getSections';
import getTeachers from '@salesforce/apex/AttendanceController.getTeachers';
import getRecentSubmissions from '@salesforce/apex/AttendanceController.getRecentSubmissions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AttendanceScreen extends LightningElement {
    @track selectedDate;
    @track selectedClass = 'Class-1';
    @track selectedSection = 'A';
    @track students = [];
    @track loading = false;
    @track isSuccess = false;
    @track isReadOnly = false;
    @track sessionExists = false;
    @track filter = 'All';
    @track pinnedIds = []; // IDs of students whose status changed in the current filter view
    @track showReport = false; // Toggles between Tracker and Report view

    // Teacher Selection State
    @track showTeacherSelection = true;
    @track teachers = [];
    @track filteredTeachers = [];
    @track selectedTeacher = null;
    @track teacherSearchTerm = '';
    @track isTeacherDropdownOpen = false;
    @track recentSubmissions = [];
    @track submittedTeacherName = '';
    @track submittedTime = '';
    @track lastUpdatedTime = '';
    _outsideClickListener; // To manage lifecycle of click-outside listener
    _justOpened = false; // To prevent immediate close on the same click that opens the dropdown

    // Wired Options
    @track classOptions = [];
    @track sectionOptions = [];


    fetchRecentSubmissions() {
        // Method kept for manual refresh after submission
        getRecentSubmissions()
            .then(result => {
                if (result) {
                    const copy1 = result.map(item => ({...item, id: item.id + '-1'}));
                    const copy2 = result.map(item => ({...item, id: item.id + '-2'}));
                    this.recentSubmissions = [...copy1, ...copy2];
                }
            })
            .catch(error => {
                console.error('Error fetching recent submissions:', error);
            });
    }

    @wire(getRecentSubmissions)
    wiredRecentSubmissions({ error, data }) {
        if (data) {
            // Duplicate once for a seamless infinite loop with unique keys
            const copy1 = data.map(item => ({...item, id: item.id + '-1'}));
            const copy2 = data.map(item => ({...item, id: item.id + '-2'}));
            this.recentSubmissions = [...copy1, ...copy2];
        } else if (error) {
            console.error('Error loading recent submissions', error);
        }
    }

    @wire(getTeachers)
    wiredTeachers({ error, data }) {
        if (data) {
            this.teachers = data.map(t => {
                const colorClass = this.getRandomColorClass();
                return {
                    ...t,
                    initials: this.getInitials(t.name),
                    colorClass: colorClass
                };
            });
            this.filteredTeachers = [...this.teachers];
        } else if (error) {
            console.error('Error loading teachers', error);
        }
    }

    @wire(getClasses)
    wiredClasses({ error, data }) {
        if (data) {
            this.classOptions = data;
        } else if (error) {
            console.error('Error loading classes', error);
            this.showToast('Error', 'Failed to load classes', 'error');
        }
    }

    @wire(getSections)
    wiredSections({ error, data }) {
        if (data) {
            this.sectionOptions = data;
        } else if (error) {
            console.error('Error loading sections', error);
            this.showToast('Error', 'Failed to load sections', 'error');
        }
    }

    todayDate;

    connectedCallback() {
        this.todayDate = new Date().toISOString().split('T')[0];
        this.selectedDate = this.todayDate;
        
        // Auto-load defaults on initialization
        this.loadStudentsIfReady();

        // Listen for clicks outside to close teacher dropdown
        this._outsideClickListener = this.handleClickOutside.bind(this);
        window.addEventListener('click', this._outsideClickListener);
    }

    disconnectedCallback() {
        if (this._outsideClickListener) {
            window.removeEventListener('click', this._outsideClickListener);
        }
    }

    handleClickOutside(event) {
        // If the dropdown was just opened by a focus event, ignore the subsequent click event
        if (this._justOpened) {
            this._justOpened = false;
            return;
        }

        if (!this.isTeacherDropdownOpen) return;

        // Use composedPath to handle clicks within Shadow DOM
        const path = event.composedPath();
        const isInside = path.some(el => el.dataset && el.dataset.id === 'teacher-search-container');
        
        if (!isInside) {
            this.isTeacherDropdownOpen = false;
        }
    }

    get isSectionDisabled() {
        return !this.selectedClass;
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;
        this.loadStudentsIfReady();
    }

    handleClassChange(event) {
        this.selectedClass = event.detail.value;
        this.selectedSection = null; // Reset section
        this.loadStudentsIfReady();
    }

    handleSectionChange(event) {
        this.selectedSection = event.detail.value;
        this.loadStudentsIfReady();
    }

    async loadStudentsIfReady() {
        if (this.selectedDate && this.selectedClass && this.selectedSection) {
            this.loading = true;
            this.isSuccess = false; // Reset view
            this.students = []; // Clear list
            this.submittedTeacherName = '';
            this.submittedTime = '';
            this.lastUpdatedTime = '';
            
            // Date restrictions: Attendance for past dates is Read Only
            const selectedDateObj = new Date(this.selectedDate);
            const today = new Date();
            today.setHours(0,0,0,0);
            
            this.isReadOnly = selectedDateObj < today;

            try {
                // Parallel Fetch: Students AND Session Data
                const [studentsData, sessionData] = await Promise.all([
                    getStudents({ classVal: this.selectedClass.trim(), sectionVal: this.selectedSection.trim() }),
                    getSessionData({ classVal: this.selectedClass.trim(), sectionVal: this.selectedSection.trim(), dateVal: this.selectedDate })
                ]);
                
                this.sessionExists = sessionData.sessionExists;
                if (this.sessionExists) {
                    this.submittedTeacherName = sessionData.teacherName || '';
                    this.submittedTime = sessionData.createdTime || '';
                    this.lastUpdatedTime = sessionData.lastUpdatedTime || '';
                }
                
                this.students = studentsData.map(student => {
                    // Auto-mark absent if session exists
                    const absentIds = sessionData.absentIds || [];
                    const isAbsent = absentIds.includes(student.Id);
                    return {
                        id: student.Id,
                        name: student.Name,
                        rollNumber: student.Roll_No__c,
                        initials: this.getInitials(student.Name),
                        isAbsent: isAbsent,
                        status: isAbsent ? 'Absent' : 'Present',
                        cardClass: `student-card ${isAbsent ? 'absent' : 'present'}`
                    };
                });
                
                // If session exists, go straight to summary? 
                // Requirement: "if i select date which attendance is already submitted then show success card"
                if (this.sessionExists) {
                    this.isSuccess = true;
                }

            } catch (error) {
                console.error('Load Error:', error);
                this.showToast('Error', 'Failed to load data: ' + (error.body ? error.body.message : error.message), 'error');
            } finally {
                this.loading = false;
            }
        }
    }

    handleStudentClick(event) {
        if (this.isReadOnly) return; 

        const studentId = event.currentTarget.dataset.id;
        const studentIndex = this.students.findIndex(s => s.id === studentId);
        
        if (studentIndex !== -1) {
            const student = this.students[studentIndex];
            const newIsAbsent = !student.isAbsent;
            
            // Temporary "Pin" for transition (0.5s)
            if (this.filter !== 'All') {
                this.pinnedIds = [...this.pinnedIds, studentId];
                setTimeout(() => {
                    this.pinnedIds = this.pinnedIds.filter(id => id !== studentId);
                }, 500);
            }

            // Trigger Student Card Pulse & Leaving effect
            const studentPulse = newIsAbsent ? 'pulse-red' : 'pulse-green';
            const statusClass = newIsAbsent ? 'absent' : 'present';
            const leavingClass = this.filter !== 'All' ? 'leaving' : '';
            
            // Toggle State
            this.students[studentIndex] = {
                ...student,
                isAbsent: newIsAbsent,
                status: newIsAbsent ? 'Absent' : 'Present',
                cardClass: `student-card ${statusClass} ${studentPulse} ${leavingClass}`
            };

            // Reset classes after animation (only relevant for 'All' view since others leave)
            setTimeout(() => {
                const refreshedIndex = this.students.findIndex(s => s.id === studentId);
                if (refreshedIndex !== -1) {
                    const s = this.students[refreshedIndex];
                    const sStatusClass = s.isAbsent ? 'absent' : 'present';
                    // In 'All' view, we keep the status color.
                    const finalClass = `student-card ${sStatusClass}`;
                    
                    this.students[refreshedIndex] = {
                        ...s,
                        cardClass: finalClass
                    };
                }
            }, 500);
        }
    }

    async handleSubmit() {
        this.loading = true;
        const absentStudents = this.students.filter(s => s.isAbsent);
        const absentStudentIds = absentStudents.map(s => s.id);
        
        // Calculate Stats
        const total = this.students.length;
        const absent = absentStudents.length;
        const present = total - absent;

        try {
            const sessionData = await saveAttendance({ 
                classVal: this.selectedClass.trim(), 
                sectionVal: this.selectedSection.trim(), 
                dateStr: this.selectedDate,
                absentStudentIds: absentStudentIds,
                totalStudents: total,
                presentCount: present,
                absentCount: absent,
                teacherId: this.selectedTeacher ? this.selectedTeacher.id : ''
            });

            if (sessionData) {
                this.submittedTeacherName = sessionData.teacherName || (this.selectedTeacher ? this.selectedTeacher.name : '');
                this.submittedTime = sessionData.createdTime || '';
                this.lastUpdatedTime = sessionData.lastUpdatedTime || '';
                this.sessionExists = sessionData.sessionExists;
                this.isSuccess = true; // Show Summary
            }

            this.showToast('Success', 'Attendance saved successfully', 'success');
            this.fetchRecentSubmissions();
            this.loading = false;
        } catch (error) {
            console.error('Save Error:', error);
            this.showToast('Error', 'Failed to save: ' + (error.body ? error.body.message : error.message), 'error');
            this.loading = false;
        }
    }

    handleUpdateAttendance() {
        this.isSuccess = false; // Switch to List View
        this.filter = 'All';
    }

    handleToggleReport() {
        this.showReport = !this.showReport;
    }

    get titleLabel() {
        return this.showReport ? 'Attendance Report' : 'Attendance Tracker';
    }

    get subtitleLabel() {
        return this.showReport ? 'View detailed attendance analytics' : 'Manage student attendance efficiently';
    }

    get reportBtnLabel() {
        return this.showReport ? 'Back to Attendance' : 'Attendance Report';
    }

    get reportBtnIcon() {
        return this.showReport ? 'utility:back' : 'utility:chart';
    }

    get formattedSelectedClass() {
        if (!this.selectedClass) return '';
        const clean = this.selectedClass.replace(/^Class-?\s*/i, '');
        return `Class ${clean}`;
    }

    get formattedSelectedSection() {
        if (!this.selectedSection) return '';
        const clean = this.selectedSection.replace(/^Section\s*/i, '');
        return `Section ${clean}`;
    }

    handleViewAttendance() {
        this.isSuccess = false; // Switch to List View (ReadOnly)
        this.filter = 'All';
    }

    async handleCloseList() {
        this.loading = true;
        try {
            // Re-fetch data to discard any local, unsaved changes
            await this.loadStudentsIfReady();
        } catch (error) {
            console.error('Error resetting list:', error);
            this.showToast('Error', 'Failed to refresh data', 'error');
        } finally {
            this.loading = false;
            this.isSuccess = true; // Go back to Summary Card
            this.filter = 'All'; // Reset filter
        }
    }

    get hasStudents() {
        return this.students && this.students.length > 0;
    }

    get showEmptyState() {
        return !this.loading && !this.hasStudents && this.selectedClass && this.selectedSection;
    }

    get isSubmitDisabled() {
        return this.isReadOnly || this.loading || !this.hasStudents;
    }

    get submitLabel() {
        return this.sessionExists ? 'Update Attendance' : 'Submit Attendance';
    }

    get showUpdatedTime() {
        return this.submittedTime && this.lastUpdatedTime && this.submittedTime !== this.lastUpdatedTime;
    }

    get stats() {
        const total = this.students.length;
        const absent = this.students.filter(s => s.isAbsent).length;
        return {
            total: total,
            present: total - absent,
            absent: absent
        };
    }
    
    get listSubtitle() {
        if (this.isReadOnly) return 'Read-Only View';
        if (this.filter === 'Present') return `Showing Present Students (${this.stats.present})`;
        if (this.filter === 'Absent') return `Showing Absent Students (${this.stats.absent})`;
        return 'Mark students who are absent';
    }

    get displayedStudents() {
        if (this.filter === 'Present') {
            return this.students
                .filter(s => !s.isAbsent || this.pinnedIds.includes(s.id))
                .map(s => ({...s, cardClass: `student-card ${s.isAbsent ? 'absent' : 'present'}`}));
        }
        if (this.filter === 'Absent') {
            return this.students
                .filter(s => s.isAbsent || this.pinnedIds.includes(s.id))
                .map(s => ({...s, cardClass: `student-card ${s.isAbsent ? 'absent' : 'present'}`}));
        }
        
        // Return all students with STATUS colors (Green/Red) in 'All' view
        return this.students.map(s => ({
            ...s,
            cardClass: `student-card ${s.isAbsent ? 'absent' : 'present'}`
        }));
    }

    handleFilterClick(event) {
        const newFilter = event.currentTarget.dataset.filter;
        if (this.filter !== newFilter) {
            this.filter = newFilter;
            this.pinnedIds = []; // Clear pins when switching views
        }
    }

    get totalCardClass() { return `stat-card total ${this.filter === 'All' ? 'active-filter' : ''}`; }
    get presentCardClass() { return `stat-card present ${this.filter === 'Present' ? 'active-filter' : ''}`; }
    get absentCardClass() { return `stat-card absent ${this.filter === 'Absent' ? 'active-filter' : ''}`; }

    // Visibility Getters
    get showTotalCard() { return true; } // Always show
    get showPresentCard() { return true; } // Always show
    get showAbsentCard() { return true; } // Always show
    
    get showStatusBadge() {
        return true;
    }

    getInitials(name) {
        return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
    }

    handleTeacherSearch(event) {
        this.teacherSearchTerm = event.target.value.toLowerCase();
        if (this.teacherSearchTerm) {
            this.isTeacherDropdownOpen = true;
            this.filteredTeachers = this.teachers.filter(t => 
                t.name.toLowerCase().includes(this.teacherSearchTerm) || 
                t.subject.toLowerCase().includes(this.teacherSearchTerm)
            );
        } else {
            this.filteredTeachers = [...this.teachers];
            this.isTeacherDropdownOpen = false;
        }
    }

    handleTeacherInputChange(event) {
        this.teacherSearchTerm = event.target.value;
        if (!this.teacherSearchTerm) {
            this.isTeacherDropdownOpen = false;
        }
    }

    openTeacherDropdown() {
        if (!this.selectedTeacher) {
            this.isTeacherDropdownOpen = true;
            this._justOpened = true; // Mark as just opened to ignore the following click event
        }
    }

    handleTeacherSelect(event) {
        const teacherId = event.currentTarget.dataset.id;
        this.selectedTeacher = this.teachers.find(t => t.id === teacherId);
        this.isTeacherDropdownOpen = false;
        this.teacherSearchTerm = this.selectedTeacher.name;
    }

    handleClearTeacher() {
        this.selectedTeacher = null;
        this.teacherSearchTerm = '';
        this.isTeacherDropdownOpen = false;
    }

    handleProceed() {
        if (this.selectedTeacher) {
            this.showTeacherSelection = false;
        }
    }

    handleTeacherChange() {
        this.handleClearTeacher();
        this.isTeacherDropdownOpen = true;
    }

    get isProceedDisabled() {
        return !this.selectedTeacher;
    }

    get teacherSearchInputClass() {
        return `search-input ${this.teacherSearchTerm ? 'has-value' : ''}`;
    }

    get teacherDropdownClass() {
        return `dropdown ${this.isTeacherDropdownOpen ? 'open' : ''}`;
    }

    get showNoTeacherMatch() {
        return this.isTeacherDropdownOpen && this.filteredTeachers.length === 0;
    }

    get contactDate() {
        const d = new Date();
        return d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    getRandomColorClass() {
        const classes = ['bg-indigo', 'bg-purple', 'bg-sky', 'bg-rose', 'bg-amber', 'bg-emerald', 'bg-pink', 'bg-teal', 'bg-orange', 'bg-violet'];
        return classes[Math.floor(Math.random() * classes.length)];
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}