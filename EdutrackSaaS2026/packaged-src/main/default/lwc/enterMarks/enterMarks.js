import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getClasses               from '@salesforce/apex/EnterMarksController.getClasses';
import getSubjects              from '@salesforce/apex/EnterMarksController.getSubjects';
import getExamTypes             from '@salesforce/apex/EnterMarksController.getExamTypes';
import getStudentsForMarksEntry from '@salesforce/apex/EnterMarksController.getStudentsForMarksEntry';
import saveMarks                from '@salesforce/apex/EnterMarksController.saveMarks';
import bulkCreateSubjects       from '@salesforce/apex/ClassManagementController.bulkCreateSubjects';
import getSections from '@salesforce/apex/EnterMarksController.getSections';

export default class EnterMarks extends LightningElement {
    @api teacherId;
    @api maxMarks = 100;
@track selectedSection  = '';
@track sectionOptions   = [];
    @track loading           = false;
    @track selectedClass     = '';
    @track selectedSubject   = '';
    @track selectedExam      = '';
    @track classOptions      = [];
    @track subjectOptions    = [];
    @track examOptions       = [];
    @track studentsList      = [];
    @track showStudentsList  = false;
    @track showNoDataMessage = false;
    @track noDataMessage     = '';

    // Quick Add Subject
    @track isAddSubjectModalOpen = false;
    @track newSubjectName = '';

    allSubjects = [];

    // ─── Statistics ───────────────────────────────────────────────
    get classAverage() {
        // ✅ FIX: isMarksEntered() treats 0 as valid entered value
        const students = this.studentsList.filter(s => this.isMarksEntered(s.obtainedMarks));
        if (!students.length) return '0%';
        const total = students.reduce((sum, s) => sum + parseFloat(s.obtainedMarks), 0);
        return ((total / students.length / this.maxMarks) * 100).toFixed(1) + '%';
    }
get isSectionDisabled() { return !this.selectedClass; }
get isSubjectDisabled() { return !this.selectedSection; }  // update existing
get isExamDisabled()    { return !this.selectedSubject; }  // unchanged

get selectedSectionLabel() {
    const o = this.sectionOptions.find(opt => opt.value === this.selectedSection);
    return o ? o.label : '';
}
    get highestMarks() {
        const students = this.studentsList.filter(s => this.isMarksEntered(s.obtainedMarks));
        if (!students.length) return '0/' + this.maxMarks;
        return Math.max(...students.map(s => parseFloat(s.obtainedMarks))) + '/' + this.maxMarks;
    }

    get studentsEntered() {
        const count = this.studentsList.filter(s => this.isMarksEntered(s.obtainedMarks)).length;
        return count + '/' + this.studentsList.length;
    }

    get isSubjectDisabled() { return !this.selectedClass; }
    get isExamDisabled()    { return !this.selectedSubject; }
    get isSaveDisabled()    { return this.loading || !this.hasValidMarks(); }
    get isNewSubjectSaveDisabled() {
        return !this.newSubjectName || this.newSubjectName.trim().length === 0 || this.loading;
    }

    get selectedClassLabel() {
        const o = this.classOptions.find(opt => opt.value === this.selectedClass);
        return o ? o.label : '';
    }
    get selectedSubjectLabel() {
        const o = this.subjectOptions.find(opt => opt.value === this.selectedSubject);
        return o ? o.label : '';
    }
    get selectedExamLabel() {
        const o = this.examOptions.find(opt => opt.value === this.selectedExam);
        return o ? o.label : '';
    }

    // ─── KEY HELPER: treats 0 as a valid entered value ────────────
    // null / undefined / '' = not entered
    // 0, 1, 50, 100        = entered (including zero score)
    isMarksEntered(val) {
        return val !== null && val !== undefined && val !== '';
    }

    // ─── Lifecycle ────────────────────────────────────────────────
    async connectedCallback() {
        await this.loadInitialData();
    }

    // ─── Data loading ─────────────────────────────────────────────
    async loadInitialData() {
        this.loading = true;
        try {
            await Promise.all([this.loadClasses(), this.loadSections(), this.loadSubjects(), this.loadExamTypes()]);
        } catch (error) {
            this.handleError('Failed to load initial data', error);
        } finally {
            this.loading = false;
        }
    }

async loadSections() {
    const sections = await getSections();
    this.sectionOptions = (sections || []).map(s => ({ label: s.label, value: s.value }));
}

    async loadClasses() {
        const classes = await getClasses();
        this.classOptions = (classes || []).map(cls => ({ label: cls.label, value: cls.value }));
    }

    async loadSubjects() {
        const subjects = await getSubjects();
        this.allSubjects = subjects || [];
    }

    async loadExamTypes() {
        const exams = await getExamTypes();
        this.examOptions = (exams || []).map(exam => ({ label: exam, value: exam }));
    }

