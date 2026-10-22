import { LightningElement, track, wire } from 'lwc';
import getDashboardMetrics from '@salesforce/apex/EduProDashboardController.getDashboardMetrics';
import getSchoolSetup from '@salesforce/apex/EduProDashboardController.getSchoolSetup';
import { refreshApex } from '@salesforce/apex';
import getAllRecentAdmissions from '@salesforce/apex/EduProDashboardController.getAllRecentAdmissions';
import getAllRecentPayments from '@salesforce/apex/EduProDashboardController.getAllRecentPayments';
import globalSearch from '@salesforce/apex/EduProDashboardController.globalSearch';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

// Schema Imports for Robust Namespace Handling
import SETUP_OBJ from '@salesforce/schema/School_Setup__c';
import SCHOOL_NAME_FIELD from '@salesforce/schema/School_Setup__c.School_Name__c';
import SCHOOL_LOGO_FIELD from '@salesforce/schema/School_Setup__c.School_Logo__c';
import SCHOOL_SUBTITLE_FIELD from '@salesforce/schema/School_Setup__c.School_Subtitle__c';
import SETUP_COMPLETE_FIELD from '@salesforce/schema/School_Setup__c.Setup_Completed__c';

export default class EduProDashboard extends NavigationMixin(LightningElement) {
    @track admissionsTitle = 'Recent Admissions';
    @track paymentsTitle = 'Payment Overview';
    @track currentPage = 'dashboard';
    @track currentNav = 'dashboard';
    @track selectedStudentIdForBilling = null;

    @track allAdmissions = [];
    @track allPayments = [];
    @track displayAdmissions = [];
    @track displayPayments = [];

    @track admissionsLimit = 5;
    @track paymentsLimit = 5;

    @track avgAttendance = '0%';
    @track avgAcademicScore = '0%';

    @track studentTrend = { value: '0%', class: 'stat-trend up', icon: '↑' };
    @track revenueTrend = { value: '0%', class: 'stat-trend up', icon: '↑' };
    @track attendanceTrend = { value: '0%', class: 'stat-trend up', icon: '↑' };
    @track scoreTrend = { value: '0%', class: 'stat-trend up', icon: '↑' };

    @track schoolName = 'EDU PRO SYSTEM';
    @track schoolSubtitle = 'Powered by Salesforce';
    @track schoolLogo = '';
    @track isSetupCompleted = false;
    @track isInitializing = true;
    @track isSidebarOpen = false;
    @track showBulkImport = false;

    @track searchTerm = '';
    @track searchResults = [];
    @track showSearchDropdown = false;
    @track selectedStudentIdFromSearch = null;
    searchTimeout;

    wiredSetupResult;
    @wire(getSchoolSetup)
    wiredSetup(result) {
        this.wiredSetupResult = result;
        const { error, data } = result;
        if (data) {
            // Apex returns a map, we use it directly since it's already mapped to names
            this.schoolName = data.schoolName;
            this.schoolLogo = data.schoolLogo;
            this.schoolSubtitle = data.schoolSubtitle;
            this.isSetupCompleted = data.isSetupCompleted;

            if (!this.isSetupCompleted && this.currentPage !== 'setup') {
                this.currentPage = 'setup';
                this.currentNav = 'setup';
            }
        } else if (error) {
            console.error('Error loading school setup', error);
        }
        if (data || error) {
            this.isInitializing = false;
        }
    }

    wiredMetricsResult;
    @wire(getDashboardMetrics)
    wiredMetrics(result) {
        this.wiredMetricsResult = result;
        const { error, data } = result;
        if (data) {
            this.totalStudents = data.totalStudents || 0;
            let rev = data.totalRevenue || 0;
            if (rev > 100000) {
                this.totalRevenue = '₹' + (rev / 100000).toFixed(1) + 'L';
            } else {
                this.totalRevenue = '₹' + rev.toLocaleString();
            }
            this.allAdmissions = data.recentAdmissions || [];
            this.allPayments = data.paymentOverview || [];
            this.updateDisplayLists();

            this.avgAttendance = `${(data.avgAttendance || 0).toFixed(1)}%`;
            this.avgAcademicScore = `${(data.avgAcademicScore || 0).toFixed(1)}%`;

            this.studentTrend = this.formatTrend(data.studentTrend);
            this.revenueTrend = this.formatTrend(data.revenueTrend);
            this.attendanceTrend = this.formatTrend(data.attendanceTrend);
            this.scoreTrend = this.formatTrend(data.scoreTrend);
        } else if (error) {
            console.error('Error fetching dashboard metrics:', error);
        }
    }

