import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import Id from '@salesforce/user/Id';
import getAssignedClasses from '@salesforce/apex/MarksheetController.getAssignedClasses';
import saveTeachingSession from '@salesforce/apex/MarksheetController.saveTeachingSession';
import authenticateTeacher from '@salesforce/apex/MarksheetController.authenticateTeacher';

export default class AssignedClasses extends LightningElement {
    @api teacherId = '';
    @track loading = false;
    @track currentScreen = 'login'; // 'login', 'assignedClasses', 'classTeaching'
    @track isAuthenticated = false;

    @track loginData = {
        name: '',
        phone: ''
    };

    @track assignedClasses = [];
    @track selectedClassForTeaching = null;

    @track summaryStats = {
        total: 0,
        students: 0,
        completed: 0,
        pending: 0
    };

    @track teachingSessionData = {
        topicDiscussed: '',
        teachingNotes: '',
        homeworkAssigned: '',
        classPerformance: 'Good',
        additionalComments: ''
    };

    performanceOptions = [
        { label: 'Outstanding', value: 'Outstanding' },
        { label: 'Good', value: 'Good' },
        { label: 'Average', value: 'Average' },
        { label: 'Needs Improvement', value: 'Needs Improvement' }
    ];

    connectedCallback() {
        // Check if we have a persisted session
        const savedTeacherId = sessionStorage.getItem('teacherId');
        if (savedTeacherId) {
            this.teacherId = savedTeacherId;
            this.isAuthenticated = true;
            this.currentScreen = 'assignedClasses';
            this.loadAssignedClasses();
        }
    }

    handleLoginInputChange(event) {
        const field = event.target.dataset.id === 'loginName' ? 'name' : 'phone';
        this.loginData[field] = event.target.value;
    }

