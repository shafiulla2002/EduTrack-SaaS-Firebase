@isTest
public class AdmissionControllerTest {

    public class MockHttpResponseGenerator implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'image/png');
            res.setBodyAsBlob(Blob.valueOf('test image'));
            res.setStatusCode(200);
            return res;
        }
    }

    @testSetup
    static void setup() {
        // Create a separate user for setup to avoid Mixed DML with current user
        User u = EduTrackTestUtils.createAdminUser();
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'EduTrack_Full_Access' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id);

        System.runAs(u) {
            // Academic Year
            Academic_Year__c ay = new Academic_Year__c(
                Name = '2025-2026',
                Is_Active__c = true,
                Start_Date__c = Date.today(),
                End_Date__c = Date.today().addDays(365)
            );
            insert ay;

            // Class & Section
            Class__c cls = new Class__c(Name = 'Class-1');
            insert cls;

            Section__c sec = new Section__c(Name = 'A');
            insert sec;

            // Person Account
            Id personRtId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;

            Account acc = new Account(
                FirstName = 'Test',
                LastName = 'Student',
                RecordTypeId = personRtId,
                Class__c = cls.Id,
                Section__c = sec.Id
            );
            insert acc;

            // Opportunity
            Opportunity opp = new Opportunity(
                Name = 'Test Opp',
                AccountId = acc.Id,
                StageName = 'Prospecting',
                CloseDate = Date.today(),
                Class__c = cls.Id,
                Section__c = sec.Id,
                Academic_Year__c = ay.Id
            );
            insert opp;

            // Product
            Product2 prod = new Product2(Name='Fee', Family='Fee', IsActive=true);
            insert prod;

            // Standard Pricebook
            Id stdPbId = Test.getStandardPricebookId();

            PricebookEntry stdPbe = new PricebookEntry(
                Pricebook2Id = stdPbId,
                Product2Id = prod.Id,
                UnitPrice = 100,
                IsActive = true
            );
            insert stdPbe;

            // Custom Pricebook
            Pricebook2 pb = new Pricebook2(
                Name = 'Class 1',
                IsActive = true,
                Academic_Year__c = ay.Id
            );
            insert pb;

            PricebookEntry customPbe = new PricebookEntry(
                Pricebook2Id = pb.Id,
                Product2Id = prod.Id,
                UnitPrice = 100,
                IsActive = true
            );
            insert customPbe;

            // OLI
            OpportunityLineItem oli = new OpportunityLineItem(
                OpportunityId = opp.Id,
                PricebookEntryId = stdPbe.Id,
                Quantity = 1,
                UnitPrice = 100
            );
            insert oli;

            // Invoice
            Invoice__c inv = new Invoice__c(
                Opportunity__c = opp.Id,
                Student__c = acc.Id,
                Status__c = 'Paid'
            );
            insert inv;

            Invoice_Item__c item = new Invoice_Item__c(
                Invoice__c = inv.Id,
                Opportunity_Line_Item_Id__c = oli.Id,
                Amount__c = 50
            );
            insert item;
        }
    }

    @isTest
    static void testCreateAdmission() {

        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        Class__c cls = [SELECT Id FROM Class__c LIMIT 1];
        Section__c sec = [SELECT Id FROM Section__c LIMIT 1];
        PricebookEntry pbe = [SELECT Id FROM PricebookEntry WHERE Pricebook2.Name = 'Class 1' LIMIT 1];

        Map<String, String> data = new Map<String, String>{
            'firstName' => 'New',
            'lastName' => 'Student',
            'email' => 'new@test.com',
            'phone' => '1234567890',
            'dob' => '2015-01-01',
            'selectedClass' => cls.Id,
            'selectedSection' => sec.Id,
            'academicYear' => ay.Id,
            'fatherName' => 'Father',
            'motherName' => 'Mother'
        };

        Test.startTest();
        Map<String, Object> result;
        User u = EduTrackTestUtils.createTestUser();
        System.runAs(u) {
            result = AdmissionController.createAdmission(data, new List<Id>{pbe.Id}, 10);
        }
        Test.stopTest();

        System.assertEquals(true, result.get('success'));
    }

    @isTest
    static void testGetActiveProducts() {
        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        Class__c cls = [SELECT Id FROM Class__c LIMIT 1];

        Test.startTest();
        List<PricebookEntry> pbes;
        User u = EduTrackTestUtils.createTestUser();
        System.runAs(u) {
            pbes = AdmissionController.getActiveProducts(cls.Id, ay.Id);
        }
        Test.stopTest();

        System.assertNotEquals(0, pbes.size());
    }

    @isTest
    static void testSearchAndGetStudent() {
        Account acc = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();
        User u = EduTrackTestUtils.createTestUser();
        System.runAs(u) {
            AdmissionController.searchStudents('Test', Double.valueOf(1));
            AdmissionController.getStudentById(acc.Id, Double.valueOf(1));
        }
        Test.stopTest();
    }

    @isTest
    static void testInvoiceAndFees() {

        Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];
        Account acc = [SELECT Id FROM Account LIMIT 1];
        OpportunityLineItem oli = [SELECT Id, Product2Id FROM OpportunityLineItem LIMIT 1];

        Test.startTest();
        User u = EduTrackTestUtils.createTestUser();
        Id invId;
        System.runAs(u) {
                AdmissionController.getUnpaidFees(opp.Id);

                List<Map<String, Object>> items = new List<Map<String, Object>>{
                    new Map<String, Object>{
                        'oliId' => (String)oli.Id,
                        'productId' => oli.Product2Id,
                        'amount' => 50
                    }
                };

                Map<String, String> bank = new Map<String, String>{
                    'bankName' => 'SBI',
                    'bankIfsc' => 'SBIN001',
                    'bankAccountNumber' => '123',
                    'bankBranch' => 'City'
                };

                invId = AdmissionController.createInvoice(opp.Id, acc.Id, items, 'Cash', bank);

                AdmissionController.getRecentInvoices(acc.Id);
                AdmissionController.voidInvoice(invId);
            }
            Test.stopTest();

            System.assertNotEquals(null, invId);
    }

    @isTest
    static void testQRCode() {
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());
        AdmissionController.getQRCodeBase64('http://test.com');
        Test.stopTest();
    }

    @isTest
    static void testDiscounts() {
        OpportunityLineItem oli = [SELECT Id FROM OpportunityLineItem LIMIT 1];

        Test.startTest();
        User u = EduTrackTestUtils.createTestUser();
        System.runAs(u) {
            AdmissionController.updateLineItemDiscount(oli.Id, 10);
            AdmissionController.updateBulkLineItemDiscounts(new List<String>{oli.Id}, 20);
        }
        Test.stopTest();
    }

    @isTest
    static void testOptionsAndCSV() {
        Test.startTest();
        AdmissionController.getAcademicYearOptions();
        AdmissionController.getClassOptions();
        AdmissionController.getSectionOptions(null);
        AdmissionController.getAdmissionPicklistValues();
        AdmissionController.getAdmissionCSVTemplate();
        Test.stopTest();
    }

@isTest
static void testImportStudentsBulk() {

    Academic_Year__c ay = [SELECT Name FROM Academic_Year__c LIMIT 1];

    // ✅ Ensure Class exists EXACTLY same
    Class__c cls = [SELECT Name FROM Class__c LIMIT 1];

    List<Map<String, String>> data = new List<Map<String, String>>();

    data.add(new Map<String, String>{
        'First Name' => 'John',
        'Last Name' => 'Doe',
        'Phone' => '9999999999', 
        'Class' => cls.Name, // ✅ dynamic match
        'Academic Year' => ay.Name
    });

    Test.startTest();
    User u = EduTrackTestUtils.createTestUser();
    Map<String, Object> res;
    System.runAs(u) {
        res = AdmissionController.importStudentsBulk(data);
    }
    Test.stopTest();

    System.assertNotEquals(null, res);
}
}
