import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

import getAllStaff       from '@salesforce/apex/SchoolStaffController.getAllStaff';
import getPayrollRecords from '@salesforce/apex/SchoolStaffController.getPayrollRecords';
import upsertStaff       from '@salesforce/apex/SchoolStaffController.upsertStaff';
import deleteStaff       from '@salesforce/apex/SchoolStaffController.deleteStaff';
import paySalary         from '@salesforce/apex/SchoolStaffController.paySalary';
import processAllPayroll from '@salesforce/apex/SchoolStaffController.processAllPayroll';
import getPayslipData    from '@salesforce/apex/SchoolStaffController.getPayslipData';
import uploadStaffPhoto  from '@salesforce/apex/SchoolStaffController.uploadStaffPhoto';
import getStaffDetail    from '@salesforce/apex/SchoolStaffController.getStaffDetail';

// Subject/skill options (same as ClassManagement)
import getAllSubjects        from '@salesforce/apex/ClassManagementController.getAllSubjects';
import getSkillLevelOptions from '@salesforce/apex/ClassManagementController.getSkillLevelOptions';

const DAY_ORDER = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };
const TODAY_DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

export default class SchoolStaff extends LightningElement {

    @track activeTab            = 'all';
    @track searchTerm           = '';
    @track deptFilter           = '';
    @track statusFilter         = '';
    @track showStaffModal       = false;
    @track showDetailModal      = false;
    @track showPayslipModal     = false;
    @track isEditMode           = false;
    @track selectedStaff        = {};
    @track selectedPayslip      = null;
    @track selectedPayrollMonth = 'Mar 2026';
    @track showToast            = false;
    @track toastMessage         = '';
    @track toastIcon            = '✅';
    @track toastClass           = 'ss-toast toast-success';
    @track isLoading            = false;
    @track formData             = this._emptyForm();

    // Photo state
    @track photoPreview         = null;
    @track photoBase64          = null;
    @track photoFileName        = null;

    // Subject Skills in form
    @track formSkills           = [];
    @track allSubjectOptions    = [];
    @track skillLevelOptions    = [];

    // Detail modal extra data
    @track detailLoading        = false;
    @track detailSkills         = [];
    @track detailInvoices       = [];
    @track detailPeriods        = [];
    @track detailTodayPeriods   = [];
    @track detailWeeklyCount    = 0;
    @track detailShowAllPeriods = false;
    @track detailCases          = [];
    @track detailCaseFilter     = 'all';

    _rawStaffList   = [];
    _rawPayrollList = [];

    async fetchStaff() {
        try {
            const data = await getAllStaff();
            if (data) {
                this._rawStaffList = data.map((s, i) => this._decorate(s, i));
            }
        } catch (error) {
            this._showPlatformToast('error', 'Error', error.body?.message || 'Failed to load staff.');
        }
    }

    connectedCallback() {
        this.fetchStaff();
        this._loadSubjectOptions();
        this._loadSkillLevelOptions();
    }

    async _loadSubjectOptions() {
        try {
            const subs = await getAllSubjects();
            this.allSubjectOptions = (subs || []).map(s => ({ label: s.Name, value: s.Id }));
        } catch (e) { this.allSubjectOptions = []; }
    }

    async _loadSkillLevelOptions() {
        try {
            const levels = await getSkillLevelOptions();
            this.skillLevelOptions = (levels || []).map(l => ({ label: l.label, value: l.value }));
        } catch (e) {
            this.skillLevelOptions = [
                { label: 'Beginner',     value: 'Beginner' },
                { label: 'Intermediate', value: 'Intermediate' },
                { label: 'Advanced',     value: 'Advanced' },
                { label: 'Expert',       value: 'Expert' }
            ];
        }
    }

    async _loadPayroll() {
        try {
            this.isLoading = true;
            const data = await getPayrollRecords({ invoiceMonth: this.selectedPayrollMonth });
            this._rawPayrollList = (data || []).map(r => this._decoratePayroll(r));
        } catch (err) {
            this._showToastMsg('❌', err.body?.message || 'Failed to load payroll.', 'error');
        } finally { this.isLoading = false; }
    }

    /* ── TAB & MONTH CHANGE ── */
    handleTabChange(e) {
        this.activeTab = e.currentTarget.dataset.tab;
        if (this.activeTab === 'salary') this._loadPayroll();
    }
    handleMonthChange(e) {
        this.selectedPayrollMonth = e.target.value;
        this._loadPayroll();
    }

    /* ── GETTERS: TABS ── */
    get allTabClass()         { return `tab ${this.activeTab === 'all'          ? 'active' : ''}`; }
    get teachingTabClass()    { return `tab ${this.activeTab === 'teaching'     ? 'active' : ''}`; }
    get nonTeachingTabClass() { return `tab ${this.activeTab === 'non-teaching' ? 'active' : ''}`; }
    get salaryTabClass()      { return `tab ${this.activeTab === 'salary'       ? 'active' : ''}`; }
    get isStaffListView()     { return this.activeTab !== 'salary'; }
    get isSalaryView()        { return this.activeTab === 'salary'; }
    get isTeachingType()      { return this.formData.staffType === 'Teaching'; }
    get teachingToggleClass()    { return `ss-toggle-btn ${this.formData.staffType === 'Teaching'     ? 'ss-toggle-active' : ''}`; }
    get nonTeachingToggleClass() { return `ss-toggle-btn ${this.formData.staffType === 'Non-Teaching' ? 'ss-toggle-active' : ''}`; }
    get modalTitle()      { return this.isEditMode ? 'Edit Staff Member' : 'Add New Staff Member'; }
    get saveButtonLabel() { return this.isEditMode ? '💾 Update Staff' : '✅ Save Staff'; }
    get hasPhotoPreview() { return !!this.photoPreview; }

