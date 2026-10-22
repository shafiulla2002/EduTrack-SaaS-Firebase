@isTest
public class PricebookAutomationHandlerTest {
    @testSetup
    static void setup() {
        Academic_Year__c ayOld = new Academic_Year__c(Name='2023-2024', Is_Active__c=true);
        insert ayOld;
        
        Pricebook2 pbOld = new Pricebook2(Name='Old PB', Academic_Year__c=ayOld.Id, IsActive=true);
        insert pbOld;
        
        Academic_Year__c ayNew = new Academic_Year__c(Name='2024-2025', Is_Active__c=false);
        insert ayNew;
        
        Pricebook2 pbNew = new Pricebook2(Name='New PB', Academic_Year__c=ayNew.Id, IsActive=false);
        insert pbNew;
    }
    
    @isTest
    static void testHandleStatusChange() {
        Academic_Year__c ayNew = [SELECT Id, Is_Active__c FROM Academic_Year__c WHERE Name='2024-2025' LIMIT 1];
        Academic_Year__c ayOld = [SELECT Id, Is_Active__c FROM Academic_Year__c WHERE Name='2023-2024' LIMIT 1];
        
        Test.startTest();
        // Update old academic year to inactive in DB so the handler's SOQL finds it
        ayOld.Is_Active__c = false;
        update ayOld;
        
        // Invoke handler manually isolating logic completely
        Map<Id, Academic_Year__c> oldMap = new Map<Id, Academic_Year__c>();
        Academic_Year__c decoupledAy = new Academic_Year__c(Id = ayNew.Id, Is_Active__c = false);
        oldMap.put(ayNew.Id, decoupledAy);
        
        // Ensure flag is correctly processed as active
        ayNew.Is_Active__c = true;
        PricebookAutomationHandler.handleStatusChange(new List<Academic_Year__c>{ayNew}, oldMap);
        Test.stopTest();
        
        Pricebook2 updatedPbNew = [SELECT IsActive FROM Pricebook2 WHERE Academic_Year__c = :ayNew.Id];
        Assert.isTrue(updatedPbNew.IsActive, 'New Pricebook should be securely activated internally');
        
        Pricebook2 updatedPbOld = [SELECT IsActive FROM Pricebook2 WHERE Academic_Year__c = :ayOld.Id];
        Assert.isFalse(updatedPbOld.IsActive, 'Old Pricebook should be formally deactivated');
    }
}