    fetchMetrics() {
        if (this.wiredMetricsResult) {
            refreshApex(this.wiredMetricsResult);
        }
    }

    formatTrend(val) {
        const num = val || 0;
        const isUp = num >= 0;
        return {
            value: Math.abs(num).toFixed(1) + '%',
            class: isUp ? 'stat-trend up' : 'stat-trend down',
            isUp: isUp
        };
    }

    @track admissionActiveTab = 'admission';

    get isDashboardPage() { return this.currentPage === 'dashboard'; }
    get isStaffPage() { return this.currentPage === 'staff'; }
    get isAdmissionPage() { return this.currentPage === 'admission'; }
    get isPriceBookPage() { return this.currentPage === 'pricebook'; }
    get isAttendancePage() { return this.currentPage === 'attendance'; }
    get isAttendanceReportPage() { return this.currentPage === 'attendance_report'; }
    get isAnalyticsPage() { return this.currentPage === 'analytics'; }
    get isSchoolManagementPage() { return this.currentPage === 'school_management'; }
    get isPayBillPage() { return this.currentPage === 'paybill'; }
    get isStudentPage() { return this.currentPage === 'student'; }
    get isPromotionPage() { return this.currentPage === 'promotion'; }
    get isGradesPage() { return this.currentPage === 'grades'; }
    get isComplaintBoxPage() { return this.currentPage === 'complaintbox'; }
    get isSetupPage() { return this.currentPage === 'setup'; }
    get isExpensePage() { return this.currentPage === 'expense'; }
    get isEnterMarksPage() { return this.currentPage === 'entermarks'; }

    get feeNavClass() {
        return `nav-item ${this.currentNav === 'paybill' ? 'active' : ''}`;
    }
    get expenseNavClass() {
        return `nav-item ${this.currentNav === 'expense' ? 'active' : ''}`;
    }
    get enterMarksNavClass() {
        return `nav-item ${this.currentNav === 'entermarks' ? 'active' : ''}`;
    }

    get dashboardNavClass() {
        return `nav-item ${this.currentNav === 'dashboard' ? 'active' : ''}`;
    }
    get admissionNavClass() {
        return `nav-item ${this.currentNav === 'admission' ? 'active' : ''}`;
    }
    get attendanceNavClass() {
        return `nav-item ${this.currentNav === 'attendance' ? 'active' : ''}`;
    }
    get staffNavClass() {
        return `nav-item ${this.currentNav === 'staff' ? 'active' : ''}`;
    }
    get attendanceReportNavClass() {
        return `nav-item ${this.currentNav === 'attendance_report' ? 'active' : ''}`;
    }
    get analyticsNavClass() {
        return `nav-item ${this.currentNav === 'analytics' ? 'active' : ''}`;
    }
    get schoolManagementNavClass() {
        return `nav-item ${this.currentNav === 'school_management' ? 'active' : ''}`;
    }
    get sidebarClass() {
        return `sidebar ${this.isSidebarOpen ? 'open' : ''}`;
    }
    get studentNavClass() {
        return `nav-item ${this.currentNav === 'student' ? 'active' : ''}`;
    }
    get promotionNavClass() {
        return `nav-item ${this.currentNav === 'promotion' ? 'active' : ''}`;
    }
    get gradesNavClass() {
        return `nav-item ${this.currentNav === 'grades' ? 'active' : ''}`;
    }
    get complaintBoxNavClass() {
        return `nav-item ${this.currentNav === 'complaintbox' ? 'active' : ''}`;
    }
    get setupNavClass() {
        return `nav-item ${this.currentNav === 'setup' ? 'active' : ''}`;
    }

