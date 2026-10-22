@isTest
public class PromotionControllerTest {

    @testSetup
    static void setup() {

        // Academic Years
        Academic_Year__c ayOld = new Academic_Year__c(Name='2023-2024', Is_Active__c=true);
        insert ayOld;

        Academic_Year__c ayNew = new Academic_Year__c(Name='2024-2025', Is_Active__c=false);
        insert ayNew;

        // Create Class
        Class__c cls = new Class__c(Name='Class-1');
        insert cls;

        // Create Next Class (for promotion)
        Class__c nextCls = new Class__c(Name='Class-2');
        insert nextCls;

        // Create Section
        Section__c sec = new Section__c(Name='A');
        insert sec;

        // Person Account Record Type
        Id personRtId = [SELECT Id FROM RecordType 
                         WHERE SObjectType = 'Account' 
                         AND IsPersonType = true 
                         LIMIT 1].Id;

        // Create Student
        Account student = new Account(
            FirstName='Test',
            LastName='Student',
            RecordTypeId=personRtId,
            Type='Student',
            Class__c=cls.Id,
            Section__c=sec.Id,
            Roll_No__c='1'
        );
        insert student;

        // Opportunity
        Opportunity opp = new Opportunity(
            Name='Test Opp',
            AccountId=student.Id,
            StageName='Prospecting',
            CloseDate=Date.today(),
            Academic_Year__c=ayOld.Id
        );
        insert opp;

        // Products
        Product2 p = new Product2(Name='Fee', IsActive=true);
        insert p;

        Product2 prevFee = new Product2(Name='Previous Dues', IsActive=true);
        insert prevFee;

        Id stdPbId = Test.getStandardPricebookId();

        PricebookEntry pbe = new PricebookEntry(
            Pricebook2Id=stdPbId,
            Product2Id=p.Id,
            UnitPrice=100,
            IsActive=true
        );
        insert pbe;

        PricebookEntry pbePrev = new PricebookEntry(
            Pricebook2Id=stdPbId,
            Product2Id=prevFee.Id,
            UnitPrice=0,
            IsActive=true
        );
        insert pbePrev;

        insert new OpportunityLineItem(
            OpportunityId=opp.Id,
            PricebookEntryId=pbe.Id,
            Quantity=1,
            UnitPrice=100
        );

        // Invoice
        Invoice__c inv = new Invoice__c(
            Student__c=student.Id,
            Opportunity__c=opp.Id,
            Status__c='Paid'
        );
        insert inv;

        insert new Invoice_Item__c(
            Invoice__c=inv.Id,
            Amount__c=50
        );
    }

    @isTest
    static void testAllMethods() {

        Academic_Year__c ayOld = [SELECT Id FROM Academic_Year__c WHERE Name='2023-2024' LIMIT 1];
        Academic_Year__c ayNew = [SELECT Id FROM Academic_Year__c WHERE Name='2024-2025' LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();

        // getStudentsForPromotion
        PromotionController.getStudentsForPromotion(
            ayOld.Id,
            'Class-1',
            'A'
        );

        // invalid filter
        PromotionController.getStudentsForPromotion(
            ayOld.Id,
            'Invalid',
            'A'
        );

        // getClassSummaryData
        PromotionController.getClassSummaryData(ayOld.Id);

        // promoteStudents
        PromotionController.promoteStudents(
            new List<Id>{student.Id},
            ayOld.Id,
            ayNew.Id,
            'Class-2',
            'A',
            null
        );

        // promoteClasses
        List<Map<String, String>> pairs = new List<Map<String, String>>{
            new Map<String, String>{
                'className' => 'Class-1',
                'section' => 'A'
            }
        };

        PromotionController.promoteClasses(
            ayOld.Id,
            ayNew.Id,
            pairs,
            null
        );

        // promoteEntireClass
        PromotionController.promoteEntireClass(
            ayOld.Id,
            'Class-1',
            'A',
            ayNew.Id
        );

        // getClassOptions
        PromotionController.getClassOptions();

        // getSectionOptions
        PromotionController.getSectionOptions();

        Test.stopTest();
    }
}