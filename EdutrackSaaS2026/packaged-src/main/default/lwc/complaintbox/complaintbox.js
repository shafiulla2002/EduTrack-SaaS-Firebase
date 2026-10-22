import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getStudentClasses from '@salesforce/apex/ComplaintBox.getStudentClasses';
import getStudentsByClass from '@salesforce/apex/ComplaintBox.getStudentsByClass';
import submitStudentBehavior from '@salesforce/apex/ComplaintBox.submitStudentBehavior';
import getAcademicYears from '@salesforce/apex/ComplaintBox.getAcademicYears';
import debugData from '@salesforce/apex/ComplaintBox.debugData';
import getTeachers from '@salesforce/apex/ComplaintBox.getTeachers'; // ✅ NEW

export default class TeacherBehaviorSubmission extends LightningElement {
    @track searchKey = '';
    @track selectedClass = '';
    @track students = [];
    @track filteredStudents = [];
    @track selectedStudent = null;
    @track behaviorType = '';
    @track category = '';
    @track description = '';
    @track academicYear = '';
    @track submittingTeacher = ''; // ✅ NEW
    @track showStudentList = false;
    @track isLoading = false;
    @track isSubmitting = false;

    classOptions = [];
    academicYearOptions = [];
    teacherOptions = []; // ✅ NEW

    behaviorTypeOptions = [
        { label: 'Complaint', value: 'Complaint' },
        { label: 'Praise', value: 'Praise' }
    ];

    categoryOptions = [
        { label: 'Academic Performance', value: 'Academic' },
        { label: 'Discipline', value: 'Discipline' },
        { label: 'Sports & Athletics', value: 'Sports' },
        { label: 'Extra-Curricular Activities', value: 'Extra-Curricular' },
        { label: 'General Behavior', value: 'General' }
    ];

    get filteredStudentsCount() {
        return this.filteredStudents.length;
    }

    connectedCallback() {
        this.runDebug();
        this.loadClasses();
        this.loadTeachers(); // ✅ NEW
    }

    runDebug() {
        debugData()
            .then(result => {
                console.log('=== DEBUG INFO ===');
                console.log('User ID:', result.userId);
                console.log('User Name:', result.userName);
                console.log('Contact ID:', result.contactId);
                console.log('Profile:', result.profileName);
                console.log('Total Students:', result.totalStudents);
                console.log('Sample Classes:', result.sampleClasses);
                console.log('Class Field Exists:', result.classFieldExists);
                console.log('Class Field Type:', result.classFieldType);
                console.log('==================');
            })
            .catch(error => {
                console.error('Debug error:', error);
            });
    }

    loadClasses() {
        console.log('Loading classes...');
        getStudentClasses()
            .then(data => {
                console.log('Classes received:', data);
                if (data && data.length > 0) {
                    this.classOptions = [
                        { label: '-- Select a Class --', value: '' },
                        ...data.map(className => ({
                            label: className,
                            value: className
                        }))
                    ];
                } else {
                    this.showToast('Warning', 'No classes found. Please check your data setup.', 'warning');
                }
            })
            .catch(error => {
                console.error('Error loading classes:', error);
                this.showToast('Error', 'Unable to load classes: ' + this.getErrorMessage(error), 'error');
            });
    }

    // ✅ NEW: Load all teachers
    loadTeachers() {
        console.log('Loading teachers...');
        getTeachers()
            .then(data => {
                console.log('Teachers received:', data);
                if (data && data.length > 0) {
                    this.teacherOptions = [
                        { label: '-- Select a Teacher --', value: '' },
                        ...data.map(teacher => ({
                            label: teacher.Name,
                            value: teacher.Id
                        }))
                    ];
                } else {
                    console.warn('No teachers found');
                    this.showToast('Warning', 'No teachers found in the system.', 'warning');
                }
            })
            .catch(error => {
                console.error('Error loading teachers:', error);
                this.showToast('Error', 'Unable to load teachers: ' + this.getErrorMessage(error), 'error');
            });
    }

    @wire(getAcademicYears)
    wiredAcademicYears({ error, data }) {
        if (data) {
            console.log('Academic years loaded:', data);
            this.academicYearOptions = data.map(year => ({
                label: year,
                value: year
            }));
            if (this.academicYearOptions.length > 0) {
                this.academicYear = this.academicYearOptions[0].value;
            }
        } else if (error) {
            console.error('Error loading academic years:', error);
        }
    }

