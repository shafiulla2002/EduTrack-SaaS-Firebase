import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAcademicYearOptions from '@salesforce/apex/AdmissionController.getAcademicYearOptions';
import getClassOptions from '@salesforce/apex/AdmissionController.getClassOptions';
import getClassSummaryData from '@salesforce/apex/PromotionController.getClassSummaryData';
import getStudentsForPromotion from '@salesforce/apex/PromotionController.getStudentsForPromotion';
import promoteStudents from '@salesforce/apex/PromotionController.promoteStudents';
import promoteClasses from '@salesforce/apex/PromotionController.promoteClasses';
import getActiveProducts from '@salesforce/apex/AdmissionController.getActiveProducts';
import LightningConfirm from 'lightning/confirm';

const CLASS_ORDER = [
    'Nursery', 'LKG', 'UKG',
    'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5',
    'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10'
];

function getNextClass(currentClass) {
    if (!currentClass) return '';
    // Handle both "Class-1" and "Class 1" formats just in case
    const normalized = currentClass.replace(' ', '-');
    const idx = CLASS_ORDER.indexOf(normalized);
    if (idx >= 0 && idx < CLASS_ORDER.length - 1) {
        return CLASS_ORDER[idx + 1];
    }
    return '';
}

export default class StudentPromotion extends LightningElement {
    @track students = [];
    @track isLoading = false;
    @track searchQuery = '';

    // Metadata
    @track academicYearOptions = [];
    @track classOptionsList = []; // Clean list from wire
    @track sectionOptions = ['A', 'B', 'C', 'D', 'E'];

    // Source Filters
    @track sourceYear = '';
    @track sourceClass = '';
    @track sourceSection = '';

    // Target Config
    @track targetYear = '';
    @track targetClass = '';
    @track targetSection = '';

    // Summary Data
    @track sourceSummary = [];
    @track targetSummary = [];
    @track selectedSummaryKeys = []; // Stores "className-section"
    @track isDrilldown = false; // Controls CLASS vs STUDENT view

    // Fees
    @track availableProducts = [];
    @track selectedProductIds = [];

    @wire(getAcademicYearOptions)
    wiredYears({ error, data }) {
        if (data) {
            this.academicYearOptions = data;
            if (data.length > 0 && !this.sourceYear) {
                this.sourceYear = data[0].value;
                this.syncTargetYear();
            }
        }
    }

    syncTargetYear() {
        if (this.academicYearOptions.length > 0 && this.sourceYear) {
            const currentIdx = this.academicYearOptions.findIndex(opt => opt.value === this.sourceYear);
            if (currentIdx < this.academicYearOptions.length - 1) {
                this.targetYear = this.academicYearOptions[currentIdx + 1].value;
            } else {
                this.targetYear = this.academicYearOptions[currentIdx].value;
            }
        }
    }

    @wire(getClassOptions)
    wiredClasses({ error, data }) {
        if (data) this.classOptionsList = data;
    }

    @wire(getActiveProducts, { className: '$targetClass', academicYearId: '$targetYear' })
    wiredProducts({ error, data }) {
        if (data) {
            this.availableProducts = data;
            this.selectedProductIds = data.map(p => p.Id);
        } else if (error) {
            this.availableProducts = [];
            this.selectedProductIds = [];
        }
    }

    // GETTERS
    get classOptions() {
        return ['ALL', ...this.classOptionsList];
    }

    get isSummaryView() {
        return !this.isDrilldown && (!this.sourceClass || this.sourceClass === 'ALL');
    }

    get showBackButton() {
        return !this.isSummaryView;
    }

    get hasSelectedFilters() {
        return this.sourceYear && this.sourceClass;
    }

    get sectionOptionsMapped() {
        return this.sectionOptions.map(sec => ({
            label: sec,
            className: `section-chip ${this.sourceSection === sec ? 'active' : ''}`
        }));
    }

    get selectedStatus() {
        if (this.isSummaryView) {
            return {
                selectedCount: this.sourceTotalCount,
                message: `Whole School Promotion Active (${this.sourceSummary.length} Classes)`
            };
        }
        return {
            selectedCount: this.students.filter(s => s.selected).length,
            message: ''
        };
    }

