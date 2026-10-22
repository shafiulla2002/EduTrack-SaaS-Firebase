@isTest
public class InvoiceTriggerTest {
    
    @testSetup
    static void setup() {
        // Create Academic Year
        Academic_Year__c year = new Academic_Year__c(Name = '2027-2028', Is_Active__c = true);
        insert year;

        // Use TestDataFactory to create core data
        Account student = TestDataFactory.createStudentAccount('Trigger Test Student');
        Opportunity opp = TestDataFactory.createAdmissionOpportunity(student.Id, 'Prospecting');
        opp.Academic_Year__c = year.Id;
        update opp;

        Product2 prod = TestDataFactory.createProduct('Test Tuition', 'Fee');
        Id stdPbId = Test.getStandardPricebookId();
        TestDataFactory.createPricebookEntry(stdPbId, prod.Id, 1000);
        
        Pricebook2 customPb = TestDataFactory.createCustomPricebook('Trigger Test PB');
        PricebookEntry pbe = TestDataFactory.createPricebookEntry(customPb.Id, prod.Id, 1000);
        
        opp.Pricebook2Id = customPb.Id;
        update opp;

        // Create Opportunity Line Items
        OpportunityLineItem oli = new OpportunityLineItem(
            OpportunityId = opp.Id,
            PricebookEntryId = pbe.Id,
            Quantity = 1,
            UnitPrice = 1000
        );
        insert oli;
    }

    @isTest
    static void testStatusChangeRecalculation() {
        Opportunity opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];
        OpportunityLineItem oli = [SELECT Id, Product2Id FROM OpportunityLineItem LIMIT 1];

        // Create Invoice but don't add items yet
        Invoice__c inv = TestDataFactory.createInvoice(student.Id, opp.Id, 'Paid');
        
        // Add items
        TestDataFactory.createInvoiceItem(inv.Id, oli.Id, oli.Product2Id, 700);
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(700, opp.Total_Paid_Amount__c, 'Total Paid should be 700 before status change');

        Test.startTest();
        // 1. Cancel the Invoice
        inv.Status__c = 'Cancelled';
        update inv;
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(0, opp.Total_Paid_Amount__c, 'Total Paid should be 0 after status changed to Cancelled');

        // 2. Reactivate the Invoice
        inv.Status__c = 'Paid';
        update inv;
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(700, opp.Total_Paid_Amount__c, 'Total Paid should be 700 after status changed back to Paid');
        Test.stopTest();
    }
}