    handleClassChange(event) {
        this.selectedClass = event.detail.value;
        this.searchKey = '';
        this.selectedStudent = null;
        console.log('Class selected:', this.selectedClass);
        if (this.selectedClass) {
            this.loadStudentsByClass();
        } else {
            this.students = [];
            this.filteredStudents = [];
            this.showStudentList = false;
        }
    }

    loadStudentsByClass() {
        this.isLoading = true;
        console.log('Loading students for class:', this.selectedClass);
        getStudentsByClass({ className: this.selectedClass })
            .then(result => {
                console.log('Students loaded:', result);
                this.students = result || [];
                this.filteredStudents = result || [];
                this.showStudentList = result && result.length > 0;
                if (!result || result.length === 0) {
                    this.showToast('Info', 'No students found in this class', 'info');
                } else {
                    this.showToast('Success', `${result.length} student(s) loaded`, 'success');
                }
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading students:', error);
                this.showToast('Error', 'Error loading students: ' + this.getErrorMessage(error), 'error');
                this.isLoading = false;
            });
    }

    handleSearchChange(event) {
        this.searchKey = event.target.value.toLowerCase();
        this.filterStudents();
    }

    filterStudents() {
        if (!this.searchKey) {
            this.filteredStudents = [...this.students];
        } else {
            this.filteredStudents = this.students.filter(student => {
                const name = student.Name?.toLowerCase() || '';
                const phone = student.PersonMobilePhone?.toLowerCase() || '';
                return name.includes(this.searchKey) || phone.includes(this.searchKey);
            });
        }
    }

    handleStudentSelect(event) {
        const studentId = event.currentTarget.dataset.id;
        this.selectedStudent = this.students.find(s => s.Id === studentId);
        console.log('Student selected:', this.selectedStudent);
        this.showToast('Success', `Student ${this.selectedStudent.Name} selected`, 'success');
    }

    clearStudentSelection() {
        this.selectedStudent = null;
        this.handleReset();
    }

    handleBehaviorTypeChange(event) {
        this.behaviorType = event.detail.value;
    }

    handleCategoryChange(event) {
        this.category = event.detail.value;
    }

    handleDescriptionChange(event) {
        this.description = event.detail.value;
    }

    handleAcademicYearChange(event) {
        this.academicYear = event.detail.value;
    }

    // ✅ NEW: Teacher change handler
    handleTeacherChange(event) {
        this.submittingTeacher = event.detail.value;
    }

    handleSubmit() {
        if (!this.selectedStudent) {
            this.showToast('Error', 'Please select a student', 'error');
            return;
        }
        if (!this.behaviorType || !this.category || !this.description || !this.academicYear) {
            this.showToast('Error', 'Please fill all required fields', 'error');
            return;
        }
        // ✅ NEW: Validate teacher
        if (!this.submittingTeacher) {
            this.showToast('Error', 'Please select a submitting teacher', 'error');
            return;
        }
        if (this.description.length < 10) {
            this.showToast('Error', 'Description must be at least 10 characters', 'error');
            return;
        }

        this.isSubmitting = true;
        this.isLoading = true;

        submitStudentBehavior({
            studentId: this.selectedStudent.Id,
            behaviorType: this.behaviorType,
            category: this.category,
            description: this.description,
            academicYear: this.academicYear,
            teacherId: this.submittingTeacher // ✅ NEW
        })
        .then(caseId => {
            console.log('Behavior submitted successfully. Case ID:', caseId);
            this.showToast(
                'Success! 🎉',
                `Behavior record submitted successfully! Case ${caseId} has been created.`,
                'success'
            );
            this.handleReset();
            this.selectedStudent = null;
            this.isSubmitting = false;
            this.isLoading = false;
        })
        .catch(error => {
            console.error('Submit error:', error);
            this.showToast('Error', 'Error submitting record: ' + this.getErrorMessage(error), 'error');
            this.isSubmitting = false;
            this.isLoading = false;
        });
    }

    handleReset() {
        this.behaviorType = '';
        this.category = '';
        this.description = '';
        this.submittingTeacher = ''; // ✅ NEW: also reset teacher
    }

    getErrorMessage(error) {
        if (error.body) {
            if (error.body.message) return error.body.message;
            if (error.body.pageErrors && error.body.pageErrors.length > 0)
                return error.body.pageErrors[0].message;
        }
        return error.message || 'Unknown error occurred';
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant,
            mode: 'dismissable'
        });
        this.dispatchEvent(event);
    }
}