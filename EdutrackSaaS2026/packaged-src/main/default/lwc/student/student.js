import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import searchStudents from '@salesforce/apex/StudentController.searchStudents';
import getStudentDetails from '@salesforce/apex/StudentController.getStudentDetails';
import getAcademicYearOptions from '@salesforce/apex/StudentController.getAcademicYearOptions';
import getClassOptions from '@salesforce/apex/AdmissionController.getClassOptions';
import applyDiscount from '@salesforce/apex/StudentController.applyDiscount';
import LightningPrompt from 'lightning/prompt';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class Student extends NavigationMixin(LightningElement) {
    @track searchTerm = '';
    @track academicYear = ''; // Blank by default to show all
    @track className = '';
    @track sectionName = '';

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
            this.classOptions = await getClassOptions();
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
            this.students = []; // Optional: Clear results or keep them? Preview implies fresh state maybe. Let's keep data but switch view.
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

            // Extract academic years and names from products
            const products = data.products || [];
            const yearMap = data.academicYearNames || {};

            // Add any missing IDs that didn't resolve (failsafe)
            products.forEach(p => {
                const opp = p.Opportunity;
                if (opp && opp.Academic_Year__c && !yearMap[opp.Academic_Year__c]) {
                    yearMap[opp.Academic_Year__c] = opp.Academic_Year__c;
                }
            });

            const yearIds = Object.keys(yearMap);

            // Map IDs to Names using yearMap directly (supports inactive/archived years)
            this.detailAcademicYearOptions = yearIds.map(yId => {
                return { label: yearMap[yId] || 'Unnamed Year', value: yId };
            });

            // Default to the most recent year
            if (yearIds.length > 0) {
                this.selectedDetailAcademicYear = yearIds[0]; // Sort order is DESC in Apex

                // Initialize tempDiscount from existing database value
                const products = data.products || [];
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
        const cls = s.Class__c || 'N/A';
        const sec = s.Section__c || 'N/A';
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
        const match = this.detailAcademicYearOptions.find(opt => opt.value === this.selectedDetailAcademicYear);
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

        // Present = Working Days - Absent (as per business rule)
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
        event.stopPropagation(); // Don't expand the row when clicking the link
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

        // Instead of standard navigation, we dispatch an event to the dashboard
        // to switch to the Fee Management tab for this student.
        this.dispatchEvent(new CustomEvent('navtopaybill', {
            detail: { studentId: this.selectedStudentId },
            bubbles: true,
            composed: true
        }));
    }

    handleToggleInvoice(event) {
        const id = event.currentTarget.dataset.id;
        // Reassign object to trigger reactivity
        this.expandedInvoices = {
            ...this.expandedInvoices,
            [id]: !this.expandedInvoices[id]
        };
    }

    get productList() {
        const products = this.filteredDetailProducts;

        // Identify the main discount percentage
        let activeDisc = this.tempDiscount !== undefined ? this.tempDiscount : 0;
        if (this.tempDiscount === undefined) {
            const discountedProduct = products.find(p => p.Discount > 0);
            if (discountedProduct) activeDisc = discountedProduct.Discount;
        }

        // Robust identification for Dues (ProductCode or Name contains 'Previous')
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
        // Evaluate products across all years since Previous Dues could theoretically sit unlinked from the selected filter year if modeled incorrectly,
        // but it is currently mapped to selectedDetailAcademicYear via `filteredDetailProducts`
        const products = this.filteredDetailProducts;
        let currentYearGross = 0;
        let totalDiscount = 0;
        let previousDues = 0;

        // Identify the main discount percentage
        let activeDisc = this.tempDiscount !== undefined ? this.tempDiscount : 0;

        // If not editing, check database value
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
            previousDuesRaw: previousDues > 0 ? previousDues : false, // explicitly cast to boolean/number
            finalPayable: `₹ ${finalPayable.toLocaleString('en-IN')}`,
            percentLabel: activeDisc ? `${activeDisc}% Discount Applied` : '',
            hasDiscount: totalDiscount > 0,
            activeDisc: activeDisc
        };
    }

    // Tab calculation for Exams
    get examTabs() {
        const exams = this.selectedStudentDetails?.exams || [];
        return [
            { label: 'UNIT TEST', value: 'Unit Test', activeClass: this.selectedExamTab === 'Unit Test' ? 'perf-tab active' : 'perf-tab', count: exams.filter(e => (e.Exam_Type__c || '').includes('Unit Test')).length },
            { label: 'QUARTERLY', value: 'QuarterLY', activeClass: this.selectedExamTab === 'QuarterLY' ? 'perf-tab active' : 'perf-tab', count: exams.filter(e => (e.Exam_Type__c || '').includes('Quarter') || (e.Exam_Type__c || '').includes('Mid')).length },
            { label: 'FINAL', value: 'Final', activeClass: this.selectedExamTab === 'Final' ? 'perf-tab active' : 'perf-tab', count: exams.filter(e => (e.Exam_Type__c || '').includes('Final')).length }
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
                const type = (e.Exam_Type__c || '').toLowerCase();
                if (this.selectedExamTab === 'Unit Test') return type.includes('unit test');
                if (this.selectedExamTab === 'QuarterLY') return type.includes('quarter') || type.includes('mid');
                if (this.selectedExamTab === 'Final') return type.includes('final');
                return true;
            })
            .map(e => {
                let subjects = [];
                let totalObtained = 0;
                let totalMax = 0;

                Object.keys(e).forEach(key => {
                    const lowerKey = key.toLowerCase();
                    if (lowerKey.endsWith('__c') && !['student__c', 'exam_type__c', 'class__c', 'section__c', 'id', 'name', 'createddate'].includes(lowerKey)) {
                        const subjName = key.replace('__c', '').replace(/_/g, ' ').toUpperCase();
                        const rawValue = e[key];
                        const marks = (rawValue !== null && rawValue !== undefined) ? Number(rawValue) : 0;

                        subjects.push({
                            name: subjName,
                            score: marks,
                            max: 100
                        });
                        totalObtained += marks;
                        totalMax += 100;
                    }
                });

                const percent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

                return {
                    id: e.Id,
                    name: e.Exam_Type__c || e.Name,
                    type: e.Name,
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
        // Update tempDiscount for the newly selected year
        const products = this.filteredDetailProducts;
        const discountedProduct = products.find(p => p.Discount > 0);
        this.tempDiscount = discountedProduct ? discountedProduct.Discount : 0;
    }

    handleDiscountInput(event) {
        const val = parseFloat(event.target.value);
        this.tempDiscount = isNaN(val) ? 0 : val;
    }

    get isDiscountDisabled() {
        // Always return false to allow editing even if a discount is already applied
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

            // Refresh details
            const data = await getStudentDetails({ studentId: this.selectedStudentId });
            this.selectedStudentDetails = {
                ...data,
                student: {
                    ...data.student,
                    avatar: this.getInitials(data.student.Name)
                }
            };
            // Re-sync tempDiscount after save
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
            Object.keys(e).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (lowerKey.endsWith('__c') && !['student__c', 'exam_type__c', 'class__c', 'section__c', 'id', 'name', 'createddate'].includes(lowerKey)) {
                    obtained += Number(e[key] || 0);
                    max += 100;
                }
            });
            const percent = max > 0 ? (obtained / max) * 100 : 0;

            const type = (e.Exam_Type__c || '').toLowerCase();
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

            // Type → icon & style
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

            // Status → badge
            let statusClass = 'bcase-status status-open';
            const statLow = status.toLowerCase();
            if (statLow === 'closed') {
                statusClass = 'bcase-status status-closed';
            } else if (statLow === 'escalated') {
                statusClass = 'bcase-status status-escalated';
            } else if (statLow.includes('progress') || statLow.includes('working')) {
                statusClass = 'bcase-status status-inprogress';
            }

            // Format date
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