    /* ── GETTERS: SUBJECT SKILLS FORM ── */
    get hasFormSkills()  { return this.formSkills.length > 0; }
    get formSkillsList() {
        return this.formSkills.map(sk => ({
            ...sk,
            subjectOptions:    this.allSubjectOptions,
            skillLevelOptions: this.skillLevelOptions
        }));
    }

    /* ── GETTERS: DETAIL MODAL ── */
    get hasDetailSkills()   { return this.detailSkills.length > 0; }
    get hasDetailInvoices() { return this.detailInvoices.length > 0; }
    get hasDetailCases()    { return this.detailCases.length > 0; }

    get filteredDetailCases() {
        if (this.detailCaseFilter === 'all') return this.detailCases;
        return this.detailCases.filter(c => c.type === this.detailCaseFilter);
    }
    get hasFilteredDetailCases() { return this.filteredDetailCases.length > 0; }

    get caseFilterAllClass()       { return `dc-filter-btn${this.detailCaseFilter === 'all'       ? ' dc-filter-active' : ''}`; }
    get caseFilterComplaintClass() { return `dc-filter-btn${this.detailCaseFilter === 'Complaint' ? ' dc-filter-active' : ''}`; }
    get caseFilterPraiseClass()    { return `dc-filter-btn${this.detailCaseFilter === 'Praise'    ? ' dc-filter-active' : ''}`; }

    get detailCaseCounts() {
        const all        = this.detailCases.length;
        const complaints = this.detailCases.filter(c => c.type === 'Complaint').length;
        const praises    = this.detailCases.filter(c => c.type === 'Praise').length;
        return { all, complaints, praises };
    }
    get hasDetailPeriods()  { return this.detailTodayPeriods.length > 0; }
    get detailTodayLabel()  { return TODAY_DAY; }
    get detailPeriodsLabel(){ return `Today (${TODAY_DAY})`; }
    get detailShowToggle()  { return this.detailPeriods.length > this.detailTodayPeriods.length; }
    get detailPeriodRows()  {
        if (this.detailShowAllPeriods) {
            const dayMap = {};
            this.detailPeriods.forEach(p => {
                if (!dayMap[p.day]) dayMap[p.day] = [];
                dayMap[p.day].push(p);
            });
            return Object.keys(dayMap)
                .sort((a,b) => (DAY_ORDER[a]||99) - (DAY_ORDER[b]||99))
                .map(day => ({ day, periods: dayMap[day].sort((a,b) => a.periodNumber - b.periodNumber) }));
        }
        if (this.detailTodayPeriods.length === 0) return [];
        return [{ day: TODAY_DAY, periods: this.detailTodayPeriods }];
    }

    /* ── GETTERS: STATS ── */
    get totalStaffCount()  { return this._rawStaffList.length; }
    get teachingCount()    { return this._rawStaffList.filter(s => s.StaffType === 'Teaching').length; }
    get nonTeachingCount() { return this._rawStaffList.filter(s => s.StaffType === 'Non-Teaching').length; }
    get paidCount()        { return this._rawPayrollList.filter(r => r.salaryStatus === 'Paid').length; }
    get pendingCount()     { return this._rawPayrollList.filter(r => r.salaryStatus !== 'Paid').length; }
    get totalMonthlySalary() {
        const t = this._rawStaffList.reduce((s, m) => s + Number(m.BasicSalary) + Number(m.Hra) + Number(m.Da) - Number(m.Pf), 0);
        return t >= 100000 ? `\u20B9${(t/100000).toFixed(1)}L` : `\u20B9${t.toLocaleString('en-IN')}`;
    }
    get totalAnnualSalary() {
        const t = this._rawStaffList.reduce((s, m) => s + Number(m.BasicSalary) + Number(m.Hra) + Number(m.Da) - Number(m.Pf), 0) * 12;
        return t >= 100000 ? `\u20B9${(t/100000).toFixed(1)}L` : `\u20B9${t.toLocaleString('en-IN')}`;
    }
    get totalAllowances() {
        const v = n => { const x = Number(n); return isNaN(x) ? 0 : x; };
        return (v(this.formData.hra) + v(this.formData.da)).toLocaleString('en-IN');
    }
    get computedNetSalary() {
        const v = n => { const x = Number(n); return isNaN(x) ? 0 : x; };
        return (v(this.formData.basicSalary) + v(this.formData.hra) + v(this.formData.da) - v(this.formData.pf)).toLocaleString('en-IN');
    }

