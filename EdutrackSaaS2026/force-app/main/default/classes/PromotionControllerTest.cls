@isTest
public class PromotionControllerTest {

    @testSetup
    static void setup() {
        User u = EduTrackTestUtils.createTestUser();
    }

    @isTest
    static void testAllMethods() {
        User u = [SELECT Id FROM User WHERE Alias = 'ettest' LIMIT 1];
        System.runAs(u) {
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
                             WHERE SObjectType='Account' 
                             AND IsPersonType=true 
                             LIMIT 1].Id;

            // Student
            Account student = new Account(
                FirstName='Test',
                LastName='Student',
                RecordTypeId=personRtId,
                Type='Student',
                Class__c=cls.Id,
                Section__c=sec.Id,
                Roll_No__c='101'
            );
            insert student;

            // Opportunity
            Opportunity opp = new Opportunity(
                Name='Test Fee',
                AccountId=student.Id,
                StageName='Closed Won',
                CloseDate=Date.today(),
                Academic_Year__c=ayOld.Id
            );
            insert opp;

            // Fee Products
            Product2 fee = new Product2(Name='Term Fee', IsActive=true);
            insert fee;

            Product2 prevFee = new Product2(Name='Previous Fee', IsActive=true);
            insert prevFee;

            Id stdPbId = Test.getStandardPricebookId();

            PricebookEntry pbe = new PricebookEntry(
                Pricebook2Id=stdPbId,
                Product2Id=fee.Id,
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
                Status__c='Paid',
                Invoice_Date__c=Date.today()
            );
            insert inv;

            insert new Invoice_Item__c(
                Invoice__c=inv.Id,
                Amount__c=50
            );

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
}
