import { LightningElement, track } from 'lwc';

export default class StudentManager extends LightningElement {
    @track currentView = 'grid'; // 'grid' or 'list'
    @track searchQuery = '';
    @track selectedClass = '';
    @track selectedStatus = '';
    @track selectedYear = '2025-26';
    
    @track currentPage = 1;
    @track pageSize = 25;
    @track totalRecords = 0;
    
    @track selectedStudents = new Set();
    
    // Sample student data - replace with actual Salesforce data
    @track allStudents = [
        {
            id: 'STD-2026-0001',
            studentId: 'STD-2026-0001',
            name: 'Amit Kumar',
            initials: 'AK',
            class: 'Class 10-A',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'Apr 15, 2023',
            attendance: 96,
            gradeAvg: 92,
            gradeLetter: 'A+',
            parentName: 'Rajesh Kumar',
            relation: 'Father',
            phone: '+91 98765 43210',
            email: 'amit.kumar@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #2E5BFF 0%, #8B5CF6 100%);',
            attendanceColor: 'color: #00C48C;',
            gradeColor: 'color: #00C48C;',
            attendanceProgress: 'width: 96%;'
        },
        {
            id: 'STD-2026-0002',
            studentId: 'STD-2026-0002',
            name: 'Priya Sharma',
            initials: 'PS',
            class: 'Class 8-B',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'Jun 20, 2021',
            attendance: 94,
            gradeAvg: 88,
            gradeLetter: 'A',
            parentName: 'Sunita Sharma',
            relation: 'Mother',
            phone: '+91 98765 43211',
            email: 'priya.sharma@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);',
            attendanceColor: 'color: #00C48C;',
            gradeColor: 'color: #00C48C;',
            attendanceProgress: 'width: 94%;'
        },
        {
            id: 'STD-2026-0003',
            studentId: 'STD-2026-0003',
            name: 'Rahul Verma',
            initials: 'RV',
            class: 'Class 6-A',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'Aug 10, 2020',
            attendance: 89,
            gradeAvg: 85,
            gradeLetter: 'B+',
            parentName: 'Anjali Verma',
            relation: 'Mother',
            phone: '+91 98765 43212',
            email: 'rahul.verma@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #00C48C 0%, #00A574 100%);',
            attendanceColor: 'color: #2E5BFF;',
            gradeColor: 'color: #2E5BFF;',
            attendanceProgress: 'width: 89%;'
        },
        {
            id: 'STD-2026-0004',
            studentId: 'STD-2026-0004',
            name: 'Sneha Patel',
            initials: 'SP',
            class: 'Class 10-A',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'Apr 15, 2023',
            attendance: 97,
            gradeAvg: 94,
            gradeLetter: 'A+',
            parentName: 'Kiran Patel',
            relation: 'Father',
            phone: '+91 98765 43213',
            email: 'sneha.patel@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);',
            attendanceColor: 'color: #00C48C;',
            gradeColor: 'color: #00C48C;',
            attendanceProgress: 'width: 97%;'
        },
        {
            id: 'STD-2026-0005',
            studentId: 'STD-2026-0005',
            name: 'Arun Singh',
            initials: 'AS',
            class: 'Class 9-A',
            status: 'On Leave',
            statusBadgeClass: 'status-badge status-onleave',
            admissionDate: 'Jul 05, 2022',
            attendance: 78,
            gradeAvg: 81,
            gradeLetter: 'B',
            parentName: 'Meera Singh',
            relation: 'Mother',
            phone: '+91 98765 43214',
            email: 'arun.singh@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #FFA800 0%, #FF6B35 100%);',
            attendanceColor: 'color: #FFA800;',
            gradeColor: 'color: #2E5BFF;',
            attendanceProgress: 'width: 78%;'
        },
        {
            id: 'STD-2026-0006',
            studentId: 'STD-2026-0006',
            name: 'Kavya Reddy',
            initials: 'KR',
            class: 'Class 8-A',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'May 12, 2021',
            attendance: 95,
            gradeAvg: 90,
            gradeLetter: 'A',
            parentName: 'Venkat Reddy',
            relation: 'Father',
            phone: '+91 98765 43215',
            email: 'kavya.reddy@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #00D9FF 0%, #2E5BFF 100%);',
            attendanceColor: 'color: #00C48C;',
            gradeColor: 'color: #00C48C;',
            attendanceProgress: 'width: 95%;'
        },
        {
            id: 'STD-2026-0007',
            studentId: 'STD-2026-0007',
            name: 'Rohan Mehta',
            initials: 'RM',
            class: 'Class 10-B',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'Apr 20, 2023',
            attendance: 91,
            gradeAvg: 87,
            gradeLetter: 'A',
            parentName: 'Pooja Mehta',
            relation: 'Mother',
            phone: '+91 98765 43216',
            email: 'rohan.mehta@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #FF647C 0%, #FF6B35 100%);',
            attendanceColor: 'color: #00C48C;',
            gradeColor: 'color: #00C48C;',
            attendanceProgress: 'width: 91%;'
        },
        {
            id: 'STD-2026-0008',
            studentId: 'STD-2026-0008',
            name: 'Isha Gupta',
            initials: 'IG',
            class: 'Class 9-B',
            status: 'Active',
            statusBadgeClass: 'status-badge status-active',
            admissionDate: 'Aug 18, 2022',
            attendance: 93,
            gradeAvg: 89,
            gradeLetter: 'A',
            parentName: 'Sanjay Gupta',
            relation: 'Father',
            phone: '+91 98765 43217',
            email: 'isha.gupta@example.com',
            avatarStyle: 'background: linear-gradient(135deg, #8B5CF6 0%, #FF6B35 100%);',
            attendanceColor: 'color: #00C48C;',
            gradeColor: 'color: #00C48C;',
            attendanceProgress: 'width: 93%;'
        }
    ];

