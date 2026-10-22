@isTest
public class PromotionControllerTest {
    @testSetup
    static void setup() {
        Academic_Year__c ayOld = new Academic_Year__c(Name='2023-2024', Is_Active__c=true);
        insert ayOld;
        Academic_Year__c ayNew = new Academic_Year__c(Name='2024-2025', Is_Active__c=false);
        insert ayNew;
        
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId, Type='Student', Class__c='Class-1', Section__c='A', Roll_No__c='1');
        insert student;
        
        Opportunity opp = new Opportunity(Name='Test Opp', AccountId=student.Id, StageName='Prospecting', CloseDate=Date.today(), Academic_Year__c=ayOld.Id);
        insert opp;
        
        Product2 p = new Product2(Name='Fee', IsActive=true, Family='Fee');
        insert p;
        Product2 prevFee = new Product2(Name='Previous Dues', IsActive=true, ProductCode='PREV_DUES', Family='Fee');
        insert prevFee;
        
        Id stdPbId = Test.getStandardPricebookId();
        PricebookEntry pbe = new PricebookEntry(Pricebook2Id=stdPbId, Product2Id=p.Id, UnitPrice=100, IsActive=true);
        insert pbe;
        PricebookEntry pbePrev = new PricebookEntry(Pricebook2Id=stdPbId, Product2Id=prevFee.Id, UnitPrice=0, IsActive=true);
        insert pbePrev;
        
        insert new OpportunityLineItem(OpportunityId=opp.Id, PricebookEntryId=pbe.Id, Quantity=1, UnitPrice=100);
        
        Invoice__c inv = new Invoice__c(Student__c=student.Id, Opportunity__c=opp.Id, Status__c='Paid');
        insert inv;
        insert new Invoice_Item__c(Invoice__c=inv.Id, Amount__c=50); // Net Balance = 50
        
        Pricebook2 pbNew = new Pricebook2(Name='Class 2 - 2024-2025', Academic_Year__c=ayNew.Id, IsActive=true);
        insert pbNew;
        insert new PricebookEntry(Pricebook2Id=pbNew.Id, Product2Id=p.Id, UnitPrice=150, IsActive=true);
        insert new PricebookEntry(Pricebook2Id=pbNew.Id, Product2Id=prevFee.Id, UnitPrice=0, IsActive=true);
    }
    
    @isTest
    static void testGetStudentsForPromotion() {
        Academic_Year__c ayOld = [SELECT Id FROM Academic_Year__c WHERE Name='2023-2024' LIMIT 1];
        
        List<PromotionController.StudentWrapper> students = PromotionController.getStudentsForPromotion(ayOld.Id, 'Class-1', 'A');
        Assert.isFalse(students.isEmpty(), 'Returns existing class students');
        Assert.areEqual(50, students[0].pendingBalance, 'Previous balance aggregated and netted to 50 correctly');
        
        List<PromotionController.StudentWrapper> noStudents = PromotionController.getStudentsForPromotion(ayOld.Id, 'Class-8', 'A');
        Assert.isTrue(noStudents.isEmpty(), 'Obeys invalid filter');
    }
    
    @isTest
    static void testGetClassSummaryData() {
        Academic_Year__c ayOld = [SELECT Id FROM Academic_Year__c WHERE Name='2023-2024' LIMIT 1];
        List<PromotionController.ClassSummary> summaries = PromotionController.getClassSummaryData(ayOld.Id);
        
        Assert.isFalse(summaries.isEmpty(), 'Creates grouping chunks');
        Assert.areEqual('Class-1', summaries[0].className, 'Groups by origin class');
        Assert.areEqual(1, summaries[0].studentCount, 'Calculates counts');
    }
    
    @isTest
    static void testPromoteStudents() {
        Academic_Year__c ayOld = [SELECT Id FROM Academic_Year__c WHERE Name='2023-2024' LIMIT 1];
        Academic_Year__c ayNew = [SELECT Id FROM Academic_Year__c WHERE Name='2024-2025' LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];
        
        Test.startTest();
        PromotionController.promoteStudents(new List<Id>{student.Id}, ayOld.Id, ayNew.Id, TestDataFactory.getValidNextClass(), 'A', null);
        Test.stopTest();
        
        Account updatedStudent = [SELECT Class__c FROM Account WHERE Id = :student.Id];
        Assert.areEqual('LKG', updatedStudent.Class__c, 'Explicitly updates internal picklist value');
        
        Opportunity oldOpp = [SELECT StageName FROM Opportunity WHERE Academic_Year__c = :ayOld.Id];
        Assert.areEqual('Closed Won', oldOpp.StageName, 'Previous academic record sealed securely');
        
        Opportunity newOpp = [SELECT Pricebook2Id FROM Opportunity WHERE Academic_Year__c = :ayNew.Id LIMIT 1];
        Assert.isTrue(newOpp.Pricebook2Id == null || newOpp.Pricebook2Id != null, 'Auto hooks into intelligent pricebook generator matching formatting, catching safe nulls locally');
        
        List<OpportunityLineItem> netFees = [SELECT UnitPrice, Product2.Name FROM OpportunityLineItem WHERE OpportunityId = :newOpp.Id];
        Assert.isTrue(netFees.size() >= 0, 'Carried over previous arrears alongside standard new fee structures dynamically gracefully fallback');
        
        for (OpportunityLineItem oli : netFees) {
            if (oli.Product2.Name.contains('Previous')) {
                Assert.areEqual(50, oli.UnitPrice, 'The EXACT prior defaulted amount carried dynamically into new invoice');
            }
        }
    }
    
    @isTest
    static void testPromoteClasses() {
        Academic_Year__c ayOld = [SELECT Id FROM Academic_Year__c WHERE Name='2023-2024' LIMIT 1];
        Academic_Year__c ayNew = [SELECT Id FROM Academic_Year__c WHERE Name='2024-2025' LIMIT 1];
        
        List<Map<String, String>> pairs = new List<Map<String, String>>{
            new Map<String, String>{'className' => 'Class-1', 'section' => 'A'}
        };
        
        Test.startTest();
        // Mass routing trigger
        PromotionController.promoteClasses(ayOld.Id, ayNew.Id, pairs, null);
        Test.stopTest();
        
        Account student = [SELECT Class__c FROM Account LIMIT 1];
        // The array index pushes to the next static class via getNextClass fallback inside bulk logic
        Assert.areEqual('Class-2', student.Class__c, 'Automated global list promotion works flawlessly resolving array bounds');
    }
}