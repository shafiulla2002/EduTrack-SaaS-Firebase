import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import searchStudents from '@salesforce/apex/StudentController.searchStudents';
import getStudentDetails from '@salesforce/apex/StudentController.getStudentDetails';
import getAcademicYearOptions from '@salesforce/apex/StudentController.getAcademicYearOptions';
import getClassOptions from '@salesforce/apex/StudentController.getClassOptions';
import applyDiscount from '@salesforce/apex/StudentController.applyDiscount';
import LightningPrompt from 'lightning/prompt';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSectionOptions from '@salesforce/apex/StudentController.getSectionOptions';

export default class Student extends NavigationMixin(LightningElement) {
    @track searchTerm = '';
    @track academicYear = ''; // Blank by default to show all
    @track className = '';
    @track sectionName = '';
@track sectionOptions = [];

    @track students = [];
    @track isLoading = false;
    @track classOptions = [];
    @track academicYearOptions = [];

    // Details logic
    @track viewState = 'list'; // 'list' | 'detail'
    @track activeTab = 'Dashboard';
    @track selectedStudentId = null;
    @track selectedStudentDetails = null;
    @track selectedExamTab = 'Unit Test'; // Default tab
    @track expandedInvoices = {}; // tracks which invoices are expanded
    @track selectedDetailAcademicYear = '';
    @track detailAcademicYearOptions = [];
    @track expandedExams = {}; // tracks which exams are expanded
    @track tempDiscount = 0; // For instant UI reflection

    _studentId;
    @api
    get studentId() {
        return this._studentId;
    }
    set studentId(value) {
        this._studentId = value;
        if (value) {
            this.loadStudentDetails(value);
        } else {
            this.viewState = 'list';
        }
    }
    async fetchSectionOptions() {
        try {
            this.sectionOptions = await getSectionOptions();
        } catch (error) {
            console.error('Error fetching section options', error);
        }
    }

    get isSearchView() { return this.viewState === 'search'; }
    get isListView() { return this.viewState === 'list'; }
    get isDetailView() { return this.viewState === 'detail'; }

    get resultsSubtitle() {
        const cls = this.className || 'All Classes';
        const sec = this.sectionName ? ` · Section ${this.sectionName}` : '';
        const yearMatch = this.academicYearOptions.find(opt => opt.value === this.academicYear);
        const yearLabel = yearMatch ? yearMatch.label : (this.academicYear || 'All');
        return `${cls}${sec} · Academic Year ${yearLabel}`;
    }

    connectedCallback() {
        this.fetchClassOptions();
        this.fetchSectionOptions();
        this.fetchAcademicYearOptions();
        this.fetchStudents(); // Show all by default
    }

    async fetchAcademicYearOptions() {
        try {
            this.academicYearOptions = await getAcademicYearOptions();
        } catch (error) {
            console.error('Error fetching academic year options', error);
        }
    }

    async fetchClassOptions() {
    try {
        const data = await getClassOptions();
        // Handle both List<String> and List<{label,value}> from Apex
        this.classOptions = (data || []).map(item =>
            typeof item === 'string' ? { label: item, value: item } : item
        );
    } catch (error) {
        console.error('Error fetching class options', error);
    }
}

    async fetchStudents() {
        this.isLoading = true;
        try {
            const results = await searchStudents({
                searchTerm: this.searchTerm,
                academicYear: this.academicYear,
                className: this.className,
                sectionName: this.sectionName
            });

            this.students = results.map((s, index) => ({
                ...s,
                phone: s.phone || 'No Contact',
                gradIndex: (index % 6) + 1,
                gradientClass: `v2-av-grad-${(index % 6) + 1}`
            }));
        } catch (error) {
            console.error('Error searching students', error);
        } finally {
            this.isLoading = false;
        }
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        const term = this.searchTerm.trim();

        // Only search if 3+ chars or empty (to reset)
        if (term.length >= 3 || term.length === 0) {
            clearTimeout(this.delayTimeout);
            this.delayTimeout = setTimeout(() => {
                this.fetchStudents();
            }, 350);
        }
    }

