import { LightningElement, track, wire } from 'lwc';
import getProjects from '@salesforce/apex/TimeEntryController.getProjects';
import getWorkstreams from '@salesforce/apex/TimeEntryController.getWorkstreams';
import saveTimeEntry from '@salesforce/apex/TimeEntryController.saveTimeEntry';
import getTimeEntriesForWeek from '@salesforce/apex/TimeEntryController.getTimeEntriesForWeek';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { open, updateUtility, enablePopout, EnclosingUtilityId } from 'lightning/platformUtilityBarApi';

export default class TimeEntry extends LightningElement {
    @track projectOptions = [];
    @track workstreamOptions = [];
    @track selectedProject = '';
    @track selectedWorkstream = '';
    @track description = '';
    @track isBillable = false;
    @track showForm = false;
    @track showWeekSummary = true;
    @track timeEntries = [];
    @track weekSummary = {
        Mon: '00:00', Tue: '00:00', Wed: '00:00',
        Thu: '00:00', Fri: '00:00', Sat: '00:00', Sun: '00:00'
    };
    @track activeEntryIndex = null;
    @track intervalId = null;
    @track startTime = null;
    @track entryIdCounter = 0;
    @track todayDate = '';
    @track selectedDayDate = new Date();
    @track monClass = '';
    @track tueClass = '';
    @track wedClass = '';
    @track thuClass = '';
    @track friClass = '';
    @track satClass = '';
    @track sunClass = '';
    @track currentWeekStart = new Date();
    @track currentDate = new Date();
    @track isEditingAnyDescription = false;
    @track isSubmitting = false;

    @wire(EnclosingUtilityId)
    utilityId;

    async connectedCallback() {
        try {
            this.currentDate = new Date();
            this.selectedDayDate = new Date(this.currentDate);
            this.setWeekStart(this.currentDate);
            this.todayDate = this.formatDate(this.currentDate);
            this.setDayClasses();
            await this.loadPreviousEntries();
            this.restoreTrackerState();
            this.startPolling();
            if (this.utilityId) {
                updateUtility(this.utilityId, {
                    label: 'Time Entry is Deactivated',
                    icon: 'utility:close',
                    highlighted: true
                });
                console.log('Utility ID retrieved:', this.utilityId);
            }
            console.log('connectedCallback completed, UI state:', {
                showForm: this.showForm,
                showWeekSummary: this.showWeekSummary,
                timeEntries: this.timeEntries.length
            });
        } catch (error) {
            console.error('Error in connectedCallback:', error.message);
            this.showError('Failed to initialize component: ' + error.message);
        }
    }

