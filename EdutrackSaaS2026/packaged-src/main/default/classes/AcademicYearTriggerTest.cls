@isTest
public class AcademicYearTriggerTest {
    
    @testSetup
    static void setupTestData() {
        Academic_Year__c ay1 = new Academic_Year__c(Name='2023-2024', Is_Active__c=true, Start_Date__c=Date.today().addDays(-365), End_Date__c=Date.today().addDays(-1));
        Academic_Year__c ay2 = new Academic_Year__c(Name='2024-2025', Is_Active__c=false, Start_Date__c=Date.today(), End_Date__c=Date.today().addDays(365));
        insert new List<Academic_Year__c>{ay1, ay2};
        
        Pricebook2 pb1 = new Pricebook2(Name='Fees 23-24', Academic_Year__c=ay1.Id, IsActive=true);
        Pricebook2 pb2 = new Pricebook2(Name='Fees 24-25', Academic_Year__c=ay2.Id, IsActive=false);
        insert new List<Pricebook2>{pb1, pb2};
    }

    @isTest
    static void testPricebookAutomationOnStatusChange() {
        Academic_Year__c oldYear = [SELECT Id, Is_Active__c FROM Academic_Year__c WHERE Name = '2023-2024' LIMIT 1];
        Academic_Year__c newYear = [SELECT Id, Is_Active__c FROM Academic_Year__c WHERE Name = '2024-2025' LIMIT 1];
        
        System.assertEquals(true, oldYear.Is_Active__c, 'Initial 2023-2024 should be active');
        System.assertEquals(false, newYear.Is_Active__c, 'Initial 2024-2025 should be inactive');
        
        Test.startTest();
        oldYear.Is_Active__c = false;
        newYear.Is_Active__c = true;
        update new List<Academic_Year__c>{oldYear, newYear};
        Test.stopTest();
        
        Pricebook2 pbOld = [SELECT Id, IsActive FROM Pricebook2 WHERE Academic_Year__c = :oldYear.Id LIMIT 1];
        Pricebook2 pbNew = [SELECT Id, IsActive FROM Pricebook2 WHERE Academic_Year__c = :newYear.Id LIMIT 1];
        
        System.assertEquals(false, pbOld.IsActive, 'Pricebook for 2023-2024 should have deactivated');
        System.assertEquals(true, pbNew.IsActive, 'Pricebook for 2024-2025 should have activated');
    }
}