    get selectedCount() {
        return this.selectedStatus.selectedCount;
    }

    get selectedStudents() {
        return this.students.filter(s => s.selected);
    }

    get targetClassDisplay() {
        if (this.isSummaryView) return 'Next Sequential Class';
        return this.targetClass || '—';
    }

    get sourceYearLabel() {
        const match = this.academicYearOptions.find(opt => opt.value === this.sourceYear);
        return match ? match.label : 'Current Year';
    }

    get targetYearLabel() {
        const match = this.academicYearOptions.find(opt => opt.value === this.targetYear);
        return match ? match.label : 'Next Year';
    }

    get totalPreviousBalance() {
        return this.selectedStudents.reduce((sum, s) => sum + (parseFloat(s.pendingBalance) || 0), 0);
    }

    get totalPreviousBalanceFormatted() {
        return `₹${this.totalPreviousBalance.toLocaleString('en-IN')}`;
    }

    get fromCardClass() {
        let hasData = false;
        if (this.isSummaryView) hasData = this.sourceSummaryMapped.length > 0;
        else if (this.sourceClass) hasData = this.students.length > 0;

        return `promo-card card-from ${hasData ? 'active' : ''} glass-pane`;
    }

    get toCardClass() {
        let hasData = false;
        if (this.isSummaryView) hasData = this.targetSummaryMapped.length > 0;
        else if (this.sourceClass) hasData = this.selectedCount > 0;

        return `promo-card card-to ${hasData ? 'active' : ''} glass-pane`;
    }

    get transferZoneClass() {
        const animating = this.isSummaryView ? (this.sourceSummaryMapped.length > 0 && this.targetSummaryMapped.length > 0) : this.selectedCount > 0;
        return `transfer-zone ${animating ? 'animating' : ''}`;
    }

    get isPromoteDisabled() {
        if (this.isLoading) return true;
        // If in summary mode, enable if we have any batches to promote
        if (this.isSummaryView) return this.sourceSummary.length === 0;
        return this.selectedCount === 0 || !this.targetYear || !this.targetClass;
    }
    get promoteButtonLabel() {
        if (this.isLoading) return 'Processing...';
        if (this.isSummaryView) {
            return this.sourceSummary.length > 0 ? `Promote All Batches (${this.sourceTotalCount})` : 'Select a Class to Promote';
        }
        return this.selectedCount > 0 ? `Promote ${this.selectedCount} Students` : 'Select Students';
    }

    // New summary getters
    get filteredSourceSummary() {
        if (!this.sourceSection) return this.sourceSummary;
        return this.sourceSummary.filter(item => item.section === this.sourceSection);
    }

    get filteredTargetSummary() {
        if (!this.filteredSourceSummary || this.filteredSourceSummary.length === 0) return [];

        // Logical Projection: Instead of fetching unrelated next-year data,
        // we map the current visible source classes to their next classes.
        // This makes the "After Promotion" card a true preview.
        const projectionMap = new Map();

        this.filteredSourceSummary.forEach(source => {
            const nextClass = getNextClass(source.className);
            if (!nextClass) return;

            const key = `${nextClass}-${source.section}`;
            if (projectionMap.has(key)) {
                const existing = projectionMap.get(key);
                existing.studentCount += source.studentCount;
            } else {
                projectionMap.set(key, {
                    className: nextClass,
                    section: source.section,
                    studentCount: source.studentCount
                });
            }
        });

        return Array.from(projectionMap.values());
    }

    get sourceTotalCount() {
        if (!this.isSummaryView) return this.students.length;
        // Only count students in promotable classes for the total candidate pool
        return this.filteredSourceSummary.reduce((sum, item) => {
            const isPromotable = !!getNextClass(item.className);
            return sum + (isPromotable ? item.studentCount : 0);
        }, 0);
    }

    get targetTotalCount() {
        return this.selectedCount;
    }