    /* ── GETTERS: FILTERED STAFF ── */
    get filteredStaff() {
        let list = this._rawStaffList.map(s => ({
            ...s,
            netSalaryFmt: `\u20B9${(Number(s.BasicSalary)+Number(s.Hra)+Number(s.Da)-Number(s.Pf)).toLocaleString('en-IN')}`
        }));
        if (this.activeTab === 'teaching')     list = list.filter(s => s.StaffType === 'Teaching');
        if (this.activeTab === 'non-teaching') list = list.filter(s => s.StaffType === 'Non-Teaching');
        if (this.searchTerm) {
            const t = this.searchTerm.toLowerCase();
            list = list.filter(s =>
                s.Name.toLowerCase().includes(t) ||
                (s.EmployeeId  && s.EmployeeId.toLowerCase().includes(t))  ||
                (s.Subject     && s.Subject.toLowerCase().includes(t))     ||
                (s.Designation && s.Designation.toLowerCase().includes(t))
            );
        }
        if (this.deptFilter)   list = list.filter(s => s.Department === this.deptFilter);
        if (this.statusFilter) list = list.filter(s => s.Status     === this.statusFilter);
        return list;
    }
    get hasFilteredStaff() { return this.filteredStaff.length > 0; }
    get salaryRecords()    { return this._rawPayrollList; }

    /* ── GETTERS: PAYSLIP ── */
    get payslipStaffName()  { return this.selectedPayslip?.staffName    || ''; }
    get payslipEmpId()      { return this.selectedPayslip?.employeeId   || ''; }
    get payslipMonth()      { return this.selectedPayslip?.invoiceMonth || this.selectedPayrollMonth; }
    get payslipDesig()      { return this.selectedPayslip?.designation  || ''; }
    get payslipStaffType()  { return this.selectedPayslip?.staffType    || ''; }
    get payslipBasic()      { return this._fmt(this.selectedPayslip?.basicSalary); }
    get payslipHra()        { return this._fmt(this.selectedPayslip?.hra); }
    get payslipDa()         { return this._fmt(this.selectedPayslip?.da); }
    get payslipAllowances() { return this._fmt(this.selectedPayslip?.allowances); }
    get payslipPf()         { return this._fmt(this.selectedPayslip?.pf); }
    get payslipDeductions() { return this._fmt(this.selectedPayslip?.deductions); }
    get payslipNet()        { return this._fmt(this.selectedPayslip?.netSalary); }
    get payslipInvId()      { return this.selectedPayslip?.invoiceId || '\u2014'; }
    get payslipPaidDate()   { return this.selectedPayslip?.paidDate  || '\u2014'; }
    get payslipAvatarClass(){ return 'ss-avatar av-blue'; }
    get payslipInitials() {
        const p = (this.selectedPayslip?.staffName || '').split(' ');
        return ((p[0]?.charAt(0)||'') + (p[1]?.charAt(0)||'')).toUpperCase();
    }
    _fmt(val) { return `\u20B9${(Number(val)||0).toLocaleString('en-IN')}`; }

    /* ── HANDLERS: FILTERS ── */
    handleSearchChange(e) { this.searchTerm   = e.target.value; }
    handleDeptFilter(e)   { this.deptFilter   = e.target.value; }
    handleStatusFilter(e) { this.statusFilter = e.target.value; }

    /* ── HANDLERS: STAFF CRUD ── */
    handleAddStaff() {
        this.isEditMode    = false;
        this.formData      = { ...this._emptyForm() };
        this.formSkills    = [];
        this.photoPreview  = null;
        this.photoBase64   = null;
        this.photoFileName = null;
        this.showStaffModal = true;
    }

