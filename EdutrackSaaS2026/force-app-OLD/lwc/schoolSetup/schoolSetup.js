import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getSetup from '@salesforce/apex/SchoolSetupController.getSetup';
import saveSetup from '@salesforce/apex/SchoolSetupController.saveSetup';
import uploadLogo from '@salesforce/apex/SchoolSetupController.uploadLogo';
import getBankAccounts from '@salesforce/apex/SchoolSetupController.getBankAccounts';
import saveBankAccounts from '@salesforce/apex/SchoolSetupController.saveBankAccounts';
import getAcademicYears from '@salesforce/apex/SchoolSetupController.getAcademicYears';
import saveAcademicYear from '@salesforce/apex/SchoolSetupController.saveAcademicYear';
import { refreshApex } from '@salesforce/apex';

export default class SchoolSetup extends LightningElement {
    @track schoolData = {
        schoolName: '',
        schoolEmail: '',
        schoolPhone: '',
        schoolLogo: '',
        schoolAddress: '',
        phonePeId: '',
        googlePayId: '',
        upiQrId: '',
        upiQrUrl: '',
        bankName: '',
        bankIfsc: '',
        bankAccountNumber: '',
        bankBranch: '',
        schoolSubtitle: ''
    };
    @track bankAccounts = [];
    @track deletedBankIds = [];
    @track academicYears = [];
    @track selectedYear = '';
    @track isYearActive = true;
    @track isLoading = false;
    @track isReadOnly = true;
    @track isSetupInitiallyDone = false;
    wiredSetupResult;
    wiredSetupResult;
    wiredAcademicYearsResult;

    @wire(getSetup)
    wiredSetup(result) {
        this.wiredSetupResult = result;
        const { data, error } = result;
        if (data) {
            this.schoolData = {
                schoolName: data.School_Name__c || '',
                schoolEmail: data.School_Email__c || '',
                schoolPhone: data.School_Phone__c || '',
                schoolLogo: data.School_Logo__c || '',
                schoolAddress: data.School_Address__c || '',
                phonePeId: data.PhonePe_ID__c || '',
                googlePayId: data.GooglePay_ID__c || '',
                upiQrId: data.UPI_QR_ID__c || '',
                upiQrUrl: data.UPI_QR_ID__c ? `/sfc/servlet.shepherd/version/download/${data.UPI_QR_ID__c}` : '',
                bankName: data.Bank_Name__c || '',
                bankIfsc: data.Bank_IFSC__c || '',
                bankAccountNumber: data.Bank_Account_Number__c || '',
                bankBranch: data.Bank_Branch__c || '',
                schoolSubtitle: data.School_Subtitle__c || ''
            };
            this.isSetupInitiallyDone = (data.Setup_Completed__c === true);
            this.isReadOnly = this.isSetupInitiallyDone;
        } else if (error) {
            console.error('Error loading setup', error);
        }
    }

    connectedCallback() {
        this.loadBankAccounts();
    }

    loadBankAccounts() {
        getBankAccounts()
            .then(data => {
                this.bankAccounts = (data || []).map(acc => ({
                    id: acc.Id,
                    name: acc.Name,
                    bankName: acc.Bank_Name__c,
                    ifsc: acc.IFSC_Code__c,
                    accountNumber: acc.Account_Number__c,
                    branch: acc.Branch__c || '',
                    isPrimary: acc.Is_Primary__c || false
                }));
                if (this.bankAccounts.length === 0 && !this.isReadOnly) {
                    this.addBankAccount();
                }
            })
            .catch(error => {
                console.error('Error loading bank accounts', error);
            });
    }

    @wire(getAcademicYears)
    wiredAcademicYears(result) {
        this.wiredAcademicYearsResult = result;
        if (result.data) {
            this.academicYears = result.data;
        }
    }


    get yearOptions() {
        const options = [];
        const currentYear = new Date().getFullYear();
        for (let i = 0; i < 10; i++) {
            const startYear = currentYear - 1 + i;
            const endYear = startYear + 1;
            const label = `${startYear}–${endYear}`;
            options.push({ label: label, value: label });
        }
        return options;
    }

    handleYearChange(event) {
        this.selectedYear = event.detail.value;
    }

    handleYearActiveChange(event) {
        this.isYearActive = event.target.checked;
    }