    @track filteredStudents = [];

    connectedCallback() {
        this.applyFilters();
    }

    // Computed Properties
    get isGridView() {
        return this.currentView === 'grid';
    }

    get isListView() {
        return this.currentView === 'list';
    }

    get gridViewClass() {
        return this.currentView === 'grid' ? 'active' : '';
    }

    get listViewClass() {
        return this.currentView === 'list' ? 'active' : '';
    }

    get hasSelectedItems() {
        return this.selectedStudents.size > 0;
    }

    get selectedCount() {
        return this.selectedStudents.size;
    }

    get startRecord() {
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    get endRecord() {
        const end = this.currentPage * this.pageSize;
        return end > this.totalRecords ? this.totalRecords : end;
    }

    get isFirstPage() {
        return this.currentPage === 1;
    }

    get isLastPage() {
        return this.currentPage === Math.ceil(this.totalRecords / this.pageSize);
    }

    get pageNumbers() {
        const totalPages = Math.ceil(this.totalRecords / this.pageSize);
        const pages = [];
        const maxVisible = 5;
        
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push({
                number: i,
                className: i === this.currentPage ? 'pagination-btn active' : 'pagination-btn'
            });
        }
        
        return pages;
    }

    // Filter and Search Methods
    applyFilters() {
        let results = [...this.allStudents];

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            results = results.filter(student => 
                student.name.toLowerCase().includes(query) ||
                student.studentId.toLowerCase().includes(query) ||
                student.class.toLowerCase().includes(query) ||
                student.parentName.toLowerCase().includes(query) ||
                student.email.toLowerCase().includes(query)
            );
        }

        // Class filter
        if (this.selectedClass) {
            results = results.filter(student => student.class.includes(this.selectedClass));
        }

        // Status filter
        if (this.selectedStatus) {
            const statusMap = {
                'active': 'Active',
                'inactive': 'Inactive',
                'onleave': 'On Leave',
                'graduated': 'Graduated'
            };
            results = results.filter(student => student.status === statusMap[this.selectedStatus]);
        }

        this.totalRecords = results.length;
        
