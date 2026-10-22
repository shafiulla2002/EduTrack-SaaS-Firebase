import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';

// Apex Imports
import searchStudents from '@salesforce/apex/AdmissionController.searchStudents';
import getStudentById from '@salesforce/apex/AdmissionController.getStudentById';
import getUnpaidFees from '@salesforce/apex/AdmissionController.getUnpaidFees';
import createInvoice from '@salesforce/apex/AdmissionController.createInvoice';
import getRecentInvoices from '@salesforce/apex/AdmissionController.getRecentInvoices';
import voidInvoice from '@salesforce/apex/AdmissionController.voidInvoice';
import getQRCodeBase64 from '@salesforce/apex/AdmissionController.getQRCodeBase64';
import getAcademicYearOptions from '@salesforce/apex/AdmissionController.getAcademicYearOptions';
import getVFPageUrl from '@salesforce/apex/NamespaceUtils.getVFPageUrl';
import getSetup from '@salesforce/apex/SchoolSetupController.getSetup';
import getBankAccounts from '@salesforce/apex/SchoolSetupController.getBankAccounts';

// SVG Assets from vikas-fee-billing.html
const PHONEPE_SVG = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#5f259f"/><g fill="white"><path d="M35 38h30v4H35z"/><path d="M39 38v11c0 5 4 8 9 8h2V38h-11z"/><path d="M51 38v24h4V38h-4z"/><path d="M51 38L41 26h-4l10 12z"/></g></svg>`;
const GPAY_SVG = `<svg viewBox="0 0 56 24"><path d="M10.12 11.23v2.85h4.55c-.18 1.05-.72 1.94-1.61 2.53v2.09h2.61c1.52-1.4 2.4-3.47 2.4-5.94 0-.54-.05-1.06-.15-1.53H10.12z" fill="#4285F4"/><path d="M10.12 17.5c-2.3 0-4.24-1.56-4.94-3.66H2.52v2.13c1.4 2.78 4.28 4.68 7.6 4.68 1.96 0 3.61-.65 4.81-1.76l-2.61-2.09c-.59.4-1.38.74-2.2.74z" fill="#34A853"/><path d="M5.18 13.84c-.38-.59-.59-1.28-.59-2.01s.21-1.42.59-2.01V7.7H2.52C1.61 9.5 1.1 11.53 1.1 13.67s.51 4.17 1.42 5.97L5.18 13.84z" fill="#FBBC05"/><path d="M10.12 6.67c1.1 0 2.08.38 2.85 1.12l2.13-2.13c-1.29-1.2-2.98-1.93-4.98-1.93-3.32 0-6.2 1.9-7.6 4.68l2.66 2.13c.7-2.1 2.64-3.66 4.94-3.66z" fill="#EA4335"/><text x="22" y="17" font-family="Arial" font-weight="bold" font-size="10" fill="#5F6368">Pay</text></svg>`;
const NETBANKING_SVG = `<span style="font-size:2.2rem">🏦</span>`;
const CASH_SVG = `<span style="font-size:2.2rem">💵</span>`;

const PAYMENT_DATA = [
    { label: 'PhonePe', value: 'PhonePe', svg: PHONEPE_SVG },
    { label: 'Google Pay', value: 'Google Pay', svg: GPAY_SVG },
    { label: 'Net Banking', value: 'Net Banking', svg: NETBANKING_SVG },
    { label: 'Cash', value: 'Cash', svg: CASH_SVG }
];

export default class PayTheBill extends NavigationMixin(LightningElement) {
    // Version 3.0 - Visual Polish Applied - Force Refresh
    @track isLoading = false;

    // Billing Flow Data
    @track studentsFound = [];
    @track selectedStudentId;

    _studentId;
    @api
    get studentId() {
        return this._studentId;
    }
    set studentId(value) {
        this._studentId = value;
        if (value) {
            this.loadStudentData(value);
        }
    }

    @track selectedStudentName;
    @track unpaidFees = null;
    @track tempOppId;
    @track billingTotal = 0;
    @track lastInvoiceId;
    @track recentInvoices = [];
    @track selectedPaymentMethod = 'Cash'; // Default to Cash
    @track selectedBankId = '';
    @track qrCodeBase64 = '';
    @track dynamicQrUrl = '';
    @track rawUpiUrl = '';      // For diagnostics
    @track isQRLoading = false;
    @track studentTotalPaid = 0;
    @track studentTotalPending = 0;
    @track academicYearOptions = [];
    @track selectedAcademicYear;
    searchDelayTimer;