    /* ── STAFF CARD CLICK — open detail modal + load extra data ── */
    async handleStaffCardClick(e) {
        const r = this._rawStaffList.find(x => x.id === e.currentTarget.dataset.id);
        if (!r) return;
        
        this.selectedStaff        = { ...r };
        this.detailSkills         = [];
        this.detailInvoices       = [];
        this.detailPeriods        = [];
        this.detailTodayPeriods   = [];
        this.detailWeeklyCount    = 0;
        this.detailShowAllPeriods = false;
        this.detailCases          = [];
        this.detailCaseFilter     = 'all';
        this.showDetailModal      = true;
        this.detailLoading        = true;

        try {
            console.log('📡 Fetching staff detail for ID:', r.id);
            const detail = await getStaffDetail({ staffId: r.id });
            console.log('✅ Detail received:', detail);

            // Skills
            if (detail.skills && Array.isArray(detail.skills)) {
                this.detailSkills = detail.skills.map(sk => ({
                    ...sk,
                    levelClass: this._skillLevelClass(sk.skillLevel),
                    expLabel:   sk.yearsOfExperience ? `${sk.yearsOfExperience} yrs` : ''
                }));
                console.log('✅ Skills loaded:', this.detailSkills.length);
            }

            // Invoices
            if (detail.invoices && Array.isArray(detail.invoices)) {
                this.detailInvoices = detail.invoices.map(inv => ({
                    ...inv,
                    amountFmt:   `\u20B9${(Number(inv.amount)||0).toLocaleString('en-IN')}`,
                    statusClass: inv.status === 'Paid' ? 'di-badge di-paid' : 'di-badge di-pending'
                }));
                console.log('✅ Invoices loaded:', this.detailInvoices.length);
            }

            // Periods
            if (detail.periods && Array.isArray(detail.periods)) {
                const allPeriods = detail.periods.map(p => ({
                    ...p,
                    periodNumber: parseInt(p.periodNumber) || 0
                }));
                this.detailPeriods      = allPeriods;
                this.detailTodayPeriods = allPeriods.filter(p => p.day === TODAY_DAY)
                    .sort((a,b) => a.periodNumber - b.periodNumber);
                this.detailWeeklyCount  = allPeriods.length;
                console.log('✅ Periods loaded:', this.detailPeriods.length);
            }

            // Cases
            if (detail.cases && Array.isArray(detail.cases)) {
                this.detailCases = detail.cases.map(c => ({
                    ...c,
                    isPraise:    c.type === 'Praise',
                    isComplaint: c.type === 'Complaint',
                    typeClass:   c.type === 'Praise'
                                 ? 'dc-type-badge dc-type-praise'
                                 : 'dc-type-badge dc-type-complaint',
                    statusClass:   this._caseStatusClass(c.status),
                    priorityClass: this._casePriorityClass(c.priority),
                    typeIcon:   c.type === 'Praise' ? '🌟' : '⚠️',
                    hasStudent: !!c.studentName,
                    hasClass:   !!c.className,
                    shortDesc:  c.description
                                 ? (c.description.length > 100
                                    ? c.description.substring(0, 100) + '…'
                                    : c.description)
                                 : ''
                }));
                console.log('✅ Cases loaded:', this.detailCases.length);
            }

        } catch (err) {
            console.error('❌ Error loading staff detail:', err);
            this._showToastMsg('❌', err.body?.message || 'Failed to load staff details', 'error');
        } finally {
            this.detailLoading = false;
        }
    }

    handleToggleAllPeriods() {
        this.detailShowAllPeriods = !this.detailShowAllPeriods;
    }

    handleCaseFilterChange(e) {
        this.detailCaseFilter = e.currentTarget.dataset.filter;
    }

    _caseStatusClass(status) {
        const map = {
            'New':       'dc-status-badge dc-status-new',
            'Open':      'dc-status-badge dc-status-open',
            'Working':   'dc-status-badge dc-status-working',
            'Escalated': 'dc-status-badge dc-status-escalated',
            'Closed':    'dc-status-badge dc-status-closed'
        };
        return map[status] || 'dc-status-badge dc-status-open';
    }

    _casePriorityClass(priority) {
        const map = {
            'High':   'dc-priority dc-priority-high',
            'Medium': 'dc-priority dc-priority-medium',
            'Low':    'dc-priority dc-priority-low'
        };
        return map[priority] || 'dc-priority dc-priority-low';
    }

    get togglePeriodsLabel() {
        return this.detailShowAllPeriods ? '▲ Show Today Only' : '▼ Show All Days';
    }

    _skillLevelClass(level) {
        const map = {
            'Expert':       'dd-skill-level-chip skill-level-expert',
            'Advanced':     'dd-skill-level-chip skill-level-advanced',
            'Intermediate': 'dd-skill-level-chip skill-level-intermediate',
            'Beginner':     'dd-skill-level-chip skill-level-beginner',
        };
        return map[level] || 'dd-skill-level-chip skill-level-beginner';
    }

    handleEditFromDetail() {
        const r = this.selectedStaff;
        this.formData = {
            id:r.id, employeeId:r.EmployeeId, firstName:r.FirstName, lastName:r.LastName,
            gender:r.Gender, dob:r.Dob, email:r.Email, phone:r.Phone, address:r.Address,
            designation:r.Designation, department:r.Department, staffType:r.StaffType,
            subject:r.Subject, qualification:r.Qualification, joiningDate:r.JoiningDate,
            status:r.Status, basicSalary:r.BasicSalary, hra:r.Hra, da:r.Da, pf:r.Pf,
            accountNumber:r.AccountNumber, ifsc:r.Ifsc
        };
        let counter = 1;
        this.formSkills = (this.detailSkills.length > 0 ? this.detailSkills : (r.SubjectSkills || [])).map(sk => ({
            id:                counter++,
            subjectId:         sk.subjectId   || '',
            subjectName:       sk.subjectName || '',
            skillLevel:        sk.skillLevel  || '',
            yearsOfExperience: sk.yearsOfExperience || 0
        }));
        this.photoPreview  = r.PhotoUrl || null;
        this.photoBase64   = null;
        this.photoFileName = null;
        this.isEditMode      = true;
        this.showDetailModal = false;
        this.showStaffModal  = true;
    }

    async handleDeleteStaff() {
        try {
            this.isLoading = true;
            await deleteStaff({ staffId: this.selectedStaff.id });
            this.fetchStaff();
            this.showDetailModal = false;
            this._showToastMsg('✅', `${this.selectedStaff.name} removed successfully.`, 'success');
        } catch (err) {
            this._showToastMsg('❌', err.body?.message || 'Delete failed.', 'error');
        } finally { this.isLoading = false; }
    }