        // Pagination
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.filteredStudents = results.slice(start, end);
    }

    handleSearch(event) {
        this.searchQuery = event.target.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    handleClassFilter(event) {
        this.selectedClass = event.target.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    handleStatusFilter(event) {
        this.selectedStatus = event.target.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    handleYearFilter(event) {
        this.selectedYear = event.target.value;
        this.currentPage = 1;
        this.applyFilters();
    }

    handleResetFilters() {
        this.searchQuery = '';
        this.selectedClass = '';
        this.selectedStatus = '';
        this.selectedYear = '2025-26';
        this.currentPage = 1;
        
        // Reset input values
        const searchInput = this.template.querySelector('input[type="text"]');
        if (searchInput) searchInput.value = '';
        
        const selects = this.template.querySelectorAll('select');
        selects.forEach(select => {
            if (select.className === 'filter-select') {
                select.selectedIndex = 0;
            }
        });
        
        this.applyFilters();
    }

    // View Toggle
    handleGridView() {
        this.currentView = 'grid';
    }

    handleListView() {
        this.currentView = 'list';
    }

    // Pagination Handlers
    handleFirstPage() {
        this.currentPage = 1;
        this.applyFilters();
    }

    handlePrevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.applyFilters();
        }
    }

    handleNextPage() {
        const totalPages = Math.ceil(this.totalRecords / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.applyFilters();
        }
    }

    handleLastPage() {
        this.currentPage = Math.ceil(this.totalRecords / this.pageSize);
        this.applyFilters();
    }

    handlePageClick(event) {
        this.currentPage = parseInt(event.target.dataset.page);
        this.applyFilters();
    }

    handlePageSizeChange(event) {
        this.pageSize = parseInt(event.target.value);
        this.currentPage = 1;
        this.applyFilters();
    }

    // Selection Handlers
    handleSelectAll(event) {
        if (event.target.checked) {
            this.filteredStudents.forEach(student => {
                this.selectedStudents.add(student.id);
            });
        } else {
            this.filteredStudents.forEach(student => {
                this.selectedStudents.delete(student.id);
            });
        }
        this.selectedStudents = new Set(this.selectedStudents);
    }

    handleRowSelect(event) {
        const studentId = event.target.dataset.id;
        if (event.target.checked) {
            this.selectedStudents.add(studentId);
        } else {
            this.selectedStudents.delete(studentId);
        }
        this.selectedStudents = new Set(this.selectedStudents);
    }

    handleClearSelection() {
        this.selectedStudents.clear();
        this.selectedStudents = new Set();
        
        // Uncheck all checkboxes
        const checkboxes = this.template.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    }

    // Action Handlers
    handleAddStudent(event) {
        event.preventDefault();
        console.log('Add new student');
        // Implement add student modal or navigate to form
    }

    handleBulkImport(event) {
        event.preventDefault();
        console.log('Bulk import students');
        // Implement bulk import functionality
    }

    handleExportData(event) {
        event.preventDefault();
        console.log('Export student data');
        // Implement data export
    }

    handleStudentClick(event) {
        const studentId = event.currentTarget.dataset.id;
        console.log('View student details:', studentId);
        // Navigate to student detail page
    }

    handleViewProfile(event) {
        event.stopPropagation();
        const studentId = event.currentTarget.dataset.id;
        console.log('View profile:', studentId);
        // Navigate to student profile
    }

    handleQuickEdit(event) {
        event.stopPropagation();
        const studentId = event.currentTarget.dataset.id;
        console.log('Quick edit:', studentId);
        // Open quick edit modal
    }

    handleMoreActions(event) {
        event.stopPropagation();
        const studentId = event.currentTarget.dataset.id;
        console.log('More actions for:', studentId);
        // Show action menu
    }

    // Bulk Action Handlers
    handleBulkEmail() {
        console.log('Send bulk email to:', Array.from(this.selectedStudents));
        // Implement bulk email
    }

    handleBulkSMS() {
        console.log('Send bulk SMS to:', Array.from(this.selectedStudents));
        // Implement bulk SMS
    }

    handleBulkExport() {
        console.log('Export selected students:', Array.from(this.selectedStudents));
        // Implement export selected
    }

    handleBulkDelete() {
        console.log('Delete students:', Array.from(this.selectedStudents));
        // Implement bulk delete with confirmation
    }
}