@isTest
public class AdmissionInvoiceControllerTest {
    @testSetup
    static void setup() {
        Academic_Year__c ay = new Academic_Year__c(Name = '2024-2025', Is_Active__c = true);
        insert ay;
        
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account acc = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId);
        insert acc;
        
        Opportunity opp = new Opportunity(Name='Test Opp', AccountId=acc.Id, StageName='Prospecting', CloseDate=Date.today(), Academic_Year__c=ay.Id);
        insert opp;
        
        Invoice__c inv = new Invoice__c(Opportunity__c=opp.Id, Student__c=acc.Id, Status__c='Paid');
        insert inv;
        
        Product2 prod = new Product2(Name='Fee', Family='Fee', IsActive=true);
        insert prod;
        
        Invoice_Item__c invItem = new Invoice_Item__c(Invoice__c=inv.Id, Amount__c=50, Product__c=prod.Id);
        insert invItem;
    }
    
    @isTest
    static void testAdmissionInvoiceController() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        
        PageReference pageRef = new PageReference('/apex/AdmissionInvoice');
        pageRef.getParameters().put('id', inv.Id);
        Test.setCurrentPage(pageRef);
        
        AdmissionInvoiceController controller = new AdmissionInvoiceController();
        
        Assert.isNotNull(controller.invoice, 'Invoice should not be null');
        Assert.areEqual(inv.Id, controller.invoice.Id, 'IDs should match');
        Assert.isFalse(controller.invoiceItems.isEmpty(), 'Should have invoice items');
        Assert.areEqual(50, controller.totalAmount, 'Total should be 50');
        Assert.areEqual('2024-2025', controller.academicYearName, 'Academic year should be resolved');
    }
    
    @isTest
    static void testAdmissionInvoiceControllerNoId() {
        PageReference pageRef = new PageReference('/apex/AdmissionInvoice');
        Test.setCurrentPage(pageRef);
        AdmissionInvoiceController controller = new AdmissionInvoiceController();
        
        Assert.isNull(controller.invoice.Id, 'Invoice ID should be null');
        Assert.areEqual(0, controller.totalAmount, 'Total should be 0');
    }
}