    handleCloseModal()          { this.showStaffModal  = false; }
    handleCloseDetail()         { this.showDetailModal = false; }
    handleClosePayslip()        { this.showPayslipModal = false; this.selectedPayslip = null; }
    handlePayslipOverlayClick() { this.showPayslipModal = false; this.selectedPayslip = null; }
    handleModalOverlayClick()   { this.showStaffModal   = false; }
    stopPropagation(e)          { e.stopPropagation(); }

    handleStaffTypeChange(e) {
        e.stopPropagation();
        this.formData = { ...this.formData, staffType:e.currentTarget.dataset.type, designation:'', department:'' };
    }
    handleFormInput(e) {
        const field = e.currentTarget.dataset.field || e.target.dataset.field;
        if (field) this.formData = { ...this.formData, [field]: e.target.value };
    }

    /* ── SUBJECT SKILLS FORM HANDLERS ── */
    handleAddSkill() {
        this.formSkills = [
            ...this.formSkills,
            { id: Date.now(), subjectId: '', subjectName: '', skillLevel: '', yearsOfExperience: 0 }
        ];
    }

    handleRemoveSkill(e) {
        const id = parseInt(e.currentTarget.dataset.skillId);
        this.formSkills = this.formSkills.filter(s => s.id !== id);
    }

    handleSkillSubjectChange(e) {
        const id    = parseInt(e.currentTarget.dataset.skillId);
        const value = e.detail ? e.detail.value : e.target.value;
        const found = this.allSubjectOptions.find(o => o.value === value);
        this.formSkills = this.formSkills.map(s =>
            s.id === id ? { ...s, subjectId: value, subjectName: found ? found.label : '' } : s
        );
    }

    handleSkillLevelChange(e) {
        const id    = parseInt(e.currentTarget.dataset.skillId);
        const value = e.detail ? e.detail.value : e.target.value;
        this.formSkills = this.formSkills.map(s =>
            s.id === id ? { ...s, skillLevel: value } : s
        );
    }

    handleSkillExperienceChange(e) {
        const id    = parseInt(e.currentTarget.dataset.skillId);
        const value = parseFloat(e.target.value) || 0;
        this.formSkills = this.formSkills.map(s =>
            s.id === id ? { ...s, yearsOfExperience: value } : s
        );
    }