    get sourceSummaryMapped() {
        return this.filteredSourceSummary.map(item => {
            const key = `${item.className}-${item.section}`;
            const isPromotable = !!getNextClass(item.className);
            return {
                ...item,
                id: key,
                isPromotable: isPromotable,
                statusLabel: isPromotable ? `${item.studentCount} students` : 'Graduating (Complete)',
                avatarClass: `avatar ${isPromotable ? 'bg-grad-' + (Math.floor(Math.random() * 4) + 1) : 'graduating-avatar'}`,
                avatar: item.className.substring(0, 2).toUpperCase(),
                rowClass: `class-row summary-row clickable animate-fade-in ${isPromotable ? '' : 'non-promotable'}`
            };
        });
    }

    get targetSummaryMapped() {
        return this.filteredTargetSummary.map(item => {
            const key = `${item.className}-${item.section}`;
            return {
                ...item,
                id: key,
                avatarClass: `avatar bg-grad-${Math.floor(Math.random() * 4) + 1}`,
                avatar: item.className.substring(0, 2).toUpperCase(),
                rowClass: `class-row summary-row clickable animate-fade-in`
            };
        });
    }

    // HANDLERS
    handleTargetChange(event) {
        this.targetYear = event.target.value;
        this.refreshData();
    }

    handleFilterChange(event) {
        const name = event.target.dataset.name;
        const val = event.target.value;
        if (name === 'sourceYear') {
            this.sourceYear = val;
            this.syncTargetYear();
        }
        if (name === 'targetYear') this.targetYear = val;
        if (name === 'sourceClass') {
            this.sourceClass = val;
            if (val === 'ALL') {
                this.isDrilldown = false; // Reset to summary view for All Classes
                this.targetClass = '';
            } else if (val) {
                this.targetClass = getNextClass(val);
            } else {
                this.targetClass = '';
            }
        }

        this.refreshData();
    }

    refreshData() {
        // Step 1: No auto-loading. Exit if required filters are missing
        if (!this.sourceYear || !this.sourceClass) {
            this.students = [];
            this.sourceSummary = [];
            this.targetSummary = [];
            return;
        }

        if (this.isSummaryView) {
            this.fetchSummary();
        } else {
            this.fetchStudents();
        }
    }

