public with sharing class AdmissionInvoiceController {
 

    public Invoice__c invoice { get; set; }
    public List<Invoice_Item__c> invoiceItems { get; set; }
    public Decimal totalAmount { get; set; }
    public String academicYearName { get; set; }
    public String schoolName { get; private set; }
    public String schoolAddress { get; private set; }
    public String schoolPhone { get; private set; }
    public String schoolLogo { get; private set; }
    public String schoolSubtitle { get; private set; }

    public String studentName { get; set; }
    public String fatherName { get; set; }
    public String motherName { get; set; }
    public String className { get; set; }
    public String sectionName { get; set; }
    public String studentDob { get; set; }
    public String addressVillage { get; set; }
    public String addressCityPostal { get; set; }
    public String addressState { get; set; }
    public String addressCountry { get; set; }
    public String admissionRef { get; set; }

    public class InvoiceItemWrapper {
        public String particulars { get; set; }
        public Decimal amount { get; set; }
    }
    public List<InvoiceItemWrapper> wrappedItems { get; set; }

    public AdmissionInvoiceController() {
        invoice = new Invoice__c();
        invoiceItems = new List<Invoice_Item__c>();
        wrappedItems = new List<InvoiceItemWrapper>();
        totalAmount = 0;

        // Fetch School Details from Custom Setting
        School_Setup__c setup = School_Setup__c.getOrgDefaults();
        schoolName = String.isNotBlank(setup.School_Name__c) ? setup.School_Name__c : 'EDU PRO SYSTEM';
        schoolAddress = String.isNotBlank(setup.School_Address__c) ? setup.School_Address__c : 'School Campus Address';
        schoolPhone = String.isNotBlank(setup.School_Phone__c) ? setup.School_Phone__c : '+91 999 999 9999';
        schoolLogo = setup.School_Logo__c;
        schoolSubtitle = String.isNotBlank(setup.School_Subtitle__c) ? setup.School_Subtitle__c : 'Powered by Salesforce';

        Map<String, String> params = ApexPages.currentPage().getParameters();
        Id invoiceId = params.get('id');
        if (invoiceId == null) invoiceId = params.get('invoiceId');
        if (invoiceId == null) invoiceId = params.get('c__id');
        if (invoiceId == null) invoiceId = params.get('c__invoiceId');
        
        if (invoiceId != null) {
            List<Invoice__c> invs = (List<Invoice__c>)Security.stripInaccessible(AccessType.READABLE, [
                SELECT Name, Invoice_Date__c, Student__r.Name, Opportunity__r.Name,
                       Student__r.Father_Name__c, Student__r.Mother_Name__c, Student__r.PersonBirthdate,
                       Student__r.Village__c, Student__r.PersonMailingCity, 
                       Student__r.PersonMailingPostalCode, Student__r.State__c, 
                       Student__r.Country__c, Student__r.Nationality__c, Student__r.Roll_No__c,
                       Opportunity__r.Class__c, Opportunity__r.Section__c, Opportunity__r.Academic_Year__c 
                FROM Invoice__c 
                WHERE Id = :invoiceId 
                LIMIT 1
            ]).getRecords();
            if (!invs.isEmpty()) {
                invoice = invs[0];
                
                // Populating wrapper bindings
                if (invoice.Student__r != null) {
                    Account std = invoice.Student__r;
                    studentName = std.Name;
                    
                    fatherName = (String)NamespaceUtils.getValue(std, 'Father_Name__c');
                    motherName = (String)NamespaceUtils.getValue(std, 'Mother_Name__c');
                    addressVillage = (String)NamespaceUtils.getValue(std, 'Village__c');
                    addressState = (String)NamespaceUtils.getValue(std, 'State__c');
                    addressCountry = (String)NamespaceUtils.getValue(std, 'Country__c');
                    
                    String city = (String)NamespaceUtils.getValue(std, 'PersonMailingCity');
                    String postal = (String)NamespaceUtils.getValue(std, 'PersonMailingPostalCode');
                    addressCityPostal = (city != null ? city : '') + (postal != null ? ' - ' + postal : '');
                    
                    Object dobObj = NamespaceUtils.getValue(std, 'PersonBirthdate');
                    if (dobObj != null && dobObj instanceof Date) {
                        studentDob = ((Date)dobObj).format();
                    }
                }
                
                if (invoice.Opportunity__r != null) {
                    Opportunity opp = invoice.Opportunity__r;
                    className = (String)NamespaceUtils.getValue(opp, 'Class__c');
                    sectionName = (String)NamespaceUtils.getValue(opp, 'Section__c');
                    admissionRef = opp.Name;
                }

                invoiceItems = (List<Invoice_Item__c>)Security.stripInaccessible(AccessType.READABLE, [
                    SELECT Product__r.Name, Amount__c 
                    FROM Invoice_Item__c 
                    WHERE Invoice__c = :invoiceId
                    LIMIT 200
                ]).getRecords();
                
                for (Invoice_Item__c item : invoiceItems) {
                    Decimal itemAmt = (Decimal)NamespaceUtils.getValue(item, 'Amount__c');
                    totalAmount += (itemAmt != null ? itemAmt : 0);
                    InvoiceItemWrapper wrap = new InvoiceItemWrapper();
                    String prodName = (String)NamespaceUtils.getValue(item, 'Product__r.Name');
                    wrap.particulars = prodName != null ? prodName : '';
                    wrap.amount = itemAmt;
                    wrappedItems.add(wrap);
                }

                // Resolve Academic Year Name
                resolveAcademicYearName();
            }
        }
    }

    private void resolveAcademicYearName() {
        if (invoice.Opportunity__r != null) {
            String ayId = (String)NamespaceUtils.getValue(invoice.Opportunity__r, 'Academic_Year__c');
            if (String.isNotBlank(ayId)) {
                academicYearName = ayId;
                try {
                    // Try to resolve as ID if it looks like one, otherwise keep as is 
                    if (academicYearName instanceof Id || (academicYearName.length() >= 15 && !academicYearName.contains(' '))) {
                        List<Academic_Year__c> ay = (List<Academic_Year__c>)Security.stripInaccessible(AccessType.READABLE, [SELECT Name FROM Academic_Year__c WHERE Id = :academicYearName LIMIT 1]).getRecords();
                        if (!ay.isEmpty()) {
                            academicYearName = ay[0].Name;
                        }
                    }
                } catch (Exception e) {
                    System.debug('AdmissionInvoiceController: Academic year name resolution failed: ' + e.getMessage());
                }
            }
        }
    }
}




