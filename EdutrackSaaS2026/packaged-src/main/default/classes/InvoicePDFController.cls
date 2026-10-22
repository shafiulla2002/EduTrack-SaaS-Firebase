public with sharing class InvoicePDFController {
    public Invoice__c invoice { get; private set; }
    public List<Invoice_Item__c> invoiceItems { get; private set; }
    public Decimal totalAmount { get; private set; }
    public String schoolName { get; private set; }
    public String schoolAddress { get; private set; }
    public String schoolPhone { get; private set; }
    public String schoolLogo { get; private set; }
    public String schoolSubtitle { get; private set; }

    public InvoicePDFController() {
        // Fetch School Details from Custom Setting
        School_Setup__c setup = School_Setup__c.getOrgDefaults();
        
        schoolName = String.isNotBlank(setup.School_Name__c) ? setup.School_Name__c : 'EDU PRO SYSTEM';
        schoolAddress = String.isNotBlank(setup.School_Address__c) ? setup.School_Address__c : 'School Campus Address';
        schoolPhone = String.isNotBlank(setup.School_Phone__c) ? setup.School_Phone__c : '+91 999 999 9999';
        schoolLogo = setup.School_Logo__c;
        schoolSubtitle = String.isNotBlank(setup.School_Subtitle__c) ? setup.School_Subtitle__c : 'Powered by Salesforce';

        if (String.isBlank(schoolAddress) || schoolAddress == 'School Campus Address') {
            Organization org = [SELECT Street, City, State, PostalCode FROM Organization LIMIT 1];
            List<String> addressParts = new List<String>();
            if (String.isNotBlank(org.Street)) addressParts.add(org.Street);
            if (String.isNotBlank(org.City)) addressParts.add(org.City);
            if (String.isNotBlank(org.State)) addressParts.add(org.State);
            if (String.isNotBlank(org.PostalCode)) addressParts.add(org.PostalCode);
            if (!addressParts.isEmpty()) {
                schoolAddress = String.join(addressParts, ', ');
            }
        }

        Map<String, String> params = ApexPages.currentPage().getParameters();
        Id invoiceId = params.get('id');
        if (invoiceId == null) invoiceId = params.get('invoiceId');
        if (invoiceId == null) invoiceId = params.get('c__id');
        if (invoiceId == null) invoiceId = params.get('c__invoiceId');
        
        if (invoiceId != null) {
            List<Invoice__c> invs = [
                SELECT Name, Invoice_Date__c, Student__r.Name, Opportunity__r.Name,
                       Opportunity__r.Class__c, Opportunity__r.Section__c, Opportunity__r.Academic_Year__c 
                FROM Invoice__c 
                WHERE Id = :invoiceId 
                LIMIT 1
            ];
            if (!invs.isEmpty()) {
                invoice = invs[0];
                invoiceItems = [
                    SELECT Product__r.Name, Amount__c 
                    FROM Invoice_Item__c 
                    WHERE Invoice__c = :invoiceId
                ];
                
                totalAmount = 0;
                for (Invoice_Item__c item : invoiceItems) {
                    totalAmount += (item.Amount__c != null ? item.Amount__c : 0);
                }
            } else {
                invoice = new Invoice__c();
                invoiceItems = new List<Invoice_Item__c>();
                totalAmount = 0;
            }
        }
    }
}