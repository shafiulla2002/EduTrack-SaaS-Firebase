@isTest
public class InvoicePDFControllerTest {
    @testSetup
    static void setup() {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId);
        insert student;
        
        Invoice__c inv = new Invoice__c(Student__c=student.Id);
        insert inv;
        
        Product2 p = new Product2(Name='Fee', IsActive=true, Family='Fee');
        insert p;
        
        insert new Invoice_Item__c(Invoice__c=inv.Id, Amount__c=100, Product__c=p.Id);
    }
    
    @isTest
    static void testPDFControllerWithId() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        PageReference pref = new PageReference('/apex/InvoicePDF');
        pref.getParameters().put('id', String.valueOf(inv.Id));
        Test.setCurrentPage(pref);
        
        InvoicePDFController ctrl = new InvoicePDFController();
        Assert.isNotNull(ctrl.invoice, 'Invoice shouldn\'t be null');
        Assert.areEqual(100, ctrl.totalAmount, 'Total should be 100');
        Assert.isNotNull(ctrl.schoolName, 'School name fetched based on Org params');
        Assert.isNotNull(ctrl.schoolAddress, 'School address fetched');
        Assert.isNotNull(ctrl.schoolPhone, 'School phone fetched');
    }
    
    @isTest
    static void testPDFControllerEmpty() {
        PageReference pref = new PageReference('/apex/InvoicePDF');
        Test.setCurrentPage(pref);
        
        InvoicePDFController ctrl = new InvoicePDFController();
        Assert.isNull(ctrl.invoice, 'Invoice shouldn\'t have ID context');
        Assert.isNull(ctrl.totalAmount, 'Total should be null safely');
    }
}