    handleSearchChange(event) {
        this.searchTerm = event.target.value;
        if (this.searchTerm.length >= 2) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSearch();
            }, 300);
        } else {
            this.searchResults = [];
            this.showSearchDropdown = false;
        }
    }

    performSearch() {
        globalSearch({ searchTerm: this.searchTerm })
            .then(result => {
                this.searchResults = result.results || [];
                this.showSearchDropdown = this.searchResults.length > 0;
            })
            .catch(error => {
                console.error('Search error', error);
            });
    }

    handleSearchResultClick(event) {
        const id = event.currentTarget.dataset.id;
        const type = event.currentTarget.dataset.type;
        this.showSearchDropdown = false;
        this.searchTerm = '';

        if (type === 'student') {
            this.selectedStudentIdFromSearch = id;
            this.currentPage = 'student';
            this.currentNav = 'student';
        } else if (type === 'invoice') {
            const result = this.searchResults.find(r => r.id === id);
            if (result && result.studentId) {
                this.selectedStudentIdForBilling = result.studentId;
            }
            this.currentPage = 'paybill';
            this.currentNav = 'paybill';
        }
    }

    hideSearchDropdown() {
        setTimeout(() => {
            this.showSearchDropdown = false;
        }, 200);
    }

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
    }

    closeSidebar() {
        this.isSidebarOpen = false;
    }

    handleDashboardClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'dashboard';
        this.currentNav = 'dashboard';
        this.fetchMetrics();
        this.closeSidebar();
    }

    handleStudentClick(event) {
        if (event) event.preventDefault();
        this.selectedStudentIdFromSearch = null;
        this.currentPage = 'student';
        this.currentNav = 'student';
        this.closeSidebar();
    }

    handleStaffClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'staff';
        this.currentNav = 'staff';
        this.closeSidebar();
    }

    handleNewAdmission(event) {
        if (event) event.preventDefault();
        this.currentPage = 'admission';
        this.currentNav = 'admission';
        this.admissionActiveTab = 'admission';
        this.closeSidebar();
    }

    handleStudentAdmitted() {
        if (this.wiredMetricsResult) {
            refreshApex(this.wiredMetricsResult);
        }
    }

    handleImportStudents() {
        this.showBulkImport = true;
    }

    handleCloseBulkImport() {
        this.showBulkImport = false;
    }

    handleEnterMarksClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'entermarks';
        this.currentNav = 'entermarks';
        this.closeSidebar();
    }

    handlePayBill(event) {
        if (event) event.preventDefault();
        this.selectedStudentIdForBilling = event.detail?.studentId || null;
        this.currentPage = 'paybill';
        this.currentNav = 'paybill';
        this.closeSidebar();
    }

    handleExpenseClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'expense';
        this.currentNav = 'expense';
        this.closeSidebar();
    }

    handlePromotionClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'promotion';
        this.currentNav = 'promotion';
        this.closeSidebar();
    }

    handlePriceBookSetup(event) {
        if (event) event.preventDefault();
        this.currentPage = 'pricebook';
        this.currentNav = 'pricebook';
        this.closeSidebar();
    }

    handleAttendanceClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'attendance';
        this.currentNav = 'attendance';
        this.closeSidebar();
    }

    handleAttendanceReportClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'attendance_report';
        this.currentNav = 'attendance_report';
        this.closeSidebar();
    }

    handleAnalyticsClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'analytics';
        this.currentNav = 'analytics';
        this.closeSidebar();
    }

    handleSchoolManagementClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'school_management';
        this.currentNav = 'school_management';
        this.closeSidebar();
    }

    handleGradesClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'grades';
        this.currentNav = 'grades';
        this.closeSidebar();
    }

    handleComplaintBoxClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'complaintbox';
        this.currentNav = 'complaintbox';
        this.closeSidebar();
    }

    handleSetupClick(event) {
        if (event) event.preventDefault();
        this.currentPage = 'setup';
        this.currentNav = 'setup';
        this.closeSidebar();
    }

    handleSetupComplete() {
        if (this.wiredSetupResult) {
            refreshApex(this.wiredSetupResult).then(() => {
                this.currentPage = 'dashboard';
                this.currentNav = 'dashboard';
                this.closeSidebar();
            });
        }
    }

    handleExport() {
        console.log('Export clicked');
    }

    updateDisplayLists() {
        this.displayAdmissions = this.allAdmissions.slice(0, this.admissionsLimit);
        this.displayPayments = this.allPayments.slice(0, this.paymentsLimit);
    }

    get showMoreAdmissions() {
        return this.admissionsLimit < this.allAdmissions.length;
    }

    get showLessAdmissions() {
        return this.admissionsLimit > 5;
    }

    get showMorePayments() {
        return this.paymentsLimit < this.allPayments.length;
    }

    get showLessPayments() {
        return this.paymentsLimit > 5;
    }

    handleShowMoreAdmissions() {
        this.admissionsLimit += 5;
        this.updateDisplayLists();
    }

    handleShowLessAdmissions() {
        this.admissionsLimit -= 5;
        if (this.admissionsLimit < 5) this.admissionsLimit = 5;
        this.updateDisplayLists();
    }

    handleShowMorePayments() {
        this.paymentsLimit += 5;
        this.updateDisplayLists();
    }

    handleShowLessPayments() {
        this.paymentsLimit -= 5;
        if (this.paymentsLimit < 5) this.paymentsLimit = 5;
        this.updateDisplayLists();
    }
}