import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createFeeProducts from '@salesforce/apex/AddFeesController.createFeeProducts';
import createPriceBookEntries from '@salesforce/apex/AddFeesController.createPriceBookEntries';
import getAllFeeProducts from '@salesforce/apex/AddFeesController.getAllFeeProducts';
import getExistingPrices from '@salesforce/apex/AddFeesController.getExistingPrices';
import checkProductExists from '@salesforce/apex/AddFeesController.checkProductExists';
import getActiveAcademicYears from '@salesforce/apex/AddFeesController.getActiveAcademicYears';

// Fallback hardcoded suggestions shown when no org products exist
const HARDCODED_SUGGESTIONS = [
    'School Fee',
    'Tuition Fee',
    'Exam Fee',
    'Library Fee',
    'Sports Fee',
    'Lab Fee',
    'Transport Fee',
    'Hostel Fee',
    'Activity Fee',
    'Admission Fee',
    'Annual Fee',
    'Development Fee',
    'Computer Lab Fee',
    'Stationery Fee',
    'Miscellaneous Fee'
];

export default class AddFees extends LightningElement {
    @track inputCount = 1;
    @track displayedProducts = [];
    @track showProductsList = false;
    @track activeTab = 'addFees';
    @track priceListItems = [];
    @track selectedYear = '';
    @track academicYears = [];
    @track inputFields = [{ id: 1, value: '', isFirst: true, showSuggestions: false, suggestions: [], hasSuggestions: false }];
    @track isLoading = false;

    allProducts = [];
    // All available suggestion labels (org products + hardcoded fallback)
    _suggestionPool = [];

    get yearOptions() {
        return [
            { label: 'Select Year...', value: '' },
            ...this.academicYears.map(ay => ({
                label: ay.Name + (ay.Is_Active__c ? ' (Active)' : ''),
                value: ay.Id
            }))
        ];
    }

    get classOptions() {
        return [
            { label: 'Choose a class...', value: '' },
            { label: 'Nursery', value: 'Nursery' },
            { label: 'LKG', value: 'LKG' },
            { label: 'UKG', value: 'UKG' },
            { label: 'Class 1', value: 'Class-1' },
            { label: 'Class 2', value: 'Class-2' },
            { label: 'Class 3', value: 'Class-3' },
            { label: 'Class 4', value: 'Class-4' },
            { label: 'Class 5', value: 'Class-5' },
            { label: 'Class 6', value: 'Class-6' },
            { label: 'Class 7', value: 'Class-7' },
            { label: 'Class 8', value: 'Class-8' },
            { label: 'Class 9', value: 'Class-9' },
            { label: 'Class 10', value: 'Class-10' }
        ];
    }

    get isAddFeesTab() {
        return this.activeTab === 'addFees';
    }

    get isPriceBookTab() {
        return this.activeTab === 'setPriceBook';
    }

    get addFeesTabClass() {
        return this.activeTab === 'addFees' ? 'tab-button active' : 'tab-button';
    }

    get priceBookTabClass() {
        return this.activeTab === 'setPriceBook' ? 'tab-button active' : 'tab-button';
    }