    async loadStudents() {
        if (!this.selectedClass || !this.selectedSubject || !this.selectedExam) return;

        this.loading = true;
        this.showStudentsList  = false;
        this.showNoDataMessage = false;

        try {
            const selectedSubj = this.allSubjects.find(
                s => (s.id || s.Id) === this.selectedSubject
            );
            const subjectName = selectedSubj ? (selectedSubj.name || selectedSubj.Name) : '';

            const students = await getStudentsForMarksEntry({
                classId:     this.selectedClass,
    sectionId:   this.selectedSection || null,   // NEW
    subjectName: subjectName,
    examType:    this.selectedExam
            });

            if (students && students.length > 0) {
                this.studentsList = students.map(student => {
                    // ✅ FIX: Apex returns 0 as a number — keep it as-is.
                    // Only treat as "not entered" when Apex explicitly returns null/undefined.
                    const rawMarks = student.obtainedMarks;
                    // ✅ If Apex returns null (no exam record / no marks saved), use ''
                    // If Apex returns 0 (marks were saved as 0), use 0
                    const marks = (rawMarks === null || rawMarks === undefined) ? '' : rawMarks;
                    const gradeData = this.calculateGrade(marks);
                    return {
                        Id:             student.studentId,
                        Name:           student.name,
                        Roll_Number__c: student.rollNumber,
                        avatar:         this.generateAvatar(student.name),
                        obtainedMarks:  marks,
                        examId:         student.examId || null,
                        hasMarks:       student.hasMarks || false,
                        grade:          gradeData.grade,
                        gradeClass:     gradeData.gradeClass
                    };
                });
                this.showStudentsList = true;
            } else {
                this.showNoDataMessage = true;
                this.noDataMessage = 'No students found for the selected class.';
            }
        } catch (error) {
            this.handleError('Failed to load students', error);
        } finally {
            this.loading = false;
        }
    }

    // ─── Event handlers ───────────────────────────────────────────
   handleClassChange(event) {
    this.selectedClass   = event.detail.value;
    this.selectedSection = '';   // reset section
    this.selectedSubject = '';
    this.selectedExam    = '';
    this.showStudentsList  = false;
    this.showNoDataMessage = false;
    this.updateSubjectOptions();
}

handleSectionChange(event) {
    this.selectedSection = event.detail.value;
    this.selectedSubject = '';
    this.selectedExam    = '';
    this.showStudentsList  = false;
    this.showNoDataMessage = false;
}

    updateSubjectOptions() {
        this.subjectOptions = (this.allSubjects || []).map(subj => ({
            label: subj.name || subj.Name,
            value: subj.id   || subj.Id
        }));
    }

    handleSubjectChange(event) {
        this.selectedSubject = event.detail.value;
        this.selectedExam    = '';
        this.showStudentsList  = false;
        this.showNoDataMessage = false;
    }

    handleExamChange(event) {
        this.selectedExam = event.detail.value;
        this.showStudentsList  = false;
        this.showNoDataMessage = false;
        if (this.selectedExam && this.selectedClass && this.selectedSection && this.selectedSubject) {
    this.loadStudents();
}

    }

    // ─── Quick Add Subject ────────────────────────────────────────
    handleOpenAddSubject() {
        this.isAddSubjectModalOpen = true;
        this.newSubjectName = '';
    }

    handleCloseAddSubject() {
        this.isAddSubjectModalOpen = false;
    }

    handleNewSubjectNameChange(event) {
        this.newSubjectName = event.target.value;
    }

    async handleSaveNewSubject() {
        if (!this.newSubjectName || this.newSubjectName.trim() === '') return;

        this.loading = true;
        try {
            const result = await bulkCreateSubjects({
                subjectsData: [{ name: this.newSubjectName.trim() }]
            });

            if (result.created > 0) {
                this.showToast('Success', `Subject "${this.newSubjectName}" created!`, 'success');
                this.handleCloseAddSubject();
                await this.loadSubjects();
                this.updateSubjectOptions();
                const newSub = this.allSubjects.find(
                    s => (s.name || s.Name).toLowerCase() === this.newSubjectName.toLowerCase().trim()
                );
                if (newSub) this.selectedSubject = (newSub.id || newSub.Id);
            } else if (result.skipped > 0) {
                this.showToast('Note', 'This subject already exists.', 'info');
                this.handleCloseAddSubject();
            } else {
                this.showToast('Error', 'Failed to create subject', 'error');
            }
        } catch (error) {
            this.handleError('Error creating subject', error);
        } finally {
            this.loading = false;
        }
    }

    handleIncrementMarks(event) {
        this.adjustMarks(event.currentTarget.dataset.studentId, 1);
    }

    handleDecrementMarks(event) {
        this.adjustMarks(event.currentTarget.dataset.studentId, -1);
    }

    adjustMarks(studentId, delta) {
        this.studentsList = this.studentsList.map(student => {
            if (student.Id !== studentId) return student;
            // ✅ FIX: treat '' as 0 when incrementing/decrementing
            const current = this.isMarksEntered(student.obtainedMarks)
                            ? parseFloat(student.obtainedMarks)
                            : 0;
            const val = Math.min(Math.max(current + delta, 0), this.maxMarks);
            const gradeData = this.calculateGrade(val);
            return { ...student, obtainedMarks: val, grade: gradeData.grade, gradeClass: gradeData.gradeClass };
        });
    }