    handleFilterChange(event) {
        const field = event.target.dataset.name;
        this[field] = event.target.value;
        this.fetchStudents();
    }

    handleRefresh() {
        this.fetchStudents();
    }

    handleSearch() {
        this.fetchStudents();
        this.viewState = 'list';
    }

    handleBack() {
        if (this.viewState === 'detail') {
            this.viewState = 'list';
            this.selectedStudentId = null;
            this.selectedStudentDetails = null;
        } else if (this.viewState === 'list') {
            this.viewState = 'search';
            this.students = [];
        } else {
            const event = new CustomEvent('navback', {
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);
        }
    }

    handleBackToSearch() {
        this.viewState = 'search';
    }

    async handleViewDetails(event) {
        const studentId = event.currentTarget.dataset.id;
        this.loadStudentDetails(studentId);
    }

    async loadStudentDetails(studentId) {
        this.selectedStudentId = studentId;

        try {
            this.isLoading = true;
            const data = await getStudentDetails({ studentId });

console.log('>>> Exams returned:', JSON.stringify(data.exams));
    console.log('>>> Exams count:', data.exams?.length);
            // Extract academic years from products
            const products = data.products || [];
            const yearIds = [...new Set(products.map(p => p.Opportunity?.Academic_Year__c).filter(y => !!y))];

            // Map IDs to Names using academicYearOptions
            this.detailAcademicYearOptions = yearIds.map(yId => {
                const match = this.academicYearOptions.find(opt => opt.value === yId);
                return { label: match ? match.label : (yId || 'Unnamed Year'), value: yId };
            });

            // Default to the most recent year
            if (yearIds.length > 0) {
                this.selectedDetailAcademicYear = yearIds[0];

                const discountedProduct = products.find(p => p.Discount > 0 && p.Opportunity?.Academic_Year__c === this.selectedDetailAcademicYear);
                this.tempDiscount = discountedProduct ? discountedProduct.Discount : 0;
            }

            this.selectedStudentDetails = {
                ...data,
                student: {
                    ...data.student,
                    avatar: this.getInitials(data.student.Name)
                }
            };

            // Expand first exam by default
            if (data.exams && data.exams.length > 0) {
                this.expandedExams = { [data.exams[0].Id]: true };
            } else {
                this.expandedExams = {};
            }

            this.viewState = 'detail';
        } catch (error) {
            console.error('Error loading details', error);
        } finally {
            this.isLoading = false;
        }
    }

    closeDetails() {
        this.viewState = 'list';
        this.selectedStudentDetails = null;
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    }

    // Computed properties for Detail View
    get student() { return this.selectedStudentDetails?.student || {}; }

    get studentSubtitle() {
    const s = this.student;
    const cls = s.ClassName || s.Class__c || 'N/A';    // ← use injected name
    const sec = s.SectionName || s.Section__c || 'N/A'; // ← use injected name
    return `Class: ${cls} | Section: ${sec}`;
}


    get address() {
        const s = this.student;
        return {
            street: s.PersonMailingStreet,
            cityState: `${s.PersonMailingCity || ''}, ${s.State__c || ''} – ${s.PersonMailingPostalCode || ''}`,
            country: s.Country__c
        };
    }

    get selectedDetailAcademicYearName() {
        const match = this.academicYearOptions.find(opt => opt.value === this.selectedDetailAcademicYear);
        return match ? match.label : (this.selectedDetailAcademicYear || 'N/A');
    }

    get attendanceStats() {
        const statsList = this.selectedStudentDetails?.attendanceStats || [];
        const currentYearStat = statsList.find(s => s.year === this.selectedDetailAcademicYear)
            || { workingDays: 0, attendance: [] };

        const att = currentYearStat.attendance || [];
        const workingDays = currentYearStat.workingDays || 0;

        let absent = 0;
        att.forEach(a => {
            if (a.status === 'Absent') absent += (a.cnt || 0);
        });

        const present = Math.max(0, workingDays - absent);
        const percent = workingDays > 0 ? Math.round((present / workingDays) * 100) : 0;

        return {
            workingDays: workingDays,
            present: present,
            absent: absent,
            percent: `${percent}%`
        };
    }

    get invoiceList() {
        return (this.selectedStudentDetails?.invoices || []).map(inv => {
            const items = (inv.Invoice_Items__r || []).map(item => ({
                name: item.Product__r?.Name || 'Item',
                amount: `₹ ${(item.Amount__c || 0).toLocaleString('en-IN')}`
            }));
            const amount = (inv.Invoice_Items__r || []).reduce((sum, item) => sum + (item.Amount__c || 0), 0);
            return {
                id: inv.Id,
                date: inv.Invoice_Date__c,
                number: inv.Name,
                mode: inv.Payment_Method__c || '—',
                amount: `₹ ${amount.toLocaleString('en-IN')}`,
                status: inv.Status__c,
                isPaid: inv.Status__c === 'Paid',
                statusClass: inv.Status__c === 'Paid' ? 'pill-paid' : 'pill-due',
                items: items,
                hasItems: items.length > 0,
                isExpanded: !!this.expandedInvoices[inv.Id]
            };
        });
    }

    handleInvoiceClick(event) {
        event.stopPropagation();
        const invoiceId = event.currentTarget.dataset.id;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: invoiceId,
                actionName: 'view'
            }
        });
    }

    handleEditInvoice(event) {
        event.stopPropagation();
        const invoiceId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('navtopaybill', {
            detail: { studentId: this.selectedStudentId },
            bubbles: true,
            composed: true
        }));
    }

    handleToggleInvoice(event) {
        const id = event.currentTarget.dataset.id;
        this.expandedInvoices = {
            ...this.expandedInvoices,
            [id]: !this.expandedInvoices[id]
        };
    }

    get productList() {
        const products = this.filteredDetailProducts;

        let activeDisc = this.tempDiscount !== undefined ? this.tempDiscount : 0;
        if (this.tempDiscount === undefined) {
            const discountedProduct = products.find(p => p.Discount > 0);
            if (discountedProduct) activeDisc = discountedProduct.Discount;
        }

        const isDues = (p) => p.Product2?.ProductCode === 'PREV_DUES' || p.Product2?.Name?.includes('Previous');

        return products.map(p => {
            const qty = p.Quantity || 1;
            const unitPrice = p.UnitPrice || 0;
            const gross = unitPrice * qty;
            const discPercent = isDues(p) ? 0 : activeDisc;
            const net = gross * (1 - (discPercent / 100));
            const discAmt = gross - net;

            return {
                id: p.Id,
                name: p.Product2?.Name || 'Fee Item',
                price: `₹ ${unitPrice.toLocaleString('en-IN')}`,
                grossTotal: `₹ ${gross.toLocaleString('en-IN')}`,
                discountAmount: `₹ ${discAmt.toLocaleString('en-IN')}`,
                discountPercent: discPercent ? `(${discPercent}%)` : '',
                total: `₹ ${net.toLocaleString('en-IN')}`,
                hasDiscount: discAmt > 0
            };
        });
    }

    get academicTotals() {
        const products = this.filteredDetailProducts;
        let currentYearGross = 0;
        let totalDiscount = 0;
        let previousDues = 0;

        let activeDisc = this.tempDiscount !== undefined ? this.tempDiscount : 0;

        if (this.tempDiscount === undefined) {
            const discountedProduct = products.find(p => p.Discount > 0);
            if (discountedProduct) activeDisc = discountedProduct.Discount;
        }

        const isDues = (p) => p.Product2?.ProductCode === 'PREV_DUES' || p.Product2?.Name?.includes('Previous');

        products.forEach(p => {
            const qty = p.Quantity || 1;
            const unitPrice = p.UnitPrice || 0;
            const gross = unitPrice * qty;

            if (isDues(p)) {
                previousDues += gross;
            } else {
                currentYearGross += gross;
                totalDiscount += (gross * (activeDisc / 100));
            }
        });

        const currentYearNet = currentYearGross - totalDiscount;
        const finalPayable = currentYearNet + previousDues;

        return {
            currentYearGross: `₹ ${currentYearGross.toLocaleString('en-IN')}`,
            currentYearNet: `₹ ${currentYearNet.toLocaleString('en-IN')}`,
            totalDiscount: `₹ ${totalDiscount.toLocaleString('en-IN')}`,
            previousDues: `₹ ${previousDues.toLocaleString('en-IN')}`,
            previousDuesRaw: previousDues > 0 ? previousDues : false,
            finalPayable: `₹ ${finalPayable.toLocaleString('en-IN')}`,
            percentLabel: activeDisc ? `${activeDisc}% Discount Applied` : '',
            hasDiscount: totalDiscount > 0,
            activeDisc: activeDisc
        };
    }

    // ─────────────────────────────────────────────────────────
    //  HELPER: Check if a key is the Extra_Marks field
    //  Handles all possible forms after NamespaceUtils.stripNamespace:
    //    Extra_Marks__c  /  extra_marks__c  /  Extra_Marks  /  extra_marks
    // ─────────────────────────────────────────────────────────
    _isExtraMarksKey(key) {
        const k = key.toLowerCase().replace(/__c$/, '').replace(/_/g, '');
        return k === 'extramarks' || k.endsWith('extramarks');
    }

    // ─────────────────────────────────────────────────────────
    //  HELPER: Fields to SKIP when iterating exam keys
    //  Excludes all non-numeric / metadata fields so that
    //  Extra_Marks__c (JSON string) and other text fields never
    //  get treated as a numeric score.
    // ─────────────────────────────────────────────────────────
    _isSkippedExamField(key) {
        // FIX: Also block the extra marks field in all its possible name forms
        if (this._isExtraMarksKey(key)) return true;

        const SKIP = new Set([
            'student__c', 'exam_type__c', 'class__c', 'section__c',
            'id', 'name', 'createddate', 'lastmodifieddate', 'systemmodstamp',
            'createdbyid', 'lastmodifiedbyid', 'isdeleted',
            // stripped variants (after NamespaceUtils.stripNamespace removes __c)
            'student', 'exam_type', 'class', 'section'
        ]);
        return SKIP.has(key.toLowerCase());
    }

    // ─────────────────────────────────────────────────────────
    //  HELPER: Parse Extra_Marks JSON into subject entries.
    //  Scans ALL keys of the exam object for the one that matches
    //  the extra marks field — regardless of casing or __c suffix —
    //  so NamespaceUtils.stripNamespace can never break it.
    //  Returns an array of { name, score, max }
    // ─────────────────────────────────────────────────────────
    _parseExtraMarks(examObj) {
        // DEBUG: log all exam keys once so we can see exact field names returned by Apex
        console.log('[_parseExtraMarks] exam keys:', JSON.stringify(Object.keys(examObj)));

        // Scan every key — match whichever one is the Extra_Marks field
        let raw = null;
        for (const key of Object.keys(examObj)) {
            if (this._isExtraMarksKey(key)) {
                raw = examObj[key];
                console.log('[_parseExtraMarks] found key:', key, '→ value:', raw);
                break;
            }
        }

        if (!raw) return [];

        // Value might already be a parsed object if LWC auto-deserialised it
        let parsed = raw;
        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                console.error('[_parseExtraMarks] JSON parse error:', e, 'raw value:', raw);
                return [];
            }
        }

        if (typeof parsed !== 'object' || parsed === null) return [];

        return Object.keys(parsed).map(subjectName => ({
            name: subjectName.replace(/\b\w/g, c => c.toUpperCase()), // Title Case
            score: Number(parsed[subjectName]) || 0,
            max: 100
        }));
    }

    // Tab calculation for Exams
    get examTabs() {
        const exams = this.selectedStudentDetails?.exams || [];
        return [
            { label: 'UNIT TEST',  value: 'Unit Test',  activeClass: this.selectedExamTab === 'Unit Test'  ? 'perf-tab active' : 'perf-tab', count: exams.filter(e => (e.Exam_Type__c || '').includes('Unit Test')).length },
{ label: 'QUARTERLY', value: 'Quarterly', activeClass: this.selectedExamTab === 'Quarterly' ? 'perf-tab active' : 'perf-tab', 
    count: exams.filter(e => {
    const t = (e.Exam_Type__c || '').toLowerCase();
    return t.includes('quarter') || t.includes('mid');
  }).length 
},
            { label: 'FINAL',     value: 'Final',     activeClass: this.selectedExamTab === 'Final'     ? 'perf-tab active' : 'perf-tab', count: exams.filter(e => (e.Exam_Type__c || '').includes('Final')).length }
        ];
    }

    handleExamTabChange(event) {
        this.selectedExamTab = event.currentTarget.dataset.id;
    }

    handleToggleExam(event) {
        const id = event.currentTarget.dataset.id;
        this.expandedExams = {
            ...this.expandedExams,
            [id]: !this.expandedExams[id]
        };
    }

    get examList() {
        const rawExams = this.selectedStudentDetails?.exams || [];
        if (rawExams.length === 0) return [];

        return rawExams
            .filter(e => {
                const type = (e.Exam_Type__c || e.Exam_Type || '').toLowerCase();
                if (this.selectedExamTab === 'Unit Test') return type.includes('unit test');
if (this.selectedExamTab === 'Quarterly') return type.includes('quarter') || type.includes('mid');
                if (this.selectedExamTab === 'Final') return type.includes('final');
                return true;
            })
            .map(e => {
                let subjects = [];
                let totalObtained = 0;
                let totalMax = 0;

                // ── Standard numeric subject fields ──────────────────────────
                Object.keys(e).forEach(key => {
                    // FIX: Skip non-numeric / metadata fields including Extra_Marks__c
                    if (this._isSkippedExamField(key)) return;


                    // FIX: Handle null/undefined explicitly. Number(null) is 0, which is misleading.
                    if (rawValue === null || rawValue === undefined) return;

                    const marks = Number(rawValue);

                    // FIX: Skip NaN — means this field is not a numeric score
                    if (isNaN(marks)) return;

                    const subjName = key
                        .replace(/__c$/i, '')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, c => c.toUpperCase()); // Title Case

                    subjects.push({ name: subjName, score: marks, max: 100 });
                    totalObtained += marks;
                    totalMax += 100;
                });

                // ── Extra subjects from Extra_Marks__c JSON ──────────────────
                // FIX: Parse the JSON blob and add each entry as its own subject row
                const extraSubjects = this._parseExtraMarks(e);
                extraSubjects.forEach(es => {
                    // Avoid duplicates if somehow already in standard fields
                    const alreadyAdded = subjects.find(s => s.name.toLowerCase() === es.name.toLowerCase());
                    if (!alreadyAdded) {
                        subjects.push({ name: es.name, score: es.score, max: es.max });
                        totalObtained += es.score;
                        totalMax += es.max;
                    }
                });

                const percent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

                return {
                    id: e.Id,
                    name: e.Exam_Type__c || e.Exam_Type || e.Name,
                    type: e.Name || e.Exam_Type__c || e.Exam_Type || '',
                    score: totalMax > 0 ? `${percent}%` : '—',
                    totalObtained: totalObtained,
                    totalMax: totalMax,
                    percent: percent,
                    subjects: subjects,
                    isExpanded: !!this.expandedExams[e.Id],
                    chevronClass: this.expandedExams[e.Id] ? 'perf-chevron expanded' : 'perf-chevron'
                };
            });
    }

    handleDetailYearChange(event) {
        this.selectedDetailAcademicYear = event.target.value;
        const products = this.filteredDetailProducts;
        const discountedProduct = products.find(p => p.Discount > 0);
        this.tempDiscount = discountedProduct ? discountedProduct.Discount : 0;
    }

    handleDiscountInput(event) {
        const val = parseFloat(event.target.value);
        this.tempDiscount = isNaN(val) ? 0 : val;
    }

    get isDiscountDisabled() {
        return false;
    }

    async handleApplyDiscount() {
        if (!this.selectedDetailAcademicYear || !this.selectedStudentId) return;

        const percent = this.tempDiscount;
        if (percent < 0 || percent > 100) {
            this.showToast('Invalid Input', 'Please enter a valid percentage between 0 and 100.', 'error');
            return;
        }

        this.isLoading = true;
        try {
            await applyDiscount({
                studentId: this.selectedStudentId,
                academicYearId: this.selectedDetailAcademicYear,
                discountPercent: percent
            });
            this.showToast('Success', `Discount of ${percent}% saved successfully!`, 'success');

            const data = await getStudentDetails({ studentId: this.selectedStudentId });
            this.selectedStudentDetails = {
                ...data,
                student: {
                    ...data.student,
                    avatar: this.getInitials(data.student.Name)
                }
            };
            const discountedProduct = this.filteredDetailProducts.find(p => p.Discount > 0);
            this.tempDiscount = discountedProduct ? discountedProduct.Discount : 0;

        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    get filteredDetailProducts() {
        const allProducts = this.selectedStudentDetails?.products || [];
        if (!this.selectedDetailAcademicYear) return allProducts;
        return allProducts.filter(p => p.Opportunity?.Academic_Year__c === this.selectedDetailAcademicYear);
    }

    get feeSummary() {
        const prod = this.selectedStudentDetails?.products || [];
        const inv = this.selectedStudentDetails?.invoices || [];

        const gross = prod.reduce((sum, p) => sum + ((p.UnitPrice || 0) * (p.Quantity || 1)), 0);
        const allocated = prod.reduce((sum, p) => sum + (p.TotalPrice || 0), 0);
        const discount = gross - allocated;
        const paid = inv.reduce((sum, i) => {
            if (i.Status__c === 'Paid') {
                const invSum = i.Invoice_Items__r?.reduce((s, item) => s + (item.Amount__c || 0), 0) || 0;
                return sum + invSum;
            }
            return sum;
        }, 0);

        const pending = allocated - paid;

        return {
            allocated: `₹ ${allocated.toLocaleString('en-IN')}`,
            paid: `₹ ${paid.toLocaleString('en-IN')}`,
            pending: `₹ ${pending.toLocaleString('en-IN')}`,
            discount: `₹ ${discount.toLocaleString('en-IN')}`,
            isClear: pending <= 0,
            pendingColor: pending > 0 ? 'v3' : 'v2'
        };
    }

    get academicProgress() {
        const exams = this.selectedStudentDetails?.exams || [];
        if (exams.length === 0) {
            return { overallAverage: 0, grade: 'N/A', summary: 'No exam data available.' };
        }

        // 1. Group individual exam percentages by category
        const categoryData = {
            'Unit Test': [],
            'QuarterLY': [],
            'Final': []
        };

        exams.forEach(e => {
            let obtained = 0;
            let max = 0;

            // ── Standard numeric fields ───────────────────────────────────
            Object.keys(e).forEach(key => {
                // FIX: Same skip logic as examList — exclude Extra_Marks__c and non-numeric fields
                if (this._isSkippedExamField(key)) return;


                // FIX: Handle null/undefined explicitly
                if (rawValue === null || rawValue === undefined) return;

                const val = Number(rawValue || 0);

                // FIX: Skip NaN values so they never corrupt totals
                if (isNaN(val)) return;

                obtained += val;
                max += 100;
            });

            // ── Extra marks from JSON ─────────────────────────────────────
            // FIX: Include Extra_Marks__c subjects in the overall average calculation
            const extraSubjects = this._parseExtraMarks(e);
            extraSubjects.forEach(es => {
                obtained += es.score;
                max += es.max;
            });

            const percent = max > 0 ? (obtained / max) * 100 : 0;

            const type = (e.Exam_Type__c || e.Exam_Type || '').toLowerCase();
            if (type.includes('unit test')) categoryData['Unit Test'].push(percent);
            else if (type.includes('quarter') || type.includes('mid')) categoryData['QuarterLY'].push(percent);
            else if (type.includes('final')) categoryData['Final'].push(percent);
        });

        // 2. Calculate average for each category
        const categoryAverages = [];
        Object.keys(categoryData).forEach(cat => {
            const scores = categoryData[cat];
            if (scores.length > 0) {
                const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
                categoryAverages.push(avg);
            }
        });

        // 3. Final average is the average of category averages
        const overallAverage = categoryAverages.length > 0
            ? Math.round(categoryAverages.reduce((s, v) => s + v, 0) / categoryAverages.length)
            : 0;

        let grade = 'F';
        if (overallAverage >= 90) grade = 'A+';
        else if (overallAverage >= 80) grade = 'A';
        else if (overallAverage >= 70) grade = 'B';
        else if (overallAverage >= 60) grade = 'C';
        else if (overallAverage >= 50) grade = 'D';

        return {
            overallAverage: overallAverage,
            grade: grade,
            summary: overallAverage >= 80 ? 'Excellent performance! Keeping it up.' :
                overallAverage >= 60 ? 'Good standing, showing steady progress.' :
                    'Requires additional support in certain subjects.'
        };
    }

    get tabAddressClass() { return this.activeTab === 'address' ? 'active' : ''; }
    get tabAdmissionClass() { return this.activeTab === 'admission' ? 'active' : ''; }
    get tabFinanceClass() { return this.activeTab === 'finance' ? 'active' : ''; }
    get tabAttendanceClass() { return this.activeTab === 'attendance' ? 'active' : ''; }
    get tabPerformanceClass() { return this.activeTab === 'performance' ? 'active' : ''; }
    get tabBehaviorClass() { return this.activeTab === 'behavior' ? 'active' : ''; }

    // ──────────────────────────────────────────────────────────
    //  BEHAVIOUR / CASES
    // ──────────────────────────────────────────────────────────
    get caseList() {
        const rawCases = this.selectedStudentDetails?.cases || [];
        return rawCases.map(c => {
            const type = (c.Type || 'General').trim();
            const status = (c.Status || 'Unknown').trim();
            const priority = (c.Priority || 'Medium').trim();

            let typeIcon = '📋';
            let typeClass = 'bcase-tag tag-default';
            const typeLow = type.toLowerCase();
            if (typeLow.includes('positive') || typeLow.includes('appreciation') || typeLow.includes('commend')) {
                typeIcon = '⭐';
                typeClass = 'bcase-tag tag-positive';
            } else if (typeLow.includes('negative') || typeLow.includes('disciplin') || typeLow.includes('incident') || typeLow.includes('warning')) {
                typeIcon = '⚠️';
                typeClass = 'bcase-tag tag-negative';
            } else if (typeLow.includes('general') || typeLow.includes('query') || typeLow.includes('request')) {
                typeIcon = '📋';
                typeClass = 'bcase-tag tag-neutral';
            }

            let statusClass = 'bcase-status status-open';
            const statLow = status.toLowerCase();
            if (statLow === 'closed') {
                statusClass = 'bcase-status status-closed';
            } else if (statLow === 'escalated') {
                statusClass = 'bcase-status status-escalated';
            } else if (statLow.includes('progress') || statLow.includes('working')) {
                statusClass = 'bcase-status status-inprogress';
            }

            const rawDate = c.CreatedDate ? new Date(c.CreatedDate) : null;
            const dateStr = rawDate
                ? rawDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—';

            return {
                id: c.Id,
                subject: c.Subject || '(No subject)',
                type: type,
                typeIcon: typeIcon,
                typeClass: typeClass,
                status: status,
                statusClass: statusClass,
                priority: priority,
                description: c.Description || '',
                hasDesc: !!c.Description,
                date: dateStr
            };
        });
    }

    get behaviourStats() {
        const list = this.caseList;
        const active = list.filter(c => c.status.toLowerCase() !== 'closed').length;
        const positive = list.filter(c => c.typeClass.includes('positive')).length;
        const negative = list.filter(c => c.typeClass.includes('negative')).length;
        return { total: list.length, active, positive, negative, hasCases: list.length > 0 };
    }
}