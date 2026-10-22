import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getExpenses from '@salesforce/apex/ExpenseController.getExpenses';
import saveExpense from '@salesforce/apex/ExpenseController.saveExpense';
import deleteExpense from '@salesforce/apex/ExpenseController.deleteExpense';
import getExpenseSummary from '@salesforce/apex/ExpenseController.getExpenseSummary';

export default class ExpenseManagement extends LightningElement {
    @track expenses = [];
    @track summary = { currentMonth: 0, prevMonth: 0 };
    @track isLoading = false;
    @track showModal = false;

    // Filters
    @track selectedCategory = '';
    @track selectedStatus = '';
    @track selectedMonth = ''; // YYYY-MM
    @track showAll = false;

    // Form
    @track currentExpense = { Amount__c: 0, Category__c: '', Date__c: '', Status__c: 'Pending', Description__c: '', Payment_mode__c: 'Cash' };

    get categoryOptions() {
        return [
            { label: 'All', value: '' },
            { label: 'Salary', value: 'Salary' },
            { label: 'Utilities', value: 'Utilities' },
            { label: 'Supplies', value: 'Supplies' },
            { label: 'Maintenance', value: 'Maintenance' },
            { label: 'Rent', value: 'Rent' },
            { label: 'Other', value: 'Other' }
        ];
    }

    get modalCategoryOptions() {
        return this.categoryOptions.filter(opt => opt.value !== '');
    }

    get modalStatusOptions() {
        return this.statusOptions.filter(opt => opt.value !== '');
    }

    get modalTitle() {
        return this.currentExpense && this.currentExpense.Id ? 'Edit Expense' : 'Add Expense';
    }



    get statusOptions() {
        return [
            { label: 'All', value: '' },
            { label: 'Pending', value: 'Pending' },
            { label: 'Approved', value: 'Approved' },
            { label: 'Paid', value: 'Paid' }
        ];
    }

    get paymentOptions() {
        return [
            { label: 'Cash', value: 'Cash' },
            { label: 'Bank Transfer', value: 'Bank Transfer' },
            { label: 'Cheque', value: 'Cheque' }
        ];
    }

    connectedCallback() {
        const today = new Date();
        const month = String(today.getMonth() + 0).padStart(2, '0'); // Wait, JS months are 0-indexed
        // Actually, today.getMonth() is 0-11. For '2026-03', we need month+1!
        const monthStr = String(today.getMonth() + 1).padStart(2, '0');
        this.selectedMonth = `${today.getFullYear()}-${monthStr}`;
        this.loadExpenses();
        this.loadSummary();
    }

    loadExpenses() {
        this.isLoading = true;
        getExpenses({ 
            category: this.selectedCategory, 
            status: this.selectedStatus, 
            monthFilter: this.selectedMonth,
            showAll: this.showAll
        })
        .then(result => {
            this.expenses = result.map(exp => ({
                ...exp,
                categoryClass: `expense-card-inner category-${(exp.Category__c || 'Other').toLowerCase()}`,
                iconName: this.getCategoryIcon(exp.Category__c),
                statusClass: `badge-status status-${(exp.Status__c || 'Pending').toLowerCase()}`
            }));
        })
        .catch(error => {
            this.showToast('Error', 'Error loading expenses: ' + (error.body ? error.body.message : error.message), 'error');
        })
        .finally(() => { this.isLoading = false; });
    }

    getCategoryIcon(cat) {
        switch(cat) {
            case 'Salary': return 'utility:moneybag';
            case 'Utilities': return 'utility:lightbulb';
            case 'Supplies': return 'utility:opened_folder';
            case 'Maintenance': return 'utility:automate';
            case 'Rent': return 'utility:home';
            default: return 'utility:record';
        }
    }

    loadSummary() {
        getExpenseSummary()
        .then(result => {
            if (result) {
                this.summary = {
                    currentMonth: result.currentMonth || 0,
                    prevMonth: result.prevMonth || 0,
                    yearly: result.yearly || 0
                };
            }
        })
        .catch(error => {
            console.error('Error loading summary', error);
        });
    }

    /* --- Filter Handlers --- */
    handleCategoryChange(event) {
        this.selectedCategory = event.target.value;
        this.loadExpenses();
    }

    handleStatusChange(event) {
        this.selectedStatus = event.target.value;
        this.loadExpenses();
    }

    handleMonthChange(event) {
        this.selectedMonth = event.target.value;
        this.loadExpenses();
    }

    handleShowAllChange(event) {
        this.showAll = event.target.checked;
        this.loadExpenses();
    }

    /* --- Modal & CRUD Handlers --- */
    handleOpenModal() {
        this.currentExpense = { 
            Amount__c: 0, 
            Category__c: '', 
            Date__c: new Date().toISOString().split('T')[0], 
            Status__c: 'Pending', 
            Description__c: '', 
            Payment_mode__c: 'Cash' 
        };
        this.showModal = true;
    }

    handleCloseModal() {
        this.showModal = false;
    }

    handleFieldChange(event) {
        const field = event.target.name;
        this.currentExpense = { ...this.currentExpense, [field]: event.target.value };
    }

    handleSaveExpense() {
        if (!this.currentExpense.Amount__c || !this.currentExpense.Category__c) {
            this.showToast('Error', 'Amount and Category are required', 'error');
            return;
        }

        this.isLoading = true;
        // Ensure amount is safe parsed
        this.currentExpense = { ...this.currentExpense, Amount__c: parseFloat(this.currentExpense.Amount__c) };

        saveExpense({ expMap: this.currentExpense })
        .then(result => {
            this.showToast('Success', 'Expense saved successfully', 'success');
            this.showModal = false;
            this.loadExpenses();
            this.loadSummary();
        })
        .catch(error => {
            this.showToast('Error', 'Error saving expense: ' + (error.body ? error.body.message : error.message), 'error');
        })
        .finally(() => { this.isLoading = false; });
    }

    handleDelete(event) {
        const id = event.target.dataset.id;
        if (confirm('Are you sure you want to delete this expense?')) {
            this.isLoading = true;
            deleteExpense({ expId: id })
            .then(() => {
                this.showToast('Success', 'Expense deleted', 'success');
                this.loadExpenses();
                this.loadSummary();
            })
            .catch(error => {
                this.showToast('Error', 'Error deleting: ' + (error.body ? error.body.message : error.message), 'error');
            })
            .finally(() => { this.isLoading = false; });
        }
    }

    handleEdit(event) {
        const id = event.target.dataset.id;
        const exp = this.expenses.find(e => e.Id === id);
        if (exp) {
            this.currentExpense = { ...exp };
            this.showModal = true;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}