    // School Config
    @track schoolConfig = {};
    @track schoolBankAccounts = [];
    @wire(getSetup)
    wiredSchoolSetup({ error, data }) {
        if (data) {
            this.schoolConfig = data;
            if (this.isUPISelected) this.generateQRCode();
        }
    }

    connectedCallback() {
        this.loadBankAccounts();
    }

    loadBankAccounts() {
        getBankAccounts()
            .then(data => {
                console.log('Bank accounts fetched:', JSON.stringify(data));
                this.schoolBankAccounts = data || [];
            })
            .catch(error => {
                console.error('Error fetching school banks', error);
            });
    }

    get schoolName() {
        return this.schoolConfig.School_Name__c || 'VIKAS HIGH SCHOOL';
    }

    bankOptions = [
        { id: 'SBI', name: 'State Bank of India' },
        { id: 'HDFC', name: 'HDFC Bank' },
        { id: 'ICICI', name: 'ICICI Bank' },
        { id: 'AXIS', name: 'Axis Bank' },
        { id: 'OTHER', name: 'Other / Manual Entry' }
    ];

    @track netBankingDetails = {
        bankName: '',
        bankIfsc: '',
        bankAccountNumber: '',
        bankBranch: ''
    };

    // Unified Year Data for Mapping
    @track allYears = [];
    @wire(getAcademicYearOptions)
    wiredAllYears({ error, data }) {
        if (data) {
            this.allYears = data;
            // Force refresh of options if student is already loaded
            if (this.unpaidFees || (this.academicYearOptions && this.academicYearOptions.length > 0)) {
                this.refreshYearLabels();
            }
        }
    }

    refreshYearLabels() {
        if (!this.academicYearOptions || !this.allYears.length) return;
        this.academicYearOptions = this.academicYearOptions.map(opt => {
            // value in academicYearOptions is the Opportunity ID, but we need to find 
            // the year name for the year stored on that opportunity.
            // Wait, I don't have the original year IDs here easily.
            // Let's re-run loadStudentData if possible, or just re-map if we store the raw results.
            return opt;
        });
        // Simplest: just re-trigger loadStudentData if student is selected
        if (this.selectedStudentId && !this.isLoading) {
            this.loadStudentData(this.selectedStudentId);
        }
    }

    // Render SVG logic safely
    renderedCallback() {
        const containers = this.template.querySelectorAll('div[data-svg]');
        containers.forEach(container => {
            const svgContent = container.getAttribute('data-svg');
            if (svgContent && container.innerHTML !== svgContent) {
                container.innerHTML = svgContent;
            }
        });
    }

    // UI Getter for Payment Options
    get paymentOptions() {
        return PAYMENT_DATA.map(channel => ({
            ...channel,
            selected: this.selectedPaymentMethod === channel.value,
            className: `pay-card ${this.selectedPaymentMethod === channel.value ? 'active' : ''}`
        }));
    }

    get selectedPaymentLogo() {
        return PAYMENT_DATA.find(p => p.value === this.selectedPaymentMethod)?.svg || '';
    }

    // Computed Properties
    get upiIdUsed() {
        if (!this.schoolConfig) return 'Loading settings... [V5]';
        const id = this.selectedPaymentMethod === 'PhonePe'
            ? this.schoolConfig.PhonePe_ID__c
            : this.schoolConfig.GooglePay_ID__c;
        return (id || 'NOT SET IN SCHOOL SETUP') + ' [V5]';
    }

    get isUPISelected() {
        return this.selectedPaymentMethod === 'PhonePe' || this.selectedPaymentMethod === 'Google Pay';
    }

    get isNetBankingSelected() {
        return this.selectedPaymentMethod === 'Net Banking';
    }

    get showQRSection() {
        return this.isUPISelected && parseFloat(this.billingTotal) > 0;
    }

    get isQrMissing() {
        return this.isUPISelected && !this.schoolConfig.UPI_QR_ID__c;
    }

    get uploadedQrUrl() {
        return this.schoolConfig.UPI_QR_ID__c ? `/sfc/servlet.shepherd/version/download/${this.schoolConfig.UPI_QR_ID__c}` : '';
    }

    get qrCodeUrl() {
        if (this.uploadedQrUrl) {
            return this.uploadedQrUrl;
        }
        if (this.isUPISelected) {
            if (this.qrCodeBase64) return `data:image/png;base64,${this.qrCodeBase64}`;
            return this.dynamicQrUrl || '';
        }
        return '';
    }

    get formattedInversePending() {
        return this.studentTotalPending.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    }