    saveYearConfiguration() {
        if (!this.selectedYear) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Please select an Academic Year range',
                variant: 'error'
            }));
            return;
        }

        this.isLoading = true;
        saveAcademicYear({ yearRange: this.selectedYear, isActive: this.isYearActive })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: 'Academic Year saved successfully',
                    variant: 'success'
                }));
                return refreshApex(this.wiredAcademicYearsResult);
            })
            .catch(error => {
                console.error('Error saving year', error);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleInputChange(event) {
        if (this.isReadOnly) return;
        const field = event.target.dataset.id;
        this.schoolData[field] = event.target.value;
    }

    handleEdit() {
        this.isReadOnly = false;
        if (this.bankAccounts.length === 0) {
            this.addBankAccount();
        }
    }

    handleCancel() {
        this.isReadOnly = true;
        refreshApex(this.wiredSetupResult);
        refreshApex(this.wiredBankAccountsResult);
    }

    addBankAccount() {
        this.bankAccounts = [...this.bankAccounts, {
            id: 'temp-' + Date.now(),
            name: '',
            bankName: '',
            ifsc: '',
            accountNumber: '',
            branch: '',
            isPrimary: this.bankAccounts.length === 0
        }];
    }

    removeBankAccount(event) {
        const id = event.target.dataset.id;
        if (id && !id.startsWith('temp-')) {
            this.deletedBankIds.push(id);
        }
        this.bankAccounts = this.bankAccounts.filter(acc => acc.id !== id);
    }

    handleBankInputChange(event) {
        const id = event.target.dataset.id;
        const field = event.target.dataset.field;
        const val = event.target.type === 'checkbox' ? event.target.checked : event.target.value;

        this.bankAccounts = this.bankAccounts.map(acc => {
            if (acc.id === id) {
                return { ...acc, [field]: val };
            }
            if (field === 'isPrimary' && val === true) {
                return { ...acc, isPrimary: false };
            }
            return acc;
        });
    }

    handleRemoveFile(event) {
        if (this.isReadOnly) return;
        const type = event.target.dataset.type;
        if (type === 'qr') {
            this.schoolData.upiQrId = '';
            this.schoolData.upiQrUrl = '';
        } else {
            this.schoolData.schoolLogo = '';
        }
    }

    handleFileSelect(event) {
        if (this.isReadOnly) return;
        const file = event.target.files[0];
        const type = event.target.dataset.type; // 'logo' or 'qr'
        if (!file) return;

        this.isLoading = true;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            uploadLogo({ base64Data: base64, fileName: file.name })
                .then(versionId => {
                    const downloadUrl = `/sfc/servlet.shepherd/version/download/${versionId}`;
                    if (type === 'qr') {
                        this.schoolData.upiQrId = versionId;
                        this.schoolData.upiQrUrl = downloadUrl;
                    } else {
                        this.schoolData.schoolLogo = downloadUrl;
                    }
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: `${type === 'qr' ? 'QR Code' : 'Logo'} uploaded successfully`,
                            variant: 'success'
                        })
                    );
                })
                .catch(error => {
                    console.error('Error uploading file', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        };
        reader.readAsDataURL(file);
    }

    handleSave() {
        if (!this.schoolData.schoolName) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: 'School Name is required',
                    variant: 'error'
                })
            );
            return;
        }

        // Bank Detail Validation (Net Banking)
        const hasMissingBankDetails = this.bankAccounts.some(acc => 
            !acc.bankName || !acc.accountNumber || !acc.ifsc
        );

        if (hasMissingBankDetails) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Please set up your account details',
                message: 'All bank accounts must have Bank Name, Account Number, and IFSC Code filled.',
                variant: 'warning'
            }));
            return;
        }

        this.isLoading = true;

        // Prepare bank accounts for Apex (mapping back to object fields)
        const accountsToSave = this.bankAccounts.map(acc => ({
            Id: acc.id.startsWith('temp-') ? null : acc.id,
            Name: acc.name || (acc.bankName + ' - ' + acc.accountNumber.slice(-4)),
            Bank_Name__c: acc.bankName,
            IFSC_Code__c: acc.ifsc,
            Account_Number__c: acc.accountNumber,
            Branch__c: acc.branch,
            Is_Primary__c: acc.isPrimary
        }));

        Promise.all([
            saveSetup({ setupData: this.schoolData }),
            saveBankAccounts({ 
                accountsData: accountsToSave, 
                deleteIds: this.deletedBankIds 
            })
        ])
            .then(() => {
                this.deletedBankIds = []; // Clear after success
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'School configuration saved successfully',
                        variant: 'success'
                    })
                );
                this.isReadOnly = true;
                this.isSetupInitiallyDone = true;
                refreshApex(this.wiredSetupResult);
                this.loadBankAccounts();
            })
            .then(() => {
                // Dispatch event to parent to refresh and navigate
                this.dispatchEvent(new CustomEvent('setupcomplete'));
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body ? error.body.message : error.message,
                        variant: 'error'
                    })
                );
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
}