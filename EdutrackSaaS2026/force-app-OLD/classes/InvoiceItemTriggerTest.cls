@isTest
public class InvoiceItemTriggerTest {
    
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
    static void testTotalPaidCalculation() {
        Opportunity opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];
        OpportunityLineItem oli = [SELECT Id, Product2Id FROM OpportunityLineItem LIMIT 1];

        // Create Invoice
        Invoice__c inv = TestDataFactory.createInvoice(student.Id, opp.Id, 'Paid');

        Test.startTest();
        // 1. Test Insert
        Invoice_Item__c item1 = TestDataFactory.createInvoiceItem(inv.Id, oli.Id, oli.Product2Id, 500);
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(500, opp.Total_Paid_Amount__c, 'Total Paid should be 500 after first item');

        // 2. Test Update
        item1.Amount__c = 750;
        update item1;
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(750, opp.Total_Paid_Amount__c, 'Total Paid should be 750 after update');

        // 3. Test Delete
        delete item1;
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(0, opp.Total_Paid_Amount__c, 'Total Paid should be 0 after delete');

        // 4. Test Undelete
        undelete item1;
        
        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual(750, opp.Total_Paid_Amount__c, 'Total Paid should be 750 after undelete');
        Test.stopTest();
    }

    @isTest
    static void testCancelledInvoiceExclusion() {
        Opportunity opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];
        OpportunityLineItem oli = [SELECT Id, Product2Id FROM OpportunityLineItem LIMIT 1];

        // Create Invoices: one Paid, one Cancelled
        Invoice__c invPaid = TestDataFactory.createInvoice(student.Id, opp.Id, 'Paid');
        Invoice__c invCancelled = TestDataFactory.createInvoice(student.Id, opp.Id, 'Cancelled');

        Test.startTest();
        TestDataFactory.createInvoiceItem(invPaid.Id, oli.Id, oli.Product2Id, 400);
        TestDataFactory.createInvoiceItem(invCancelled.Id, oli.Id, oli.Product2Id, 600);
        Test.stopTest();

        opp = [SELECT Id, Total_Paid_Amount__c FROM Opportunity WHERE Id = :opp.Id];
        // Only the Paid invoice item should be counted
        Assert.areEqual(400, opp.Total_Paid_Amount__c, 'Cancelled invoice items should be excluded from Total Paid');
    }
}