    async fetchSummary() {
        if (!this.sourceYear) return;
        this.isLoading = true;
        try {
            const [sourceData, targetData] = await Promise.all([
                getClassSummaryData({ academicYearId: this.sourceYear }),
                getClassSummaryData({ academicYearId: this.targetYear })
            ]);

            this.sourceSummary = sourceData;
            this.targetSummary = targetData;
            this._isBacking = false;
        } catch (error) {
            this.showToast('Error fetching summary', error.body?.message || error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleSummaryClick(event) {
        const className = event.currentTarget.dataset.class;
        const section = event.currentTarget.dataset.section;

        // Prevent drilldown for non-promotable classes
        if (!getNextClass(className)) {
            this.showToast('Graduating Class', `${className} students are completing their term and cannot be promoted further.`, 'info');
            return;
        }

        // Drill down: set specific class and section
        this.sourceClass = className;
        this.sourceSection = section;
        this.targetClass = getNextClass(className); // Sync target class for product fetching
        this.isDrilldown = true;

        // Fetch students for this newly selected specific class/section
        this.fetchStudents();
    }

    handleBackToClasses() {
        this._isBacking = true; // Guard against immediate auto-drilldown
        this.sourceClass = 'ALL';
        this.sourceSection = '';
        this.isDrilldown = false;
        this.students = [];
        this.fetchSummary();
    }

    handleSectionToggle(event) {
        const val = event.target.dataset.value;
        this.sourceSection = (this.sourceSection === val) ? '' : val;
        if (this.sourceYear && this.sourceClass && !this.isSummaryView) {
            this.fetchStudents();
        }
    }

    handleCheckboxStopPropagation(event) {
        event.stopPropagation();
    }

    handleStudentRowClick(event) {
        const id = event.currentTarget.dataset.id;
        this.toggleStudentSelection(id);
    }

    handleCheckboxChange(event) {
        const id = event.target.dataset.id;
        this.toggleStudentSelection(id);
    }

    toggleStudentSelection(id) {
        this.students = this.students.map(s => {
            if (s.id === id) {
                const newSelected = !s.selected;
                return {
                    ...s,
                    selected: newSelected,
                    itemRowClass: `class-row ${newSelected ? 'selected' : ''}`
                };
            }
            return s;
        });
    }

    handleSelectAll() {
        this.students = this.students.map(s => ({
            ...s,
            selected: true,
            itemRowClass: 'class-row selected'
        }));
    }

    handleClearSelection() {
        this.students = this.students.map(s => ({
            ...s,
            selected: false,
            itemRowClass: 'class-row'
        }));
    }

    async fetchStudents() {
        if (this.isSummaryView) return;
        this.isLoading = true;
        try {
            const results = await getStudentsForPromotion({
                academicYear: this.sourceYear,
                className: this.sourceClass,
                sectionName: this.sourceSection
            });

            this.students = results.map(s => {
                const gradClass = `avatar bg-grad-${Math.floor(Math.random() * 4) + 1}`;
                return {
                    id: s.id,
                    name: s.name,
                    studentId: s.studentId,
                    avatar: s.avatar,
                    pendingBalance: s.pendingBalance,
                    formattedBalance: s.pendingBalance > 0 ? `₹${s.pendingBalance.toLocaleString('en-IN')}` : 'Clear',
                    selected: true,
                    itemRowClass: 'class-row selected',
                    avatarClass: gradClass
                };
            });
        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // Custom Success Modal
    @track showSuccessModal = false;
    @track successMessage = '';

    closeSuccessModal() {
        this.showSuccessModal = false;
        this.resetPromotionState();
    }

    async handlePromote() {
        const targetYearName = this.targetYearLabel;
        let count = 0;
        let message = '';

        if (this.isSummaryView) {
            count = this.sourceTotalCount;
            message = `PROMOTING ALL CLASSES: This will process ${count} students across ${this.sourceSummary.length} class batches for ${targetYearName}. Proceed?`;
        } else {
            count = this.selectedCount;
            message = `Promote ${count} students to ${this.targetClass} for ${targetYearName}?`;
        }

        const confirmed = await LightningConfirm.open({
            message: message,
            variant: 'header',
            label: 'Global Bulk Promotion',
            theme: 'success'
        });

        if (!confirmed) return;

        this.isLoading = true;
        try {
            if (this.isSummaryView) {
                // Batch the global promotion by class/section sequentially 
                // to avoid Apex 'Too many DML rows: 10001' governor limit
                const pairs = this.sourceSummary.map(item => ({
                    className: item.className,
                    section: item.section
                }));

                for (let i = 0; i < pairs.length; i++) {
                    const payloadChunk = {
                        sourceYearId: this.sourceYear,
                        targetYearId: this.targetYear,
                        classSectionPairs: [pairs[i]],
                        selectedPricebookEntryIds: this.selectedProductIds
                    };
                    console.log(`Sending promoteClasses payload chunk ${i + 1}/${pairs.length}:`, JSON.stringify(payloadChunk));
                    await promoteClasses(payloadChunk);
                }

                this.successMessage = `Successfully promoted ${count} students across ${this.sourceSummary.length} classes to ${targetYearName}.`;
            } else {
                const payload = {
                    studentIds: this.selectedStudents.map(s => s.id),
                    sourceAcademicYear: this.sourceYear,
                    targetAcademicYear: this.targetYear,
                    targetClassName: this.targetClass,
                    targetSectionName: this.targetSection || this.sourceSection,
                    selectedPricebookEntryIds: this.selectedProductIds
                };
                console.log('Sending promoteStudents payload:', JSON.stringify(payload));
                await promoteStudents(payload);
                this.successMessage = `Successfully promoted ${count} students to ${this.targetClass} for ${targetYearName}.`;
            }

            // Show Custom Modal instead of toast
            this.showSuccessModal = true;

        } catch (error) {
            console.error('Promotion failed:', error);
            this.showToast('Promotion Error', error.body?.message || error.message, 'error');
            this.resetPromotionState();
        } finally {
            this.isLoading = false;
        }
    }

    resetPromotionState() {
        this.students = [];
        this.selectedSummaryKeys = [];
        this.searchQuery = '';
        this.sourceClass = 'ALL'; // Keep in summary view so refresh works
        this.sourceSection = '';
        this.isDrilldown = false;
        this.fetchSummary(); // Force fresh summary fetch (not via refreshData which bails when sourceClass is blank)
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}