    get showEmptyState() {
        return this.priceListItems.length === 0;
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────────

    connectedCallback() {
        this.loadAcademicYears();
        this.loadAllProductsForPriceBook();
        this.loadSuggestionPool();
    }

    // ─── Suggestion Pool ─────────────────────────────────────────────────────────

    /**
     * Loads org products as suggestion pool.
     * Falls back to HARDCODED_SUGGESTIONS if no org products exist.
     */
    async loadSuggestionPool() {
        try {
            const products = await getAllFeeProducts();
            if (products && products.length > 0) {
                this._suggestionPool = products.map(p => ({ label: p.Name, isOrgProduct: true }));
            } else {
                this._suggestionPool = HARDCODED_SUGGESTIONS.map(name => ({ label: name, isOrgProduct: false }));
            }
        } catch (error) {
            // On error fall back to hardcoded suggestions
            this._suggestionPool = HARDCODED_SUGGESTIONS.map(name => ({ label: name, isOrgProduct: false }));
        }
    }

    /**
     * Filters suggestion pool against the current input value.
     * Shows all suggestions on empty input (focus), filters on typing.
     */
    _getFilteredSuggestions(value) {
        const query = (value || '').trim().toLowerCase();

        // Already selected values in OTHER fields — avoid duplicates
        const usedValues = this.inputFields
            .map(f => f.value.trim().toLowerCase())
            .filter(v => v !== '');

        let pool = this._suggestionPool;

        // Filter by query
        if (query.length > 0) {
            pool = pool.filter(s => s.label.toLowerCase().includes(query));
        }

        // Sort: starts-with first, then contains
        pool = pool.slice().sort((a, b) => {
            const aStarts = a.label.toLowerCase().startsWith(query);
            const bStarts = b.label.toLowerCase().startsWith(query);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.label.localeCompare(b.label);
        });

        // Max 8 visible suggestions
        return pool.slice(0, 8).map((s, idx) => ({
            label: s.label,
            icon: s.isOrgProduct ? '📦' : '💡',
            badge: s.isOrgProduct ? 'Existing' : 'Suggested',
            itemClass: 'suggestion-item' + (idx === 0 ? ' suggestion-item-first' : '')
        }));
    }

    _updateFieldSuggestions(fieldId, value, show) {
        this.inputFields = this.inputFields.map(f => {
            if (f.id === fieldId) {
                const suggestions = show ? this._getFilteredSuggestions(value) : [];
                return {
                    ...f,
                    value: value !== undefined ? value : f.value,
                    showSuggestions: show && suggestions.length > 0,
                    suggestions: suggestions,
                    hasSuggestions: suggestions.length > 0
                };
            }
            return f;
        });
    }

    // ─── Input Handlers ──────────────────────────────────────────────────────────

    handleInputChange(event) {
        const fieldId = parseInt(event.target.dataset.id);
        const value = event.target.value;
        this._updateFieldSuggestions(fieldId, value, true);
    }

    handleInputFocus(event) {
        const fieldId = parseInt(event.target.dataset.id);
        const value = event.target.value;
        this._updateFieldSuggestions(fieldId, value, true);
    }

    handleInputBlur(event) {
        // Small delay so click on suggestion fires first
        const fieldId = parseInt(event.target.dataset.id);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            this._updateFieldSuggestions(fieldId, undefined, false);
        }, 200);
    }

    handleKeyDown(event) {
        // Close suggestions on Escape
        if (event.key === 'Escape') {
            const fieldId = parseInt(event.target.dataset.id);
            this._updateFieldSuggestions(fieldId, undefined, false);
        }
    }

    handleSuggestionClick(event) {
        const fieldId = parseInt(event.currentTarget.dataset.fieldId);
        const selectedValue = event.currentTarget.dataset.value;

        this.inputFields = this.inputFields.map(f => {
            if (f.id === fieldId) {
                return { ...f, value: selectedValue, showSuggestions: false, suggestions: [], hasSuggestions: false };
            }
            return f;
        });
    }

    addInputField() {
        this.inputCount++;
        this.inputFields = [
            ...this.inputFields,
            { id: this.inputCount, value: '', isFirst: false, showSuggestions: false, suggestions: [], hasSuggestions: false }
        ];
    }

    removeInputField(event) {
        const fieldId = parseInt(event.target.dataset.id);
        this.inputFields = this.inputFields.filter(field => field.id !== fieldId);
        this.inputCount--;
    }

    // ─── Submit Products ─────────────────────────────────────────────────────────

    async submitProducts() {
        const products = this.inputFields
            .map(field => field.value.trim())
            .filter(value => value !== '');

        if (products.length === 0) {
            this.showToast('Error', 'Please enter at least one product name!', 'error');
            return;
        }

        const uniqueProducts = [...new Set(products)];
        if (uniqueProducts.length !== products.length) {
            this.showToast('Warning', 'Duplicate product names found. Only unique products will be created.', 'warning');
        }

        try {
            this.isLoading = true;

            const existsMap = await checkProductExists({ productNames: uniqueProducts });

            const existingProducts = [];
            const newProducts = [];

            for (let productName of uniqueProducts) {
                if (existsMap[productName]) {
                    existingProducts.push(productName);
                } else {
                    newProducts.push(productName);
                }
            }

            if (existingProducts.length > 0) {
                this.showToast('Info', `The following products already exist: ${existingProducts.join(', ')}`, 'info');
            }

            if (newProducts.length > 0) {
                const createdProducts = await createFeeProducts({ productNames: newProducts });

                if (createdProducts && createdProducts.length > 0) {
                    this.displayedProducts = createdProducts.map(product => ({
                        name: product.Name,
                        id: product.Id,
                        code: product.ProductCode
                    }));

                    this.showProductsList = true;

                    this.showToast(
                        'Success',
                        `${createdProducts.length} product(s) created successfully in Salesforce!`,
                        'success'
                    );

                    this.inputFields = [{ id: 1, value: '', isFirst: true, showSuggestions: false, suggestions: [], hasSuggestions: false }];
                    this.inputCount = 1;

                    // Refresh suggestion pool with newly created products
                    await this.loadSuggestionPool();
                    this.loadAllProductsForPriceBook();
                } else {
                    this.showToast('Error', 'No products were created.', 'error');
                }
            } else {
                this.showToast('Info', 'All products already exist in the system.', 'info');
            }

        } catch (error) {
            console.error('Error creating products:', error);
            this.showToast('Error', 'Error creating products: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleDone() {
        this.showProductsList = false;
        this.displayedProducts = [];
        this.inputFields = [{ id: 1, value: '', isFirst: true, showSuggestions: false, suggestions: [], hasSuggestions: false }];
        this.inputCount = 1;

        this.showToast(
            'Success',
            'Products saved! You can add more products or go to "Set Price Book" tab to create price books.',
            'success'
        );
    }

    // ─── Tab Handling ────────────────────────────────────────────────────────────

    handleTabClick(event) {
        const tabName = event.target.dataset.tab;
        this.activeTab = tabName;

        if (tabName === 'setPriceBook') {
            this.loadAllProductsForPriceBook();
        }
    }

    // ─── Price Book ──────────────────────────────────────────────────────────────

    async handleYearChange(event) {
        this.selectedYear = event.target.value;
        if (this.selectedClass && this.selectedYear) {
            await this.loadExistingPricesForClass();
        } else {
            this.clearPrices();
        }
    }

    async handleClassChange(event) {
        this.selectedClass = event.target.value;
        if (this.selectedClass && this.selectedYear) {
            await this.loadExistingPricesForClass();
        } else {
            this.clearPrices();
        }
    }

    clearPrices() {
        this.priceListItems = this.priceListItems.map(item => ({
            ...item, price: '', selected: false, disabled: true
        }));
    }

    async loadExistingPricesForClass() {
        try {
            const existingPrices = await getExistingPrices({
                className: this.selectedClass,
                academicYearId: this.selectedYear
            });

            this.priceListItems = this.priceListItems.map(item => {
                const existingPrice = existingPrices[item.productId];
                if (existingPrice !== undefined && existingPrice !== null) {
                    return { ...item, price: existingPrice.toString(), selected: true, disabled: false };
                }
                return { ...item, price: '', selected: false, disabled: true };
            });

            const pricesFound = Object.keys(existingPrices).length;
            if (pricesFound > 0) {
                this.showToast('Info', `Loaded ${pricesFound} existing price(s) for ${this.selectedClass}`, 'info');
            }

        } catch (error) {
            console.error('Error loading existing prices:', error);
            this.showToast('Error', 'Error loading existing prices: ' + (error.body?.message || error.message), 'error');
        }
    }

    handleCheckboxChange(event) {
        const index = parseInt(event.target.dataset.index);
        const isChecked = event.target.checked;

        this.priceListItems = this.priceListItems.map((item, idx) => {
            if (idx === index) {
                return { ...item, selected: isChecked, disabled: !isChecked, price: isChecked ? item.price : '' };
            }
            return item;
        });
    }

    handlePriceChange(event) {
        const index = parseInt(event.target.dataset.index);
        const price = event.target.value;

        this.priceListItems = this.priceListItems.map((item, idx) => {
            if (idx === index) return { ...item, price: price };
            return item;
        });
    }

    async loadAllProductsForPriceBook() {
        try {
            this.isLoading = true;

            const products = await getAllFeeProducts();

            if (products && products.length > 0) {
                this.allProducts = products;
                this.priceListItems = products.map((product, index) => ({
                    id: index,
                    name: product.Name,
                    productId: product.Id,
                    productCode: product.ProductCode,
                    selected: false,
                    disabled: true,
                    price: ''
                }));

                if (this.selectedClass && this.selectedYear) {
                    await this.loadExistingPricesForClass();
                }
            } else {
                this.priceListItems = [];
                this.showToast('Info', 'No products found. Please create products in the "Add Fees" tab first.', 'info');
            }

        } catch (error) {
            console.error('Error loading products:', error);
            this.showToast('Error', 'Error loading products: ' + (error.body?.message || error.message), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async submitPriceBook() {
        if (!this.selectedClass) {
            this.showToast('Error', 'Please select a class!', 'error');
            return;
        }
        if (!this.selectedYear) {
            this.showToast('Error', 'Please select an academic year!', 'error');
            return;
        }
        if (this.priceListItems.length === 0) {
            this.showToast('Error', 'No products available! Please create products in "Add Fees" tab first.', 'error');
            return;
        }

        const selectedProducts = [];
        let total = 0;
        let hasError = false;

        this.priceListItems.forEach(item => {
            if (item.selected) {
                const price = parseFloat(item.price);
                if (!price || price <= 0 || isNaN(price)) {
                    this.showToast('Error', `Please enter a valid price for ${item.name}!`, 'error');
                    hasError = true;
                    return;
                }
                selectedProducts.push({ productId: item.productId, productName: item.name, price: price });
                total += price;
            }
        });

        if (hasError) return;

        if (selectedProducts.length === 0) {
            this.showToast('Error', 'Please select at least one product and enter its price!', 'error');
            return;
        }

        try {
            this.isLoading = true;

            const result = await createPriceBookEntries({
                className: this.selectedClass,
                academicYearId: this.selectedYear,
                priceBookData: selectedProducts
            });

            if (result && result.success) {
                this.displaySuccessMessage(this.selectedClass, selectedProducts, total, result);
                this.showToast(
                    'Success',
                    `Price Book updated successfully! ${result.entriesCreated} entries processed for "${result.priceBookName}"`,
                    'success'
                );
            } else {
                this.showToast('Error', 'Failed to create Price Book entries.', 'error');
            }

        } catch (error) {
            console.error('Error creating price book:', error);
            let errorMessage = error.body?.message || error.message || 'Unknown error occurred';
            this.showToast('Error', 'Error creating price book: ' + errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    displaySuccessMessage(className, products, total, result) {
        this.successData = {
            className: className,
            priceBookName: result.priceBookName || className,
            priceBookId: result.priceBookId,
            products: products.map(p => ({
                name: p.productName,
                price: p.price.toFixed(2),
                productId: p.productId
            })),
            total: total.toFixed(2),
            entriesCreated: result.entriesCreated || products.length
        };
        this.showSuccessMessage = true;
    }

    resetPriceBook() {
        this.showSuccessMessage = false;
        this.selectedClass = '';
        this.priceListItems = this.priceListItems.map(item => ({
            ...item, selected: false, disabled: true, price: ''
        }));
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title, message, variant });
        this.dispatchEvent(event);
    }

    async loadAcademicYears() {
        try {
            this.academicYears = await getActiveAcademicYears();
            const activeYear = this.academicYears.find(ay => ay.Is_Active__c);
            if (activeYear) {
                this.selectedYear = activeYear.Id;
            }
        } catch (error) {
            console.error('Error loading academic years:', error);
        }
    }
}