    /* ── PHOTO HANDLERS ── */
    handlePhotoChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            this._showToastMsg('⚠️', 'Please select an image file (JPG, PNG, etc.)', 'warning'); return;
        }
        if (file.size > 2 * 1024 * 1024) {
            this._showToastMsg('⚠️', 'Image size must be under 2MB.', 'warning'); return;
        }
        this.photoFileName = file.name;
        const reader = new FileReader();
        reader.onload = (evt) => {
            this.photoPreview = evt.target.result;
            this.photoBase64  = evt.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }

    handleRemovePhoto() {
        this.photoPreview  = null;
        this.photoBase64   = null;
        this.photoFileName = null;
        const inp = this.template.querySelector('.ss-photo-input');
        if (inp) inp.value = '';
    }

    /* ── SAVE STAFF ── */
    async handleSaveStaff() {
        const live = { ...this.formData };
        this.template.querySelectorAll('[data-field]').forEach(el => {
            if (el.dataset.field && el.value !== undefined && !el.readOnly) live[el.dataset.field] = el.value;
        });
        this.formData = { ...live };

        const { firstName, lastName, email, phone, basicSalary } = this.formData;
        if (!firstName?.trim())                   { this._showToastMsg('⚠️','First Name is required.','warning'); return; }
        if (!lastName?.trim())                    { this._showToastMsg('⚠️','Last Name is required.','warning');  return; }
        if (!email?.trim())                       { this._showToastMsg('⚠️','Email is required.','warning');       return; }
        if (!phone?.trim())                       { this._showToastMsg('⚠️','Phone is required.','warning');       return; }
        if (!basicSalary||Number(basicSalary)<=0) { this._showToastMsg('⚠️','Enter a valid basic salary.','warning'); return; }

        // Validate skills if teaching
        if (this.formData.staffType === 'Teaching' && this.formSkills.length > 0) {
            const incomplete = this.formSkills.find(s => !s.subjectId || !s.skillLevel);
            if (incomplete) { this._showToastMsg('⚠️', 'Complete all subject skill details.', 'warning'); return; }
        }

        const payload = {
            id:this.formData.id||null, EmployeeId:this.formData.employeeId||'',
            FirstName:(this.formData.firstName||'').trim(), LastName:(this.formData.lastName||'').trim(),
            Gender:this.formData.gender||'', Dob:this.formData.dob||'',
            Email:(this.formData.email||'').trim(), Phone:(this.formData.phone||'').trim(),
            Address:this.formData.address||'', StaffType:this.formData.staffType||'Teaching',
            Designation:this.formData.designation||'', Department:this.formData.department||'',
            Subject:this.formData.subject||'', Qualification:this.formData.qualification||'',
            JoiningDate:this.formData.joiningDate||'', Status:this.formData.status||'Active',
            BasicSalary:Number(this.formData.basicSalary)||0, Hra:Number(this.formData.hra)||0,
            Da:Number(this.formData.da)||0, Pf:Number(this.formData.pf)||0,
            AccountNumber:this.formData.accountNumber||'', Ifsc:this.formData.ifsc||''
        };

        try {
            this.isLoading = true;
            const staffId = await upsertStaff({
                jsonData:   JSON.stringify(payload),
                skillsJson: JSON.stringify(this.formSkills.map(s => ({
                    subjectId:         s.subjectId,
                    subjectName:       s.subjectName,
                    skillLevel:        s.skillLevel,
                    yearsOfExperience: s.yearsOfExperience || 0
                })))
            });
            if (this.photoBase64 && staffId) {
                try {
                    await uploadStaffPhoto({
                        staffId, base64Data: this.photoBase64,
                        fileName: this.photoFileName || 'staff_photo.jpg'
                    });
                } catch (photoErr) {
                    this._showToastMsg('⚠️', 'Staff saved but photo upload failed.', 'warning');
                }
            }
            this.fetchStaff();
            this.showStaffModal = false;
            const msg = this.isEditMode
                ? `${payload.FirstName} ${payload.LastName} updated successfully!`
                : `${payload.FirstName} ${payload.LastName} added to staff directory!`;
            this._showToastMsg('✅', msg, 'success');
        } catch (err) {
            this._showToastMsg('❌', err.body?.message||err.message||'Save failed.', 'error');
        } finally { this.isLoading = false; }
    }

    /* ── HANDLERS: PAYROLL ── */
    async handlePaySalary(e) {
        e.stopPropagation();
        const staffId = e.currentTarget.dataset.id;
        const rec = this._rawPayrollList.find(x => x.staffId === staffId);
        if (!rec) return;
        if (rec.salaryStatus === 'Paid') { await this._openPayslip(rec); return; }
        try {
            this.isLoading = true;
            await paySalary({ staffId, invoiceMonth: this.selectedPayrollMonth });
            await this._loadPayroll();
            this._showToastMsg('💳', `Salary of ${this._fmt(rec.rawNet)} paid to ${rec.staffName}!`, 'success');
        } catch (err) {
            this._showToastMsg('❌', err.body?.message || 'Payment failed.', 'error');
        } finally { this.isLoading = false; }
    }

    async handleProcessPayroll() {
        try {
            this.isLoading = true;
            await processAllPayroll({ invoiceMonth: this.selectedPayrollMonth });
            await this._loadPayroll();
            this._showToastMsg('⚡', `All salaries processed for ${this.selectedPayrollMonth}!`, 'success');
        } catch (err) {
            this._showToastMsg('❌', err.body?.message || 'Payroll processing failed.', 'error');
        } finally { this.isLoading = false; }
    }

    async handleGeneratePayslips() {
        const paid = this._rawPayrollList.filter(r => r.salaryStatus === 'Paid');
        if (paid.length === 0) { this._showToastMsg('⚠️','No paid salaries for this month.','warning'); return; }
        await this._openPayslip(paid[0]);
        this._showToastMsg('📄', `${paid.length} payslip(s) ready for ${this.selectedPayrollMonth}.`, 'success');
    }

    handleExportStaff() { this._showToastMsg('📤', 'Staff data exported successfully!', 'success'); }

    /* ── PRINT PAYSLIP ── */
    handlePrintPayslip() {
        const ps = this.selectedPayslip;
        if (!ps) return;
        const fmt = val => `\u20B9${(Number(val)||0).toLocaleString('en-IN')}`;
        const p   = (ps.staffName||'').split(' ');
        const ini = ((p[0]?.charAt(0)||'')+(p[1]?.charAt(0)||'')).toUpperCase();
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Payslip - ${ps.staffName} - ${ps.invoiceMonth}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#0f172a}
.wrap{max-width:700px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
.hdr{background:linear-gradient(135deg,#0F172A,#1E3FCC);padding:22px 28px;display:flex;align-items:center;gap:16px;color:#fff;flex-wrap:wrap}
.logo{width:52px;height:52px;background:rgba(255,255,255,.15);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px}
.sn{font-size:20px;font-weight:800}.ss{font-size:12px;opacity:.75;margin-top:2px}
.ib{margin-left:auto;text-align:right}.il{font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:1px}.iv{font-size:13px;font-weight:700;font-family:monospace}
.er{display:flex;align-items:center;gap:18px;padding:22px 28px;border-bottom:1px solid #e2e8f0;flex-wrap:wrap}
.av{width:60px;height:60px;background:linear-gradient(135deg,#2E5BFF,#1E3FCC);border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:22px}
.en{font-size:20px;font-weight:800;margin-bottom:3px}.ed{font-size:13px;color:#64748b;margin-bottom:8px}
.bg{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;display:inline-block;margin-right:6px}
.bi{background:#e8eeff;color:#2e5bff}.bt{background:#e6faf5;color:#00c48c}
.mb{margin-left:auto;background:#e8eeff;padding:12px 18px;border-radius:12px;text-align:right}
.ml{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#2e5bff}
.mv{font-size:17px;font-weight:800;color:#2e5bff;margin:2px 0}.mp{font-size:11px;color:#94a3b8}
.bd{display:grid;grid-template-columns:1fr 1fr}
.sc{padding:20px 28px;background:#fff}.sc:first-child{border-right:1px solid #e2e8f0}
.sh{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:7px 12px;border-radius:8px;display:flex;align-items:center;gap:7px;margin-bottom:14px}
.eh{background:#e6faf5;color:#059669}.dh{background:#ffe8ec;color:#ff647c}
.rw{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #f1f5f9;font-size:13px}
.rw:last-of-type{border-bottom:none}.rw span{color:#64748b}.rw strong{font-weight:700}
.st{display:flex;justify-content:space-between;padding:10px 12px;border-radius:8px;margin-top:12px;font-size:13px;font-weight:700}
.et{background:#e6faf5;color:#059669}.dt{background:#ffe8ec;color:#ff647c}
.nb{background:linear-gradient(135deg,#2E5BFF,#8B5CF6);padding:24px 28px;text-align:center;color:#fff}
.nl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.85}
.na{font-size:42px;font-weight:900;letter-spacing:-1px;margin:6px 0 4px}.nn{font-size:12px;opacity:.75}
.fn{padding:14px 28px;font-size:11px;color:#94a3b8;text-align:center;font-style:italic;background:#f8fafc;border-top:1px solid #e2e8f0}
@media print{body{background:#fff}.wrap{box-shadow:none;margin:0;border-radius:0}}
</style></head><body>
<div class="wrap">
<div class="hdr"><div class="logo">🏫</div><div><div class="sn">EduTrack School</div><div class="ss">Official Salary Payslip · ${ps.invoiceMonth||''}</div></div>
<div class="ib"><div class="il">Invoice ID</div><div class="iv">${ps.invoiceId||'—'}</div></div></div>
<div class="er"><div class="av">${ini}</div><div><div class="en">${ps.staffName||''}</div><div class="ed">${ps.designation||''}</div>
<span class="bg bi">${ps.employeeId||''}</span><span class="bg bt">${ps.staffType||''}</span></div>
<div class="mb"><div class="ml">Pay Period</div><div class="mv">${ps.invoiceMonth||''}</div><div class="mp">Paid on ${ps.paidDate||'—'}</div></div></div>
<div class="bd">
<div class="sc"><div class="sh eh">💚 Earnings</div>
<div class="rw"><span>Basic Salary</span><strong>${fmt(ps.basicSalary)}</strong></div>
<div class="rw"><span>HRA</span><strong style="color:#00c48c">${fmt(ps.hra)}</strong></div>
<div class="rw"><span>DA</span><strong style="color:#00c48c">${fmt(ps.da)}</strong></div>
<div class="st et"><span>Total Earnings</span><strong>${fmt(ps.allowances)}</strong></div></div>
<div class="sc"><div class="sh dh">🔴 Deductions</div>
<div class="rw"><span>PF (Provident Fund)</span><strong style="color:#ff647c">−${fmt(ps.pf)}</strong></div>
<div class="st dt"><span>Total Deductions</span><strong>−${fmt(ps.deductions)}</strong></div></div>
</div>
<div class="nb"><div class="nl">💰 Net Salary Credited</div><div class="na">${fmt(ps.netSalary)}</div><div class="nn">Amount disbursed for ${ps.invoiceMonth||''}</div></div>
<div class="fn">This is a computer-generated payslip and does not require a physical signature. For queries contact the Finance Department.</div>
</div>
<script>window.onload=function(){window.print();}<\/script></body></html>`;
        const w = window.open('','_blank','width=780,height=700');
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
        else this._showToastMsg('⚠️','Pop-ups blocked. Please allow pop-ups.','warning');
    }

    async _openPayslip(rec) {
        try {
            this.isLoading = true;
            let ps = null;
            try { ps = await getPayslipData({ staffId: rec.staffId, invoiceMonth: rec.invoiceMonth || this.selectedPayrollMonth }); }
            catch (_) { ps = null; }
            this.selectedPayslip = ps || {
                staffName:rec.staffName, employeeId:rec.employeeId, designation:rec.designation,
                staffType:rec.staffType, invoiceMonth:rec.invoiceMonth||this.selectedPayrollMonth,
                invoiceId:rec.id||'\u2014', paidDate:rec.paidDate||new Date().toLocaleDateString('en-IN'),
                basicSalary:rec.rawBasic, hra:rec.rawHra, da:rec.rawDa, pf:rec.rawPf,
                allowances:rec.rawAllowances, deductions:rec.rawDeductions, netSalary:rec.rawNet
            };
            this.showPayslipModal = true;
        } finally { this.isLoading = false; }
    }

    /* ── HELPERS ── */
    _emptyForm() {
        return { id:null, employeeId:'', firstName:'', lastName:'', gender:'', dob:'', email:'', phone:'', address:'',
            designation:'', department:'', staffType:'Teaching', subject:'', qualification:'', joiningDate:'',
            status:'Active', basicSalary:0, hra:0, da:0, pf:0, accountNumber:'', ifsc:'' };
    }

    _colorVariants = [
        { av:'ss-avatar av-blue',   band:'scard-band band-blue'   },
        { av:'ss-avatar av-purple', band:'scard-band band-purple' },
        { av:'ss-avatar av-green',  band:'scard-band band-green'  },
        { av:'ss-avatar av-orange', band:'scard-band band-orange' }
    ];

    _decorate(s, idx) {
        const v   = this._colorVariants[(idx||0) % this._colorVariants.length];
        const isT = s.StaffType === 'Teaching';
        const sm  = ({
            'Active':   { badge:'badge-status badge-active',   dot:'ss-status-dot dot-active'   },
            'On Leave': { badge:'badge-status badge-pending',  dot:'ss-status-dot dot-leave'    },
            'Inactive': { badge:'badge-status badge-inactive', dot:'ss-status-dot dot-inactive' }
        })[s.Status] || { badge:'badge-status badge-active', dot:'ss-status-dot dot-active' };

        const initials = (s.FirstName||'').charAt(0).toUpperCase() + (s.LastName||'').charAt(0).toUpperCase();

        // ── Build subject skills label for teaching staff cards ──
        const rawSkills = Array.isArray(s.SubjectSkills) ? s.SubjectSkills : [];

        const skillsLabel = isT && rawSkills.length > 0
            ? rawSkills.map(sk => sk.subjectName || '').filter(Boolean).join(', ')
            : '';

        return { ...s,
        name: s.Name || '',

        // 🔑 CONTACT
        email: s.Email || '',
        phone: s.Phone || '',


            employeeId:s.EmployeeId, name:s.Name||`${s.FirstName} ${s.LastName}`,
            designation:s.Designation, department:s.Department, email:s.Email, phone:s.Phone,
            subject:s.Subject, joiningDate:s.JoiningDate, staffType:s.StaffType, status:s.Status,
            initials,
            skillsLabel,
            isTeachingCard: isT,
            photoUrl: s.PhotoUrl || null,
            hasPhoto: !!s.PhotoUrl,
            avatarClass:v.av, cardBandClass:v.band,
            typeBadgeClass: isT ? 'badge-status badge-active' : 'badge-status badge-inactive',
            statusBadgeClass: sm.badge, statusDotClass: sm.dot,
            netSalaryFmt:`\u20B9${(Number(s.BasicSalary)+Number(s.Hra)+Number(s.Da)-Number(s.Pf)).toLocaleString('en-IN')}`,
            basicSalaryFmt:`\u20B9${Number(s.BasicSalary).toLocaleString('en-IN')}`,
            allowancesFmt:`\u20B9${(Number(s.Hra)+Number(s.Da)).toLocaleString('en-IN')}`,
            deductionsFmt:`\u20B9${Number(s.Pf).toLocaleString('en-IN')}`,
            SubjectSkills: rawSkills,
            
            // 🗺 UI MAPPINGS (for camelCase consistency)
            dob: s.Dob || '',
            address: s.Address || '',
            gender: s.Gender || '',
            qualification: s.Qualification || '',
            joiningDate: s.JoiningDate || '',

            // Deprecated PascalCase (kept for safety)
            Dob: s.Dob || '',
            Address: s.Address || '',
            Gender: s.Gender || '',
            Qualification: s.Qualification || ''
        };
    }

    _decoratePayroll(r) {
        const isT = r.staffType === 'Teaching';
        const paid = r.salaryStatus === 'Paid';
        const fi  = (r.staffName||'').split(' ')[0]?.charAt(0).toUpperCase()||'';
        const li  = (r.staffName||'').split(' ')[1]?.charAt(0).toUpperCase()||'';
        const idx = Math.abs((r.staffName||'').charCodeAt(0)) % this._colorVariants.length;
        return { ...r, id:r.staffId, initials:fi+li, avatarClass:this._colorVariants[idx].av,
            typeBadgeClass:isT?'badge-status badge-active':'badge-status badge-inactive',
            rawBasic:Number(r.basicSalary)||0, rawHra:Number(r.hra)||0, rawDa:Number(r.da)||0,
            rawPf:Number(r.pf)||0, rawAllowances:Number(r.allowances)||0,
            rawDeductions:Number(r.deductions)||0, rawNet:Number(r.netSalary)||0,
            basicSalary:`\u20B9${Number(r.basicSalary).toLocaleString('en-IN')}`,
            allowances:`\u20B9${Number(r.allowances).toLocaleString('en-IN')}`,
            deductions:`\u20B9${Number(r.deductions).toLocaleString('en-IN')}`,
            netSalary:`\u20B9${Number(r.netSalary).toLocaleString('en-IN')}`,
            salaryStatusClass:paid?'badge-status badge-paid':'badge-status badge-pending',
            actionLabel:paid?'📄 Payslip':'💳 Pay Now',
            actionBtnClass:paid?'ss-action-btn btn-slip':'ss-action-btn btn-pay'
        };
    }

    _showToastMsg(icon, msg, type) {
        this.toastIcon=icon; this.toastMessage=msg; this.toastClass=`ss-toast toast-${type}`; this.showToast=true;
        setTimeout(() => { this.showToast = false; }, 3500);
    }
    _showPlatformToast(variant, title, message) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}