    disconnectedCallback() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.storagePollId) {
            clearInterval(this.storagePollId);
            this.storagePollId = null;
        }
    }

    startPolling() {
        if (this.storagePollId) {
            clearInterval(this.storagePollId);
        }
        this.storagePollId = setInterval(() => {
            if (!this.isEditingAnyDescription) {
                this.restoreTrackerState();
            }
        }, 5000);
    }

    restoreTrackerState() {
        try {
            const trackerState = JSON.parse(localStorage.getItem('trackerState') || '{}');
            console.log('Restoring tracker state:', trackerState);

            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }

            if (trackerState.entryId && trackerState.isActive && this.timeEntries.length > 0) {
                const entry = this.timeEntries.find(e => e.id === trackerState.entryId);
                if (entry && /^[a-zA-Z0-9]{15,18}$/.test(entry.id)) {
                    this.activeEntryIndex = this.timeEntries.findIndex(e => e.id === trackerState.entryId);
                    entry.isActive = true;
                    entry.buttonLabel = 'Stop';
                    this.startTime = trackerState.startTime || Date.now();
                    this.intervalId = setInterval(() => {
                        const now = Date.now();
                        const elapsed = (now - this.startTime) / 60000; // Minutes
                        entry.minutes = parseFloat((trackerState.baseTime || 0) + elapsed).toFixed(2);
                        console.log('Timer tick - Entry:', entry.id, 'BaseTime:', trackerState.baseTime, 'Elapsed:', elapsed, 'Total Time:', entry.minutes, 'minutes');
                        this.startTime = now;
                        this.timeEntries = [...this.timeEntries];
                        this.updateWeekSummary();
                    }, 1000);
                    updateUtility(this.utilityId, {
                        label: 'Time Entry is Activated',
                        icon: 'utility:check',
                        highlighted: true
                    });
                    console.log('Utility label set to: Time Entry is Activated with icon: utility:check');
                } else {
                    console.warn('Invalid or missing entry for ID:', trackerState.entryId);
                    localStorage.setItem('trackerState', JSON.stringify({}));
                    updateUtility(this.utilityId, {
                        label: 'Time Entry is Deactivated',
                        icon: 'utility:close',
                        highlighted: true
                    });
                }
            } else {
                this.activeEntryIndex = null;
                this.startTime = null;
                this.timeEntries = this.timeEntries.map(entry => ({
                    ...entry,
                    isActive: false,
                    buttonLabel: this.getIsToday(entry.date) ? 'Start' : ''
                }));
                localStorage.setItem('trackerState', JSON.stringify({}));
                updateUtility(this.utilityId, {
                    label: 'Time Entry is Deactivated',
                    icon: 'utility:close',
                    highlighted: true
                });
            }
            this.timeEntries = [...this.timeEntries];
            console.log('Restored timeEntries:', this.timeEntries.length);
        } catch (error) {
            console.error('Error in restoreTrackerState:', error.message);
            this.showError('Failed to restore tracker state: ' + error.message);
        }
    }

    formatDate(dateObj) {
        try {
            const date = new Date(dateObj);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (error) {
            console.error('Error in formatDate:', error.message);
            return '';
        }
    }

    normalizeDate(dateObj) {
        try {
            const date = new Date(dateObj);
            date.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('Error in normalizeDate:', error.message);
            return '';
        }
    }

    setWeekStart(date) {
        try {
            const start = new Date(date);
            start.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
            const day = start.getUTCDay();
            const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday as start
            this.currentWeekStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), diff));
            console.log('Set Week Start (UTC):', this.normalizeDate(this.currentWeekStart), 'Local:', this.formatDate(this.currentWeekStart));
        } catch (error) {
            console.error('Error in setWeekStart:', error.message);
            this.showError('Failed to set week start: ' + error.message);
        }
    }

    handlePreviousWeek() {
        try {
            const newDate = new Date(this.currentDate);
            newDate.setUTCDate(this.currentDate.getUTCDate() - 1);
            console.log('Previous Day (UTC):', this.formatDate(newDate));
            this.currentDate = newDate;
            this.selectedDayDate = new Date(newDate);
            this.setWeekStart(newDate);
            this.updateDisplayedDate();
            this.setDayClasses();
            this.loadPreviousEntries(); // Reload entries for the new week
        } catch (error) {
            console.error('Error in handlePreviousWeek:', error.message);
            this.showError('Failed to navigate to previous day: ' + error.message);
        }
    }

    handleNextWeek() {
        try {
            const newDate = new Date(this.currentDate);
            newDate.setUTCDate(this.currentDate.getUTCDate() + 1);
            console.log('Next Day (UTC):', this.formatDate(newDate));
            this.currentDate = newDate;
            this.selectedDayDate = new Date(newDate);
            this.setWeekStart(newDate);
            this.updateDisplayedDate();
            this.setDayClasses();
            this.loadPreviousEntries(); // Reload entries for the new week
        } catch (error) {
            console.error('Error in handleNextWeek:', error.message);
            this.showError('Failed to navigate to next day: ' + error.message);
        }
    }

    updateDisplayedDate() {
        try {
            this.todayDate = this.formatDate(this.currentDate);
        } catch (error) {
            console.error('Error in updateDisplayedDate:', error.message);
            this.showError('Failed to update date: ' + error.message);
        }
    }

    get isPastDate() {
        try {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            return this.selectedDayDate < today;
        } catch (error) {
            console.error('Error in isPastDate:', error.message);
            return false;
        }
    }

    get filteredEntriesForCurrentDate() {
        try {
            const selectedDate = this.normalizeDate(this.selectedDayDate);
            console.log('Selected Date (Normalized UTC):', selectedDate);
            console.log('All Time Entries:', this.timeEntries.map(e => ({ id: e.id, date: e.date, minutes: e.minutes })));
            const filtered = this.timeEntries.filter(entry => {
                const entryDate = this.normalizeDate(entry.date);
                console.log('Entry ID:', entry.id, 'Entry Date (Normalized UTC):', entryDate, 'Matches:', entryDate === selectedDate);
                return entryDate === selectedDate;
            });
            console.log('Filtered Entries:', filtered.map(e => ({ id: e.id, date: e.date, minutes: e.minutes })));
            return filtered;
        } catch (error) {
            console.error('Error in filteredEntriesForCurrentDate:', error.message);
            this.showError('Failed to filter entries: ' + error.message);
            return [];
        }
    }

    handleDayClick(event) {
        try {
            const clickedDate = event.currentTarget.dataset.date;
            if (clickedDate) {
                this.selectedDayDate = new Date(clickedDate);
                this.currentDate = new Date(clickedDate);
                this.updateDisplayedDate();
                this.setDayClasses();
                this.loadPreviousEntries(); // Reload entries for the clicked day’s week
                console.log('Clicked Date (Local):', this.formatDate(this.selectedDayDate), 'Normalized:', this.normalizeDate(this.selectedDayDate), 'Reloading entries...');
            }
        } catch (error) {
            console.error('Error in handleDayClick:', error.message);
            this.showError('Failed to select day: ' + error.message);
        }
    }

    setDayClasses() {
        try {
            const selectedDate = new Date(this.currentDate);
            const selectedDay = selectedDate.getUTCDay();
            const adjustedDay = selectedDay === 0 ? 6 : selectedDay - 1;
            const classes = Array(7).fill('');
            classes[adjustedDay] = 'today';
            [this.monClass, this.tueClass, this.wedClass, this.thuClass, this.friClass, this.satClass, this.sunClass] = classes;
            console.log('Day Classes:', { monClass: this.monClass, tueClass: this.tueClass });
        } catch (error) {
            console.error('Error in setDayClasses:', error.message);
            this.showError('Failed to set day classes: ' + error.message);
        }
    }

    @wire(getProjects)
    wiredProjects({ error, data }) {
        if (data) {
            this.projectOptions = data.map(p => ({ 
                label: this.stripHtml(p.Name), 
                value: p.Id 
            }));
            console.log('Project Names:', data.map(p => p.Name));
        } else if (error) {
            console.error('Error in wiredProjects:', error.message);
            this.showError('Failed to load projects: ' + error.body?.message);
        }
    }

    @wire(getWorkstreams)
    wiredWorkstreams({ error, data }) {
        if (data) {
            this.workstreamOptions = data.map(w => ({
                label: this.stripHtml(w.Name),
                value: w.Id
            }));
            console.log('Workstream Names:', data.map(w => w.Name));
        } else if (error) {
            console.error('Error in wiredWorkstreams:', error.message);
            this.showError('Failed to load workstreams: ' + error.body?.message);
        }
    }

    async loadPreviousEntries() {
        try {
            console.log('Fetching entries for week starting (UTC):', this.normalizeDate(this.currentWeekStart), 'Local:', this.formatDate(this.currentWeekStart));
            const result = await getTimeEntriesForWeek({ weekStart: this.currentWeekStart });
            console.log('Fetched Entries (Raw):', result.map(r => ({ id: r.Id, date: r.Date__c, hours: r.Hours_Spent__c })));
            const now = Date.now();
            this.timeEntries = result.map(rec => {
                const existingEntry = this.timeEntries.find(e => e.id === rec.Id);
                const preserveLocalDescription = existingEntry?.isEditingDescription || 
                    (existingEntry?.lastUpdated && (now - existingEntry.lastUpdated < 60000));
                return {
                    id: rec.Id,
                    projectId: rec.Project__c,
                    workstreamId: rec.ProjectStream__c,
                    projectName: this.stripHtml(rec.Project__r?.Name || ''),
                    workstreamName: this.stripHtml(rec.ProjectStream__r?.Name || ''),
                    minutes: parseFloat((rec.Hours_Spent__c || 0) * 100).toFixed(2), // Convert custom hours to minutes
                    description: preserveLocalDescription ? existingEntry.description : this.stripHtml(rec.Description__c || ''),
                    billable: rec.Billable__c || false,
                    isEditingProject: existingEntry?.isEditingProject || false,
                    isEditingWorkstream: existingEntry?.isEditingWorkstream || false,
                    isEditingDescription: existingEntry?.isEditingDescription || false,
                    isActive: existingEntry?.isActive || false,
                    buttonLabel: existingEntry?.isActive ? 'Stop' : this.getIsToday(rec.Date__c) ? 'Start' : '',
                    date: this.normalizeDate(rec.Date__c),
                    lastUpdated: existingEntry?.lastUpdated || null
                };
            });
            console.log('Time Entries after mapping:', this.timeEntries.map(e => ({ id: e.id, date: e.date, minutes: e.minutes })));
            this.timeEntries = [...this.timeEntries];
            this.updateWeekSummary();
            console.log('loadPreviousEntries completed, timeEntries count:', this.timeEntries.length);
        } catch (error) {
            console.error('Error in loadPreviousEntries:', error.message);
            this.showError('Failed to fetch time entries: ' + error.body?.message);
        }
    }

    stripHtml(text) {
        try {
            if (!text) return '';
            return text.replace(/<[^>]+>|&[^;]+;|<p>|<\/p>|<|>/g, '').trim();
        } catch (error) {
            console.error('Error in stripHtml:', error.message);
            return '';
        }
    }

    getIsToday(dateStr) {
        try {
            const date = this.normalizeDate(dateStr);
            const today = this.normalizeDate(new Date());
            return date === today;
        } catch (error) {
            console.error('Error in getIsToday:', error.message);
            return false;
        }
    }

    handleProjectChange(event) {
        try {
            this.selectedProject = event.detail?.value || '';
        } catch (error) {
            console.error('Error in handleProjectChange:', error.message);
            this.showError('Failed to change project: ' + error.message);
        }
    }

    handleWorkstreamChange(event) {
        try {
            this.selectedWorkstream = event.detail?.value || '';
        } catch (error) {
            console.error('Error in handleWorkstreamChange:', error.message);
            this.showError('Failed to change workstream: ' + error.message);
        }
    }

    handleDescriptionChange(event) {
        try {
            this.description = event.detail?.value || '';
        } catch (error) {
            console.error('Error in handleDescriptionChange:', error.message);
            this.showError('Failed to change description: ' + error.message);
        }
    }

    handleToggle(event) {
        try {
            this.isBillable = event.target.checked;
        } catch (error) {
            console.error('Error in handleToggle:', error.message);
            this.showError('Failed to toggle billable: ' + error.message);
        }
    }

    handleCancel() {
        try {
            this.selectedProject = '';
            this.selectedWorkstream = '';
            this.description = '';
            this.showForm = false;
            this.showWeekSummary = true;
            console.log('Form cancelled, UI state:', { showForm: this.showForm, showWeekSummary: this.showWeekSummary });
        } catch (error) {
            console.error('Error in handleCancel:', error.message);
            this.showError('Failed to cancel form');
        }
    }

    handleAddEntry() {
        try {
            this.showForm = true;
            this.showWeekSummary = false;
            console.log('Add entry form opened, UI state:', { showForm: this.showForm, showWeekSummary: this.showWeekSummary });
        } catch (error) {
            console.error('Error in handleAddEntry:', error.message);
            this.showError('Failed to open add entry form');
        }
    }

    async handleSubmit() {
        try {
            if (this.isSubmitting) {
                console.log('Submission already in progress, ignoring.');
                return;
            }
            this.isSubmitting = true;

            if (!this.selectedProject || !this.selectedWorkstream) {
                this.showError('Please select project and workstream.');
                this.isSubmitting = false;
                return;
            }

            const entryDate = this.normalizeDate(this.selectedDayDate);
            const newEntry = {
                id: `temp_${this.entryIdCounter++}`,
                projectId: this.selectedProject,
                workstreamId: this.selectedWorkstream,
                projectName: this.stripHtml(this.projectOptions.find(p => p.value === this.selectedProject)?.label || ''),
                workstreamName: this.stripHtml(this.workstreamOptions.find(w => w.value === this.selectedWorkstream)?.label || ''),
                description: this.description,
                billable: this.isBillable,
                minutes: '0.00',
                isActive: false,
                isEditingProject: false,
                isEditingWorkstream: false,
                isEditingDescription: false,
                buttonLabel: this.getIsToday(entryDate) ? 'Start' : '',
                date: entryDate,
                lastUpdated: Date.now()
            };

            console.log('New Entry:', newEntry);
            this.timeEntries = [...this.timeEntries, newEntry];
            this.updateWeekSummary();
            this.timeEntries = [...this.timeEntries]; // Force UI update

            await saveTimeEntry({
                entryId: null,
                projectId: newEntry.projectId,
                workstreamId: newEntry.workstreamId,
                description: newEntry.description,
                hours: 0, // New entries start with 0 hours
                entryDate: this.getApexDate(entryDate),
                isBillable: newEntry.billable
            })
                .then(result => {
                    console.log('Save successful, result:', result);
                    this.timeEntries = this.timeEntries.map(e => e.id === newEntry.id ? { 
                        ...e, 
                        id: result.Id,
                        lastUpdated: Date.now()
                    } : e);
                    this.showSuccess('Entry saved successfully!');
                    this.timeEntries = [...this.timeEntries]; // Force UI update
                    this.loadPreviousEntries(); // Reload to ensure new entry is fetched
                })
                .catch(error => {
                    console.error('Error saving entry:', error.message);
                    this.timeEntries = this.timeEntries.filter(e => e.id !== newEntry.id);
                    this.updateWeekSummary();
                    this.showError('Failed to save entry: ' + error.body?.message);
                });

            this.handleCancel();
            this.isSubmitting = false;
        } catch (error) {
            console.error('Error in handleSubmit:', error.message);
            this.showError('Failed to submit entry: ' + error.message);
            this.isSubmitting = false;
        }
    }

    handleToggleTracking(event) {
        try {
            const entryId = event.currentTarget.dataset.id;
            const index = this.timeEntries.findIndex(e => e.id === entryId);
            if (index === -1) {
                console.error('Entry not found for ID:', entryId);
                this.showError('Entry not found.');
                return;
            }

            const entry = this.timeEntries[index];
            const trackerState = JSON.parse(localStorage.getItem('trackerState') || '{}');
            console.log('Toggle Tracking - Entry ID:', entryId, 'Is Active:', entry.isActive);

            if (entry.isActive || (trackerState.entryId === entryId && trackerState.isActive)) {
                // Stop the timer
                if (this.intervalId) {
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                }
                const now = Date.now();
                const elapsed = (now - (trackerState.startTime || this.startTime || now)) / 60000; // Minutes
                entry.minutes = parseFloat((trackerState.baseTime || 0) + elapsed).toFixed(2);
                entry.isActive = false;
                entry.buttonLabel = this.getIsToday(entry.date) ? 'Start' : '';
                this.activeEntryIndex = null;
                this.startTime = null;

                localStorage.setItem('trackerState', JSON.stringify({}));
                console.log('Tracker stopped for entry:', entry.id, 'Elapsed:', elapsed, 'Total Time:', entry.minutes, 'minutes');
                updateUtility(this.utilityId, {
                    label: 'Time Entry is Deactivated',
                    icon: 'utility:close',
                    highlighted: true
                });
                console.log('Utility label set to: Time Entry is Deactivated with icon: utility:close');

                // Save to Salesforce if the entry has a valid Salesforce ID
                if (/^[a-zA-Z0-9]{15,18}$/.test(entry.id)) {
                    const hours = parseFloat(entry.minutes / 100).toFixed(2); // Non-standard conversion: 1 minute = 0.01 hours
                    console.log('Saving to Salesforce - Entry ID:', entry.id, 'Minutes:', entry.minutes, 'Converted Hours:', hours);
                    saveTimeEntry({
                        entryId: entry.id,
                        projectId: entry.projectId,
                        workstreamId: entry.workstreamId,
                        hours: parseFloat(hours), // Ensure it's a number
                        description: entry.description,
                        entryDate: this.getApexDate(entry.date),
                        isBillable: entry.billable
                    })
                        .then(result => {
                            console.log('Save successful, result:', result);
                            this.showSuccess('Tracked time saved successfully!');
                            this.loadPreviousEntries(); // Reload to update the entry
                        })
                        .catch(error => {
                            console.error('Error saving tracked time:', error.message);
                            this.showError('Failed to save tracked time: ' + error.body?.message);
                            this.loadPreviousEntries(); // Reload to revert
                        });
                } else {
                    console.log('Skipping save for temporary entry ID:', entry.id);
                }
            } else if (this.activeEntryIndex === null && !trackerState.isActive) {
                // Start the timer
                if (this.intervalId) {
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                }
                entry.isActive = true;
                entry.buttonLabel = 'Stop';
                this.activeEntryIndex = index;
                this.startTime = Date.now();
                const baseTime = parseFloat(entry.minutes || 0);

                localStorage.setItem('trackerState', JSON.stringify({
                    entryId: entryId,
                    startTime: this.startTime,
                    baseTime: baseTime,
                    isActive: true
                }));
                console.log('Tracker started for entry:', entryId, 'BaseTime:', baseTime, 'State:', localStorage.getItem('trackerState'));
                updateUtility(this.utilityId, {
                    label: 'Time Entry is Activated',
                    icon: 'utility:check',
                    highlighted: true
                });
                console.log('Utility label set to: Time Entry is Activated with icon: utility:check');

                this.intervalId = setInterval(() => {
                    const now = Date.now();
                    const elapsed = (now - this.startTime) / 60000; // Minutes
                    entry.minutes = parseFloat(baseTime + elapsed).toFixed(2);
                    console.log('Timer tick - Entry:', entryId, 'BaseTime:', baseTime, 'Elapsed:', elapsed, 'Total Time:', entry.minutes, 'minutes');
                    this.startTime = now;
                    this.timeEntries = [...this.timeEntries];
                    this.updateWeekSummary();
                }, 1000);
            } else {
                this.showError('Another tracker is already running.');
            }

            this.timeEntries = [...this.timeEntries];
        } catch (error) {
            console.error('Error in handleToggleTracking:', error.message);
            this.showError('Failed to toggle tracker: ' + error.message);
        }
    }

    updateWeekSummary() {
        try {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const newSummary = {
                Mon: '00:00', Tue: '00:00', Wed: '00:00',
                Thu: '00:00', Fri: '00:00', Sat: '00:00', Sun: '00:00'
            };

            this.timeEntries.forEach(entry => {
                if (!entry.date) return;

                const entryDate = new Date(entry.date);
                const start = new Date(this.currentWeekStart);
                const end = new Date(start);
                end.setUTCDate(start.getUTCDate() + 6);

                if (entryDate < start || entryDate > end) return;

                const weekday = days[entryDate.getUTCDay()];
                const totalMinutes = parseFloat(entry.minutes || 0);

                // Convert total minutes to hours and minutes for display
                const hours = Math.floor(totalMinutes / 60);
                const minutes = Math.floor(totalMinutes % 60);

                // Get existing summary time for the day
                const current = newSummary[weekday].split(':');
                const currentHours = parseInt(current[0]) || 0;
                const currentMinutes = parseInt(current[1]) || 0;

                // Add new time to existing time
                const updatedHours = currentHours + hours;
                const updatedMinutes = currentMinutes + minutes;

                // Normalize minutes to ensure they don't exceed 60
                const finalHours = updatedHours + Math.floor(updatedMinutes / 60);
                const finalMinutes = updatedMinutes % 60;

                newSummary[weekday] = `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
            });

            this.weekSummary = newSummary;
            console.log('Week Summary:', newSummary);
        } catch (error) {
            console.error('Error in updateWeekSummary:', error.message);
            this.showError('Failed to update week summary: ' + error.message);
        }
    }

    showError(message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message,
                variant: 'error'
            })
        );
    }

    showSuccess(message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message,
                variant: 'success'
            })
        );
    }

    enableEditing(event) {
        try {
            const entryId = event.target.dataset.id;
            const field = event.target.dataset.field;
            console.log('Enable Editing - Entry ID:', entryId, 'Field:', field);
            this.timeEntries = this.timeEntries.map(entry => {
                if (entry.id === entryId) {
                    const isEditingDescription = field === 'description' ? true : entry.isEditingDescription;
                    if (isEditingDescription && !this.isEditingAnyDescription) {
                        this.isEditingAnyDescription = true;
                        console.log('Paused polling');
                    }
                    return {
                        ...entry,
                        isEditingProject: field === 'projectName' ? true : entry.isEditingProject,
                        isEditingWorkstream: field === 'workstreamName' ? true : entry.isEditingWorkstream,
                        isEditingDescription
                    };
                }
                return entry;
            });
            this.timeEntries = [...this.timeEntries];
        } catch (error) {
            console.error('Error in enableEditing:', error.message);
            this.showError('Failed to enable editing: ' + error.message);
        }
    }

    handleProjectSelect(event) {
        try {
            const entryId = event.target.dataset.id;
            const selectedProjectId = event.detail.value;
            const entry = this.timeEntries.find(e => e.id === entryId);
            if (entry && selectedProjectId && selectedProjectId !== entry.projectId) {
                const newEntry = {
                    id: `entry_${this.entryIdCounter++}`,
                    projectId: selectedProjectId,
                    workstreamId: entry.workstreamId,
                    projectName: this.stripHtml(this.projectOptions.find(p => p.value === selectedProjectId)?.label || ''),
                    workstreamName: entry.workstreamName,
                    minutes: entry.minutes,
                    description: entry.description,
                    billable: entry.billable,
                    isEditingProject: false,
                    isEditingWorkstream: false,
                    isEditingDescription: false,
                    isActive: false,
                    buttonLabel: this.getIsToday(entry.date) ? 'Start' : '',
                    date: entry.date,
                    lastUpdated: null
                };
                this.timeEntries = [...this.timeEntries.filter(e => e.id !== entryId), newEntry];
                this.saveNewTimeEntry(newEntry, null);
            } else if (entry) {
                entry.isEditingProject = false;
                this.timeEntries = [...this.timeEntries];
            }
        } catch (error) {
            console.error('Error in handleProjectSelect:', error.message);
            this.showError('Failed to select project: ' + error.message);
        }
    }

    handleWorkstreamSelect(event) {
        try {
            const entryId = event.target.dataset.id;
            const selectedWorkstreamId = event.detail.value;
            const entry = this.timeEntries.find(e => e.id === entryId);
            if (entry && selectedWorkstreamId && selectedWorkstreamId !== entry.workstreamId) {
                entry.workstreamId = selectedWorkstreamId;
                entry.workstreamName = this.stripHtml(this.workstreamOptions.find(w => w.value === selectedWorkstreamId)?.label || '');
                entry.isEditingWorkstream = false;
                this.timeEntries = [...this.timeEntries];
                this.saveNewTimeEntry(entry, entry.id);
            } else if (entry) {
                entry.isEditingWorkstream = false;
                this.timeEntries = [...this.timeEntries];
            }
        } catch (error) {
            console.error('Error in handleWorkstreamSelect:', error.message);
            this.showError('Failed to select workstream: ' + error.message);
        }
    }

    handleComboboxBlur(event) {
        try {
            const entryId = event.target.dataset.id;
            const field = event.target.dataset.field;
            const entry = this.timeEntries.find(e => e.id === entryId);
            if (entry) {
                if (field === 'projectName') entry.isEditingProject = false;
                if (field === 'workstreamName') entry.isEditingWorkstream = false;
                this.timeEntries = [...this.timeEntries];
            }
        } catch (error) {
            console.error('Error in handleComboboxBlur:', error.message);
            this.showError('Failed to handle combobox error: ' + error.message);
        }
    }

    handleBlur(event) {
        try {
            const entryId = event.target.dataset.id;
            const field = event.target.dataset.field;
            if (field !== 'description') return;

            const entry = this.timeEntries.find(e => e.id === entryId);
            if (!entry) {
                console.error('Entry not found for ID:', entryId);
                this.showError('Entry not found.');
                return;
            }

            entry.isEditingDescription = false;
            this.isEditingAnyDescription = this.timeEntries.some(e => e.isEditingDescription);
            if (!this.isEditingAnyDescription) {
                console.log('Resumed polling');
                this.startPolling();
            }
            this.timeEntries = [...this.timeEntries];
            console.log('Editing - Exited for Entry ID:', entryId);
        } catch (error) {
            console.error('Error in handleBlur:', error.message);
            this.showError('Failed to exit editing: ' + error.message);
        }
    }

    async handleKeydown(event) {
        try {
            if (event.key !== 'Enter') return;

            const entryId = event.target.dataset.id;
            const field = event.target.dataset.field;
            if (field !== 'description') return;

            const newValue = event.target.value || '';
            console.log('Handle Keydown - Entry ID:', entryId, 'Value:', newValue);

            const entry = this.timeEntries.find(e => e.id === entryId);
            if (!entry) {
                console.error('Entry not found for ID:', entryId);
                this.showError('Entry not found.');
                return;
            }

            entry.description = newValue;
            entry.isEditingDescription = false;
            entry.lastUpdated = Date.now();
            this.isEditingAnyDescription = false;
            this.timeEntries = [...this.timeEntries];
            console.log('Updated description in UI:', entry.description);

            if (/^[a-zA-Z0-9]{15}/.test(entry.id)) {
                await this.saveNewTimeEntry(entry, entry.id);
            }
            console.log('Resumed polling');
            this.startPolling();
        } catch (error) {
            console.error('Error in handleKeydown:', error.message);
            this.showError('Failed to update description: ' + error.message);
            this.isEditingAnyDescription = false;
            this.startPolling();
        }
    }

    getISTDate(dateObj) {
        try {
            const date = new Date(dateObj);
            // Adjust to IST (UTC+5:30) by adding 5 hours and 30 minutes
            const istOffset = 5 * 60 + 30; // 5 hours 30 minutes in minutes
            date.setUTCMinutes(date.getUTCMinutes() + istOffset);
            date.setUTCHours(0, 0, 0, 0); // Set to midnight IST
            return date;
        } catch (error) {
            console.error('Error in getISTDate:', error.message);
            return new Date();
        }
    }

    getApexDate(dateObj) {
        try {
            return this.normalizeDate(dateObj);
        } catch (error) {
            console.error('Error in getApexDate:', error.message);
            return this.normalizeDate(new Date());
        }
    }

    async saveNewTimeEntry(entry, entryId) {
        try {
            const entryDate = this.getISTDate(entry.date);
            const hours = parseFloat((entry.minutes || 0) / 100).toFixed(2); // Non-standard conversion: 1 minute = 0.01 hours
            console.log('Saving time entry - Entry ID:', entryId, 'Minutes:', entry.minutes, 'Converted Hours:', hours);
            const saveParams = {
                entryId: entryId,
                projectId: entry.projectId,
                workstreamId: entry.workstreamId || '',
                hours: parseFloat(hours), // Ensure it's a number
                description: entry.description || '',
                entryDate: this.getApexDate(entryDate),
                isBillable: entry.billable || false
            };
            console.log('Saving time entry with params:', saveParams);

            const result = await saveTimeEntry(saveParams);
            console.log('Save successful, result:', result);
            this.showSuccess(entryId ? 'Time entry updated!' : 'Time entry created!');
            if (!entryId && result && result.Id) {
                this.timeEntries = this.timeEntries.map(e => e.id === entry.id ? { ...e, id: result.Id, lastUpdated: Date.now() } : e);
                this.timeEntries = [...this.timeEntries];
            }
            await this.loadPreviousEntries(); // Reload to ensure new entry is fetched
        } catch (error) {
            console.error('Error in saveNewTimeEntry:', error.message);
            this.showError('Failed to save time entry: ' + error.message);
            await this.loadPreviousEntries(); // Reload to revert
        }
    }
}