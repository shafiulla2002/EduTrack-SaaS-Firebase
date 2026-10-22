import { LightningElement, track, wire, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import STATE_FIELD from '@salesforce/schema/Account.State__c';
import COUNTRY_FIELD from '@salesforce/schema/Account.Country__c';

import getActiveProducts from '@salesforce/apex/AdmissionController.getActiveProducts';
import createAdmission from '@salesforce/apex/AdmissionController.createAdmission';
import getClassOptions from '@salesforce/apex/AdmissionController.getClassOptions';
import getAcademicYearOptions from '@salesforce/apex/AdmissionController.getAcademicYearOptions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AdmissionManager extends NavigationMixin(LightningElement) {
    // Version 2.2 - Dynamic Enrollment Options
    @api
    get activeTab() {
        return this._activeTab;
    }
    set activeTab(value) {
        if (value) {
            this._activeTab = value;
        }
    }
    @track _activeTab = 'admission';
    @track currentStep = '1';
    @track isLoading = false;

    // Admission Flow Data
    @track lastAccountId;
    @track availableProducts = [];
    @track selectedProductIds = [];
    @track tempStudent = {
        firstName: '',
        lastName: '',
        fatherName: '',
        motherName: '',
        dob: '',
        phone: '',
        emergencyContact: '',
        email: '',
        aadharNo: '',
        village: '',
        city: '',
        pincode: '',
        state: '',
        country: '',
        selectedClass: '',
        selectedSection: '',
        academicYear: ''
    };
    @track concessionAmount = 0;
    @track concessionPercent = 0;

    // Options
    // Options (Populated via Wires)
    @track yearOptions = [];
    @track classOptions = [];
    @track sectionOptions = [
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'C', value: 'C' },
        { label: 'D', value: 'D' },
        { label: 'E', value: 'E' }
    ];

    // Picklist Options
    @track stateOptions = [];
    @track countryOptions = [];

    @wire(getAcademicYearOptions)
    wiredYears({ error, data }) {
        if (data) {
            this.yearOptions = data;
        } else if (error) {
            console.error('Error loading academic years:', error);
        }
    }

    @wire(getClassOptions)
    wiredClasses({ error, data }) {
        if (data) {
            this.classOptions = data.map(className => ({ label: className, value: className }));
        } else if (error) {
            console.error('Error loading classes:', error);
        }
    }

    @wire(getActiveProducts, { className: '$tempStudent.selectedClass', academicYearId: '$tempStudent.academicYear' })
    wiredProducts({ error, data }) {
        if (data) {
            this.availableProducts = data;
        } else if (error) {
            this.availableProducts = [];
        }
    }

    @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT })
    accountInfo;

    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: STATE_FIELD })
    wiredStateValues({ error, data }) {
        if (data) {
            this.stateOptions = data.values;
        } else if (error) {
            console.error('Error fetching state picklist:', error);
        }
    }

    @wire(getPicklistValues, { recordTypeId: '012000000000000AAA', fieldApiName: COUNTRY_FIELD })
    wiredCountryValues({ error, data }) {
        if (data) {
            this.countryOptions = data.values;
        } else if (error) {
            console.error('Error fetching country picklist:', error);
        }
    }

    // Computed Properties for UI
    get nameInitials() {
        const fn = this.tempStudent.firstName || '?';
        const ln = this.tempStudent.lastName || '';
        return (fn[0] + (ln ? ln[0] : '')).toUpperCase();
    }

    get stepTitle() {
        const titles = ['Student Admission', 'Academic Details', 'Fee Structure', 'Review & Submit'];
        const idx = parseInt(this.currentStep) - 1;
        return isNaN(idx) ? 'Admission Complete' : titles[idx];
    }

    get stepSubtitle() {
        const subs = [
            'Step 1 of 4 · Personal & address information',
            'Step 2 of 4 · Class and year selection',
            'Step 3 of 4 · Choose applicable fee items',
            'Step 4 of 4 · Verify and confirm admission'
        ];
        const idx = parseInt(this.currentStep) - 1;
        return isNaN(idx) ? 'Record created · Awaiting fee payment' : subs[idx];
    }

    get step1Display() { return parseInt(this.currentStep) > 1 ? '' : '1'; }
    get step2Display() { return parseInt(this.currentStep) > 2 ? '' : '2'; }
    get step3Display() { return parseInt(this.currentStep) > 3 ? '' : '3'; }
    get step4Display() { return this.currentStep === 'success' ? '' : '4'; }

    get step1Class() { return `step-item ${parseInt(this.currentStep) > 1 ? 'done' : (this.currentStep === '1' ? 'active' : '')}`; }
    get step2Class() { return `step-item ${parseInt(this.currentStep) > 2 ? 'done' : (this.currentStep === '2' ? 'active' : '')}`; }
    get step3Class() { return `step-item ${parseInt(this.currentStep) > 3 ? 'done' : (this.currentStep === '3' ? 'active' : '')}`; }
    get step4Class() { return `step-item ${this.currentStep === 'success' ? 'done' : (this.currentStep === '4' ? 'active' : '')}`; }

    get connector1Class() { return `step-connector ${parseInt(this.currentStep) > 1 ? 'done' : ''}`; }
    get connector2Class() { return `step-connector ${parseInt(this.currentStep) > 2 ? 'done' : ''}`; }
    get connector3Class() { return `step-connector ${parseInt(this.currentStep) > 3 ? 'done' : ''}`; }

    get pane1Class() { return `step-pane ${this.currentStep === '1' ? 'active' : ''}`; }
    get pane2Class() { return `step-pane ${this.currentStep === '2' ? 'active' : ''}`; }
    get pane3Class() { return `step-pane ${this.currentStep === '3' ? 'active' : ''}`; }
    get pane4Class() { return `step-pane ${this.currentStep === '4' ? 'active' : ''}`; }
    get paneSuccessClass() { return `step-pane ${this.currentStep === 'success' ? 'active' : ''}`; }

    get isFirstStep() { return this.currentStep === '1'; }
    get showNavigationButtons() { return this.currentStep !== 'success'; }

    get nextButtonLabel() {
        if (this.currentStep === '4') return 'Confirm Admission';
        return 'Continue';
    }

    get stepProgressStyle() {
        const steps = this.currentStep === 'success' ? 4 : parseInt(this.currentStep);
        return `width: ${(steps / 4) * 100}%`;
    }

    get selectedYearName() {
        if (!this.tempStudent.academicYear || !this.yearOptions) return 'Not Selected';
        const found = this.yearOptions.find(opt => opt.value === this.tempStudent.academicYear);
        return found ? found.label : this.tempStudent.academicYear;
    }

    get hasProducts() {
        return this.availableProducts && this.availableProducts.length > 0;
    }

    get displayProducts() {
        if (!this.availableProducts) return [];
        return this.availableProducts.map(p => ({
            ...p,
            wrapperClass: `fee-card ${this.selectedProductIds.includes(p.Id) ? 'selected' : ''}`
        }));
    }

    get selectedServiceDetails() {
        if (!this.availableProducts || !this.selectedProductIds) return [];
        return this.availableProducts
            .filter(p => this.selectedProductIds.includes(p.Id))
            .map(p => ({
                id: p.Id,
                name: p.Product2.Name,
                price: p.UnitPrice
            }));
    }

    get selectedServicesTotal() {
        return this.selectedServiceDetails.reduce((sum, item) => sum + item.price, 0);
    }

    get netFeeTotal() {
        const total = this.selectedServicesTotal;
        const concession = parseFloat(this.concessionAmount) || 0;
        return Math.max(0, total - concession);
    }

    get concessionSummary() {
        const total = this.selectedServicesTotal;
        const concession = parseFloat(this.concessionAmount) || 0;
        const net = this.netFeeTotal;
        if (total === 0) return '';
        return `₹ ${total.toLocaleString()} - ₹ ${concession.toLocaleString()} = ₹ ${net.toLocaleString()}`;
    }

    // Select classes for styling
    get stateSelectClass() { return this.tempStudent.state ? 'has-value' : ''; }
    get countrySelectClass() { return this.tempStudent.country ? 'has-value' : ''; }
    get classSelectClass() { return this.tempStudent.selectedClass ? 'has-value' : ''; }
    get sectionSelectClass() { return this.tempStudent.selectedSection ? 'has-value' : ''; }
    get yearSelectClass() { return this.tempStudent.academicYear ? 'has-value' : ''; }

    // Handlers
    handleInputChange(event) {
        const field = event.target.name;
        const val = event.target.value;

        if (field === 'selectedClass' && this.tempStudent.selectedClass !== val) {
            this.selectedProductIds = [];
        }

        this.tempStudent = { ...this.tempStudent, [field]: val };
    }

    handleNext() {
        // Scope validation to the active step's pane
        const activePane = this.template.querySelector('.step-pane.active');
        if (!activePane) return;

        if (this.currentStep === '1' || this.currentStep === '2') {
            const inputs = activePane.querySelectorAll('input, select');
            let isValid = true;
            inputs.forEach(input => {
                if (!input.checkValidity()) {
                    input.reportValidity();
                    isValid = false;
                }
            });
            if (isValid) {
                this.currentStep = (parseInt(this.currentStep) + 1).toString();
            }
        } else if (this.currentStep === '3') {
            this.currentStep = '4';
        } else if (this.currentStep === '4') {
            this.processAdmission();
        }
    }

    handleBack() {
        this.currentStep = String(parseInt(this.currentStep) - 1);
    }

    handleProductCardClick(event) {
        const id = event.currentTarget.dataset.id;
        if (this.selectedProductIds.includes(id)) {
            this.selectedProductIds = this.selectedProductIds.filter(item => item !== id);
        } else {
            this.selectedProductIds = [...this.selectedProductIds, id];
        }
    }

    handleConcessionChange(event) {
        this.concessionAmount = event.target.value;
        const total = this.selectedServicesTotal;
        if (total > 0) {
            this.concessionPercent = ((parseFloat(this.concessionAmount) || 0) / total * 100).toFixed(2);
        } else {
            this.concessionPercent = 0;
        }
    }

    handleConcessionPercentChange(event) {
        this.concessionPercent = event.target.value;
        const total = this.selectedServicesTotal;
        this.concessionAmount = Math.round((total * (parseFloat(this.concessionPercent) || 0)) / 100);
    }

    async processAdmission() {
        this.isLoading = true;
        try {
            const result = await createAdmission({
                studentData: this.tempStudent,
                selectedPricebookEntryIds: this.selectedProductIds,
                concessionAmount: parseFloat(this.concessionAmount) || 0
            });
            this.lastAccountId = result.accountId;
            this.showToast('Success', 'Admission process completed successfully!', 'success');
            this.dispatchEvent(new CustomEvent('studentadmitted', {
                bubbles: true,
                composed: true
            }));
            this.currentStep = 'success';
        } catch (error) {
            this.showToast('Error', error, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handlePayNow() {
        this.dispatchEvent(new CustomEvent('navtopaybill', {
            detail: { studentId: this.lastAccountId },
            bubbles: true,
            composed: true
        }));
    }

    handleNewAdmissionAction() {
        this.currentStep = '1';
        this.selectedProductIds = [];
        this.concessionAmount = 0;
        this.concessionPercent = 0;
        this.tempStudent = {
            firstName: '',
            lastName: '',
            fatherName: '',
            motherName: '',
            dob: '',
            phone: '',
            emergencyContact: '',
            email: '',
            aadharNo: '',
            village: '',
            city: '',
            pincode: '',
            state: '',
            country: '',
            selectedClass: '',
            selectedSection: '',
            academicYear: ''
        };
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