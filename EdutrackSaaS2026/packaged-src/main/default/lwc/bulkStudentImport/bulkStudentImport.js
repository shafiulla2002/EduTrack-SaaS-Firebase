import { LightningElement, track } from 'lwc';
import getAdmissionCSVTemplate from '@salesforce/apex/AdmissionController.getAdmissionCSVTemplate';
import importStudentsBulk from '@salesforce/apex/AdmissionController.importStudentsBulk';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class BulkStudentImport extends LightningElement {
    @track step = 1;
    @track isProcessing = false;
    @track fileName = '';
    @track successCount = 0;
    @track totalRows = 0;
    @track errors = [];
    csvData = [];

    get isStep1() { return this.step === 1; }
    get isStepConfirm() { return this.step === 2; }
    get isStepResult() { return this.step === 3; }

    get resultIcon() { return this.successCount === this.totalRows ? '✅' : '⚠️'; }
    get resultIconClass() { return this.successCount === this.totalRows ? 'icon-success' : 'icon-warning'; }
    get resultTitle() { return this.successCount === this.totalRows ? 'Import Complete' : 'Import Partially Completed'; }
    get hasErrors() { return this.errors && this.errors.length > 0; }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleDownloadTemplate() {
        getAdmissionCSVTemplate()
            .then(csvContent => {
                const element = document.createElement('a');
                element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
                element.setAttribute('download', 'Student_Import_Template.csv');
                element.style.display = 'none';
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
            })
            .catch(error => {
                this.showToast('Error', 'Failed to generate template: ' + error.body.message, 'error');
            });
    }

    handleFileUpload(event) {
        const file = event.detail.files[0];
        if (!file) return;

        this.fileName = file.name;
        const reader = new FileReader();
        reader.onload = () => {
            const csv = reader.result;
            this.parseCSV(csv);
        };
        reader.readAsText(file);
    }

    parseCSV(csv) {
        try {
            const lines = csv.split(/\r\n|\n/);
            const headers = lines[0].split(',').map(h => h.trim());
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i]) continue;
                const obj = {};
                const currentline = lines[i].split(',');

                for (let j = 0; j < headers.length; j++) {
                    obj[headers[j]] = currentline[j] ? currentline[j].trim() : '';
                }
                data.push(obj);
            }
            this.csvData = data;
            this.totalRows = this.csvData.length;

            if (this.totalRows > 0) {
                this.step = 2; // Move to confirmation step
            } else {
                this.showToast('Error', 'CSV file is empty', 'error');
            }
        } catch (error) {
            this.showToast('Error', 'Failed to parse CSV: ' + error.message, 'error');
        }
    }

    handleConfirm() {
        this.startImport();
    }

    handleBack() {
        this.step = 1;
        this.fileName = '';
        this.csvData = [];
    }

    startImport() {
        this.step = 3;
        this.isProcessing = true;

        importStudentsBulk({ studentDataList: this.csvData })
            .then(result => {
                this.successCount = result.successCount;
                this.totalRows = result.totalRows;
                this.errors = result.errors;
                this.isProcessing = false;

                if (this.successCount > 0) {
                    this.showToast('Success', `Imported ${this.successCount} students successfully`, 'success');
                } else {
                    this.showToast('Warning', 'No students were imported. Check errors.', 'warning');
                }
            })
            .catch(error => {
                this.isProcessing = false;
                this.showToast('Error', 'Bulk Import Failed: ' + (error.body ? error.body.message : error.message), 'error');
            });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}