    get formattedBillingTotal() {
        return this.studentTotalPending.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    }

    get formattedTotalPaid() {
        return this.studentTotalPaid.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    }

    get settlementTotal() {
        return parseFloat(this.billingTotal).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    }

    get discountHeader() {
        if (!this.unpaidFees || this.unpaidFees.length === 0) return 'DISCOUNT';
        const firstDiscount = this.unpaidFees[0].discountPercent;
        const allSame = this.unpaidFees.every(f => f.discountPercent === firstDiscount);
        if (allSame && firstDiscount > 0) {
            return `DISCOUNT (${firstDiscount}%)`;
        }
        return 'DISCOUNT';
    }

    get showSearchPrompt() {
        return !this.studentsFound.length && !this.selectedStudentId;
    }

    async generateQRCode() {
        if (!this.isUPISelected || parseFloat(this.billingTotal) <= 0) {
            this.qrCodeBase64 = '';
            this.dynamicQrUrl = '';
            return;
        }

        const payeeAddress = this.selectedPaymentMethod === 'PhonePe'
            ? this.schoolConfig.PhonePe_ID__c
            : this.schoolConfig.GooglePay_ID__c;

        if (!payeeAddress) {
            console.warn('No UPI ID found for ' + this.selectedPaymentMethod);
            this.qrCodeBase64 = '';
            this.dynamicQrUrl = '';
            this.isQRLoading = false;
            return;
        }

        const payeeName = this.schoolName.toUpperCase();
        this.isQRLoading = true;
        
        const amount = this.billingTotal || 0;
        
        // ULTA-ROBUST: Minimal parameters, no PN/TN (avoids encoding issues), with cache-busting
        const upiUrl = `upi://pay?pa=${payeeAddress}&am=${amount}&cu=INR`;
        this.rawUpiUrl = upiUrl;
        const timestamp = Date.now();
        this.dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiUrl)}&ts=${timestamp}`;

        try {
            // We fetch it via Apex to avoid CSP issues in some orgs, but we'll also have the URL ready as fallback
            this.qrCodeBase64 = await getQRCodeBase64({ qrUrl: this.dynamicQrUrl });
        } catch (error) {
            console.error('QR Fetch Error:', error);
            // If Apex fails, the getter will fallback to the direct URL if CSP allows
        } finally {
            this.isQRLoading = false;
        }
    }

    get bankOptionsDisplay() {
        if (this.schoolBankAccounts && this.schoolBankAccounts.length > 0) {
            return this.schoolBankAccounts.map(acc => ({
                id: acc.Id,
                name: acc.Bank_Name__c,
                label: acc.Bank_Name__c + ' (' + acc.Account_Number__c.slice(-4) + ')',
                initials: this.getInitials(acc.Bank_Name__c),
                className: `bank-card ${this.selectedBankId === acc.Id ? 'active' : ''}`,
                details: acc
            }));
        }
        return [];
    }

    get selectedBankDetails() {
        return this.netBankingDetails;
    }

    handleBankInputChange(event) {
        const field = event.target.dataset.id;
        this.netBankingDetails[field] = event.target.value;
    }

    handleBankSelect(event) {
        const bankId = event.currentTarget.dataset.id;
        console.log('Bank Selected ID:', bankId, 'Length:', bankId ? bankId.length : 0);
        this.selectedBankId = bankId;
        
        // Robust ID matching (handles 15 vs 18 chars)
        const selectedAcc = this.schoolBankAccounts.find(acc => 
            acc.Id === bankId || 
            (acc.Id && bankId && (acc.Id.startsWith(bankId) || bankId.startsWith(acc.Id)))
        );
        
        console.log('Found account match:', !!selectedAcc);
        if (selectedAcc) {
            console.log('Account data:', JSON.stringify(selectedAcc));
            // Map with fallbacks for casing/namespace stripping variations
            this.netBankingDetails = {
                bankName: selectedAcc.Bank_Name__c || selectedAcc.bankName || selectedAcc.Name || '',
                bankIfsc: selectedAcc.IFSC_Code__c || selectedAcc.ifsc || selectedAcc.IFSC__c || '',
                bankAccountNumber: selectedAcc.Account_Number__c || selectedAcc.accountNumber || '',
                bankBranch: selectedAcc.Branch__c || selectedAcc.branch || ''
            };
            console.log('Final mapping to netBankingDetails:', JSON.stringify(this.netBankingDetails));
        } else {
            console.warn('No matching account found for ID - verifying all schoolBankAccounts IDs:');
            this.schoolBankAccounts.forEach(acc => console.log('Existing ID:', acc.Id));
            
            this.netBankingDetails = { bankName: '', bankIfsc: '', bankAccountNumber: '', bankBranch: '' };
        }
    }

    // Helper to get initials
    getInitials(name) {
        if (!name) return '';
        const names = name.split(' ');
        if (names.length > 1) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return (names[0][0] + (names[0][1] || '')).toUpperCase();
    }

    async handleStudentSearch(event) {
        const searchTerm = event.target.value;

        // Clear existing timer
        window.clearTimeout(this.searchDelayTimer);

        if (!searchTerm || searchTerm.length < 3) {
            this.studentsFound = [];
            return;
        }

        // Set new timer for debounce (300ms)
        this.searchDelayTimer = window.setTimeout(async () => {
            try {
                const result = await searchStudents({ searchTerm: searchTerm, timestamp: Date.now() });
                this.studentsFound = (result || []).map(s => {
                    const isPaid = (s.totalPendingBalance || 0) <= 0;
                    return {
                        ...s,
                        Id: s.account.Id,
                        nameInitials: this.getInitials(s.account.Name),
                        formattedDue: (s.totalPendingBalance || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                    };
                });
            } catch (error) {
                console.error('Search error:', error);
                this.studentsFound = [];
            }
        }, 300);
    }

    async selectStudent(event) {
        const id = event.currentTarget.dataset.id;
        this.loadStudentData(id);
    }

    handleClearSelection() {
        this.selectedStudentId = null;
        this.studentsFound = [];
        this.unpaidFees = null;
        this.recentInvoices = [];
        this.selectedAcademicYear = null;
        this.academicYearOptions = [];
    }

    handleYearChange(event) {
        this.selectedAcademicYear = event.detail.value;
        this.loadStudentData(this.selectedStudentId);
    }

    async loadStudentData(studentId) {
        this.isLoading = true;
        try {
            const result = await getStudentById({ studentId: studentId, timestamp: Date.now() });
            if (this.selectedStudentId !== studentId) {
                this.lastInvoiceId = null;
            }
            this.selectedStudentId = studentId;
            this.selectedStudentName = result.account.Name;
            this.studentTotalPaid = result.totalPaidAmount || 0;
            this.studentTotalPending = result.totalPendingBalance || 0;
            this.studentsFound = [];
            this.fetchRecentInvoices();

            if (result.account.Opportunities && result.account.Opportunities.length > 0) {
                // Populate Academic Year options
                this.academicYearOptions = result.account.Opportunities.map(opp => {
                    const yearId = opp.Academic_Year__c;
                    const yearMatch = this.allYears.find(y => y.value === yearId);
                    return {
                        label: yearMatch ? yearMatch.label : (yearId || 'Unnamed Year'),
                        value: opp.Id
                    };
                });

                // Default to the first (newest) opportunity if not already set or if switching student
                if (!this.selectedAcademicYear || !this.academicYearOptions.find(opt => opt.value === this.selectedAcademicYear)) {
                    this.selectedAcademicYear = result.account.Opportunities[0].Id;
                }

                this.tempOppId = this.selectedAcademicYear;
                const fees = await getUnpaidFees({ opportunityId: this.tempOppId });
                this.unpaidFees = fees && fees.length > 0 ? fees.map(f => ({
                    ...f,
                    feeName: f.productName,
                    isSelected: false,
                    paymentAmount: f.balanceDue,
                    isInputDisabled: true,
                    rowClass: f.balanceDue > 0 ? '' : 'paid-row',
                    totalAmount: f.totalAmount, // Gross Amount
                    discountAmount: f.discountAmount || 0,
                    discountPercent: f.discountPercent || 0,
                    showRowPercent: false, // Will calculate this dynamically or just hide if header has it
                    netAmount: f.netAmount,     // Post-discount total
                    paidAmount: f.paidAmount,
                    isPaid: f.balanceDue <= 0
                })) : null;
                this.calculateBillingTotal();
            } else {
                this.unpaidFees = null;
                this.showToast('Requirement', 'No active admission opportunity exists for this student.', 'info');
            }
        } catch (error) {
            console.error(error);
            this.showToast('Load Failed', 'Could not retrieve student details.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async updateStudentBalances(studentId) {
        try {
            await getStudentById({ studentId: studentId, timestamp: Date.now() });
            // Refresh logic handles via re-fetch mostly
        } catch (error) {
            console.error('Error updating balances:', error);
        }
    }

    handleFeeSelect(event) {
        const id = event.target.dataset.id;
        const checked = event.target.checked;

        this.unpaidFees = this.unpaidFees.map(f => {
            if (f.oliId === id) {
                return { ...f, isSelected: checked, isInputDisabled: !checked };
            }
            return f;
        });
        this.calculateBillingTotal();
    }

    handleAmountChange(event) {
        const id = event.target.dataset.id;
        const val = parseFloat(event.target.value) || 0;

        this.unpaidFees = this.unpaidFees.map(f => {
            if (f.oliId === id) {
                const safeVal = Math.min(val, f.balanceDue);
                return { ...f, paymentAmount: safeVal };
            }
            return f;
        });
        this.calculateBillingTotal();
    }

    calculateBillingTotal() {
        if (!this.unpaidFees) {
            this.billingTotal = (0).toFixed(2);
            return;
        }
        const total = this.unpaidFees
            .filter(f => f.isSelected)
            .reduce((sum, f) => sum + (f.paymentAmount || 0), 0);
        this.billingTotal = total.toFixed(2);
        this.generateQRCode();
    }

    handlePaymentMethodSelect(event) {
        const val = event.currentTarget.dataset.value;
        if (val) {
            this.selectedPaymentMethod = val;
            this.selectedBankId = '';
            if (val === 'Net Banking') {
                this.loadBankAccounts();
            }
            this.generateQRCode();
        }
    }


    async handleSubmitPayment() {
        if (!this.billingTotal || parseFloat(this.billingTotal) <= 0) {
            this.showToast('Invalid Amount', 'Please select at least one fee item to pay.', 'warning');
            return;
        }

        const result = await LightningConfirm.open({
            message: `Process payment of ₹${this.billingTotal} via ${this.selectedPaymentMethod}?`,
            variant: 'headerless',
            label: 'Confirm Payment',
            theme: 'info'
        });

        if (!result) return;

        this.isLoading = true;
        const selectedItems = this.unpaidFees
            .filter(f => f.isSelected)
            .map(f => ({
                oliId: f.oliId,
                productId: f.productId,
                amount: f.paymentAmount
            }));

        try {
            const invoiceId = await createInvoice({
                opportunityId: this.tempOppId,
                studentId: this.selectedStudentId,
                selectedItems: selectedItems,
                paymentMethod: this.selectedPaymentMethod,
                bankDetails: this.isNetBankingSelected ? this.netBankingDetails : null
            });
            this.lastInvoiceId = invoiceId;
            this.showToast('Success', 'Payment processed and invoice generated.', 'success');
            this.fetchRecentInvoices();
            await this.loadStudentData(this.selectedStudentId); // Reload to refresh fees
        } catch (error) {
            this.showToast('Payment Failed', error, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async openInvoicePreview(event) {
        const invoiceId = event?.currentTarget?.dataset?.id || this.lastInvoiceId;
        if (!invoiceId) {
            this.showToast('Note', 'No invoice available to preview.', 'info');
            return;
        }
        try {
            const url = await getVFPageUrl({ pageName: 'AdmissionInvoice', queryParams: `id=${invoiceId}&preview=true` });
            window.open(url, '_blank');
        } catch (e) {
            // Fallback to direct URL if Apex call fails
            window.open(`/apex/AdmissionInvoice?id=${invoiceId}&preview=true`, '_blank');
        }
    }

    async fetchRecentInvoices() {
        if (!this.selectedStudentId) return;
        try {
            this.recentInvoices = await getRecentInvoices({ studentId: this.selectedStudentId });
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    }

    async handleCancelInvoice(event) {
        const invoiceId = event.currentTarget.dataset.id;
        const invoiceName = event.currentTarget.dataset.name;

        const result = await LightningConfirm.open({
            message: `Are you sure you want to ROLLBACK / CANCEL invoice ${invoiceName}? This will restore the student's balance.`,
            variant: 'header',
            label: 'Rollback Confirmation',
            theme: 'warning'
        });

        if (!result) return;

        this.isLoading = true;
        try {
            await voidInvoice({ invoiceId: invoiceId });
            this.showToast('Success', 'Payment rolled back and balance restored.', 'success');

            await this.fetchRecentInvoices();
            await this.loadStudentData(this.selectedStudentId); // Reload to refresh fees
        } catch (error) {
            this.showToast('Rollback Failed', error, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        const msg = (message && typeof message === 'object') ? (message.body ? message.body.message : (message.message || 'Unknown error')) : message;
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: msg || 'An error occurred',
            variant: variant
        }));
    }
}