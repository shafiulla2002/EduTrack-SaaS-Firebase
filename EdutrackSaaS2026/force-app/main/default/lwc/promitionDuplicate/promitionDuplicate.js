import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAcademicYearOptions from '@salesforce/apex/AdmissionController.getAcademicYearOptions';
import getClassOptions from '@salesforce/apex/AdmissionController.getClassOptions';
import promoteEntireClass from '@salesforce/apex/PromotionController.promoteEntireClass';
import LightningConfirm from 'lightning/confirm';

export default class StudentPromotion extends LightningElement {

    @track academicYearOptions = [];
    @track classOptions = [];

    @track sourceYear = '';
    @track sourceClass = '';
    @track sourceSection = '';
    @track targetYear = '';

    @track isLoading = false;

    async loadInitialData() {
        try {
            const [years, classes] = await Promise.all([
                getAcademicYearOptions(),
                getClassOptions()
            ]);

            if (years) {
                this.academicYearOptions = years;
                if (years.length > 0) {
                    this.sourceYear = years[0].value;
                    this.targetYear = years[0].value;
                }
            }

            if (classes) {
                this.classOptions = classes;
            }
        } catch (error) {
            console.error('Error loading promotion data', error);
        }
    }

    connectedCallback() {
        this.loadInitialData();
    }

    handleChange(event) {
        const name = event.target.dataset.name;
        this[name] = event.target.value;
    }

    async handlePromote() {

        if (!this.sourceClass || !this.sourceYear || !this.targetYear) {
            this.showToast('Error', 'Please select required fields', 'error');
            return;
        }

        const confirmed = await LightningConfirm.open({
            message: `Promote all students from ${this.sourceClass}?`,
            label: 'Confirm Promotion',
            theme: 'warning'
        });

        if (!confirmed) return;

        this.isLoading = true;

        try {
            await promoteEntireClass({
                sourceAcademicYear: this.sourceYear,
                sourceClass: this.sourceClass,
                sourceSection: this.sourceSection,
                targetAcademicYear: this.targetYear
            });

            this.showToast('Success', 'Class promoted successfully!', 'success');

        } catch (error) {
            this.showToast('Error', error.body?.message || error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}