    handleMarksChange(event) {
        const studentId = event.target.dataset.studentId;
        const rawValue  = event.detail.value;

        // ✅ FIX: empty string means user cleared the field → treat as not-entered ('')
        // null from lightning-input number also means cleared
        if (rawValue === null || rawValue === undefined || rawValue === '') {
            this.studentsList = this.studentsList.map(student => {
                if (student.Id !== studentId) return student;
                return { ...student, obtainedMarks: '', grade: '', gradeClass: '' };
            });
            return;
        }

        const marks = parseFloat(rawValue);

        // ✅ FIX: 0 is valid; only reject values outside 0–maxMarks
        if (isNaN(marks) || marks < 0 || marks > this.maxMarks) {
            this.showToast('Invalid Marks', `Marks must be between 0 and ${this.maxMarks}`, 'warning');
            return;
        }

        this.studentsList = this.studentsList.map(student => {
            if (student.Id !== studentId) return student;
            const gradeData = this.calculateGrade(marks);
            return { ...student, obtainedMarks: marks, grade: gradeData.grade, gradeClass: gradeData.gradeClass };
        });
    }

    // ─── Save marks ───────────────────────────────────────────────
    async handleSaveMarks() {
        if (!this.validateMarks()) {
            this.showToast('Validation Error', 'Please enter valid marks for at least one student', 'error');
            return;
        }

        this.loading = true;
        try {
            // ✅ FIX: include students where marks === 0 (isMarksEntered handles this)
            const marksDataList = this.studentsList
                .filter(s => this.isMarksEntered(s.obtainedMarks))
                .map(student => ({
                    studentId:     student.Id,
                    subjectId:     this.selectedSubject,
                    obtainedMarks: Math.round(parseFloat(student.obtainedMarks)),
                    maxMarks:      Math.round(this.maxMarks),
                    examId:        student.examId || null
                }));

            const result = await saveMarks({
    studentMarksDataList: marksDataList,
    examType:   this.selectedExam,
    classId:    this.selectedClass,
    teacherId:  this.teacherId || null,
    sectionId:  this.selectedSection || null    // ← ADD this
});

            this.showToast('Success', result || 'Marks saved successfully!', 'success');
            await this.loadStudents();

        } catch (error) {
            this.handleError('Failed to save marks', error);
        } finally {
            this.loading = false;
        }
    }

    handleCancel() { this.resetForm(); }
    handleBack()   { this.dispatchEvent(new CustomEvent('back')); }

    // ─── Helpers ──────────────────────────────────────────────────
    calculateGrade(marks) {
        // ✅ FIX: isMarksEntered check so grade shows for 0 too (grade F)
        if (!this.isMarksEntered(marks)) return { grade: '', gradeClass: '' };
        const pct = (parseFloat(marks) / this.maxMarks) * 100;
        if (isNaN(pct)) return { grade: '', gradeClass: '' };

        let grade, suffix;
        if      (pct >= 90) { grade = 'A+'; suffix = 'grade-a-plus'; }
        else if (pct >= 80) { grade = 'A';  suffix = 'grade-a'; }
        else if (pct >= 70) { grade = 'B';  suffix = 'grade-b'; }
        else if (pct >= 60) { grade = 'C';  suffix = 'grade-c'; }
        else if (pct >= 50) { grade = 'D';  suffix = 'grade-d'; }
        else if (pct >= 35) { grade = 'E';  suffix = 'grade-e'; }
        else                { grade = 'F';  suffix = 'grade-f'; }

        return { grade, gradeClass: 'grade-badge ' + suffix };
    }

    // ✅ FIX: validateMarks now correctly treats 0 as a valid entered mark
    validateMarks() {
        // Must have at least one student with marks entered (including 0)
        const hasAny = this.studentsList.some(s => this.isMarksEntered(s.obtainedMarks));
        if (!hasAny) return false;

        // Every entered mark must be a valid number in range
        return this.studentsList.every(s => {
            if (!this.isMarksEntered(s.obtainedMarks)) return true; // skipped = OK
            const v = parseFloat(s.obtainedMarks);
            return !isNaN(v) && v >= 0 && v <= this.maxMarks;
        });
    }

    // ✅ FIX: hasValidMarks treats 0 as valid — Save button enables when any mark entered
    hasValidMarks() {
        return this.studentsList.length > 0 &&
               this.studentsList.some(s => this.isMarksEntered(s.obtainedMarks));
    }

    resetForm() {
        this.selectedClass     = '';
        this.selectedSubject   = '';
        this.selectedExam      = '';
        this.subjectOptions    = [];
        this.studentsList      = [];
        this.showStudentsList  = false;
        this.showNoDataMessage = false;
    }

    generateAvatar(name) {
        if (!name) return '👤';
        return name.split(' ').filter(w => w.length > 0).map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    handleError(title, error) {
        console.error(title, error);
        const message = error.body?.message || error.message || 'An unknown error occurred';
        this.showToast(title, message, 'error');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}