    async handleLogin() {
        if (!this.loginData.name || !this.loginData.phone) {
            this.showError('Validation Error', 'Account Name and Phone are required.');
            return;
        }

        try {
            this.loading = true;
            const result = await authenticateTeacher({
                teacherName: this.loginData.name,
                phoneNumber: this.loginData.phone
            });

            if (result.isAuthenticated) {
                this.teacherId = result.id;
                this.isAuthenticated = true;
                this.currentScreen = 'assignedClasses';
                sessionStorage.setItem('teacherId', this.teacherId);
                this.showSuccess('Welcome', `Logged in as ${result.name}`);
                this.loadAssignedClasses();
            }
        } catch (error) {
            this.showError('Login Failed', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }

    handleLogout() {
        this.isAuthenticated = false;
        this.teacherId = '';
        this.currentScreen = 'login';
        sessionStorage.removeItem('teacherId');
        this.loginData = { name: '', phone: '' };
        this.assignedClasses = [];
    }

    async loadAssignedClasses() {
        if (!this.teacherId) return;
        try {
            this.loading = true;
            const today = new Date().toISOString().split('T')[0];

            const classesData = await getAssignedClasses({
                teacherId: this.teacherId,
                dateValue: today
            });

            this.assignedClasses = classesData.map(cls => {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();

                // cls.startTime and cls.endTime are now ISO strings (DateTime)
                const startDt = cls.startTime ? new Date(cls.startTime) : null;
                const endDt = cls.endTime ? new Date(cls.endTime) : null;

                const startTimeMinutes = startDt ? startDt.getHours() * 60 + startDt.getMinutes() : 0;
                const endTimeMinutes = endDt ? endDt.getHours() * 60 + endDt.getMinutes() : 0;

                let statusClass, statusLabel, cardClass;
                let isActive = false, isPending = false, isCompleted = false;

                if (cls.isCompleted) {
                    statusClass = 'status-completed';
                    statusLabel = 'Completed';
                    cardClass = 'assigned-class-card completed-card';
                    isCompleted = true;
                } else if (currentTime >= startTimeMinutes && currentTime <= endTimeMinutes) {
                    statusClass = 'status-active';
                    statusLabel = 'Active Now';
                    cardClass = 'assigned-class-card active-card';
                    isActive = true;
                } else if (currentTime < startTimeMinutes) {
                    statusClass = 'status-pending';
                    statusLabel = 'Upcoming';
                    cardClass = 'assigned-class-card pending-card';
                    isPending = true;
                } else {
                    statusClass = 'status-missed';
                    statusLabel = 'Missed';
                    cardClass = 'assigned-class-card missed-card';
                }

                return {
                    ...cls,
                    displayName: cls.className || 'N/A',
                    displaySection: cls.section ? `Section: ${cls.section}` : '',
                    periodInfo: cls.periodNumber ? `Period ${cls.periodNumber}` : 'Extra Period',
                    displayTime: this.formatTimeRange(startDt, endDt),
                    duration: this.calculateDuration(startTimeMinutes, endTimeMinutes),
                    statusClass,
                    statusLabel,
                    cardClass,
                    isActive,
                    isPending,
                    isCompleted
                };
            });

            this.updateSummaryStats();
        } catch (error) {
            this.showError('Failed to load classes', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }

    formatTimeRange(startDt, endDt) {
        if (!startDt || !endDt) return 'Time TBD';
        const formatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
        return `${startDt.toLocaleTimeString([], formatOptions)} - ${endDt.toLocaleTimeString([], formatOptions)}`;
    }

    calculateDuration(startMins, endMins) {
        const diff = endMins - startMins;
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    updateSummaryStats() {
        this.summaryStats = {
            total: this.assignedClasses.length,
            students: this.assignedClasses.reduce((total, cls) => total + (cls.studentCount || 0), 0),
            completed: this.assignedClasses.filter(cls => cls.isCompleted).length,
            pending: this.assignedClasses.filter(cls => !cls.isCompleted).length
        };
    }

    handleAssignedClassSelect(event) {
        const classId = event.currentTarget.dataset.id;
        const selected = this.assignedClasses.find(cls => cls.id === classId);

        if (selected && !selected.isCompleted) {
            this.selectedClassForTeaching = selected;
            this.currentScreen = 'classTeaching';
        } else if (selected && selected.isCompleted) {
            this.showToast('Info', 'This session has already been recorded.', 'info');
        }
    }

    handleBackToClasses() {
        this.currentScreen = 'assignedClasses';
        this.resetSessionForm();
    }

    handleInputChange(event) {
        const field = event.target.name;
        this.teachingSessionData[field] = event.target.value;
    }

    async handleSubmitSession() {
        if (!this.teachingSessionData.topicDiscussed.trim()) {
            this.showError('Validation Error', 'Please enter the topic discussed.');
            return;
        }

        try {
            this.loading = true;
            const sessionData = {
                ...this.teachingSessionData,
                assignedClassId: this.selectedClassForTeaching.id,
                teacherId: this.teacherId,
                sessionDate: new Date().toISOString().split('T')[0],
                completedTime: new Date().toLocaleTimeString()
            };

            const result = await saveTeachingSession({ sessionData });

            this.showSuccess('Success', result);

            // Re-load classes to refresh UI
            await this.loadAssignedClasses();
            this.currentScreen = 'assignedClasses';
            this.resetSessionForm();
        } catch (error) {
            this.showError('Failed to save session', error.body?.message || error.message);
        } finally {
            this.loading = false;
        }
    }

    resetSessionForm() {
        this.teachingSessionData = {
            topicDiscussed: '',
            teachingNotes: '',
            homeworkAssigned: '',
            classPerformance: 'Good',
            additionalComments: ''
        };
        this.selectedClassForTeaching = null;
    }

    showSuccess(title, message) {
        this.showToast(title, message, 'success');
    }

    showError(title, message) {
        this.showToast(title, message, 'error');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    get isMainScreen() { return this.isAuthenticated && this.currentScreen === 'assignedClasses'; }
    get isTeachingScreen() { return this.isAuthenticated && this.currentScreen === 'classTeaching'; }
    get isLoginScreen() { return !this.isAuthenticated || this.currentScreen === 'login'; }
}