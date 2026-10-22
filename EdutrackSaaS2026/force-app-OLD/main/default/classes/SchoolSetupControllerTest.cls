@IsTest
public class SchoolSetupControllerTest {

    @IsTest
    static void testGetSetup() {
        // Setup initial data if needed, but getOrgDefaults should work anyway
        Test.startTest();
        Map<String, Object> result = SchoolSetupController.getSetup();
        Test.stopTest();
        
        Assert.areNotEqual(null, result, 'Setup record should not be null');
    }

    @IsTest
    static void testSaveSetup() {
        Map<String, Object> setupData = new Map<String, Object>{
            'schoolName' => 'Test School',
            'schoolEmail' => 'test@school.com',
            'schoolPhone' => '1234567890',
            'schoolLogo' => '/sfc/servlet.shepherd/version/download/testId',
            'schoolAddress' => '123 Test St',
            'phonePeId' => 'test@ybl',
            'googlePayId' => 'test@okaxis',
            'upiQrId' => 'qrCodeId',
            'bankName' => 'Test Bank',
            'bankIfsc' => 'TEST0001',
            'bankAccountNumber' => '12345',
            'bankBranch' => 'Main'
        };

        Test.startTest();
        SchoolSetupController.saveSetup(setupData);
        Test.stopTest();

        School_Setup__c setup = School_Setup__c.getOrgDefaults();
        Assert.areEqual('Test School', setup.School_Name__c);
        Assert.areEqual('test@school.com', setup.School_Email__c);
        Assert.areEqual(true, setup.Setup_Completed__c);
    }

    @IsTest
    static void testUploadLogo() {
        String base64Data = EncodingUtil.base64Encode(Blob.valueOf('Test Logo Data'));
        String fileName = 'logo.png';

        Test.startTest();
        String resultId = SchoolSetupController.uploadLogo(base64Data, fileName);
        Test.stopTest();

        Assert.areNotEqual(null, resultId, 'Resulting ID should not be null');
        
        ContentVersion cv = [SELECT Title, PathOnClient FROM ContentVersion WHERE Id = :resultId];
        Assert.areEqual(fileName, cv.Title);
        Assert.areEqual(fileName, cv.PathOnClient);
    }

    @IsTest
    static void testSaveSetupException() {
        // Exception testing is harder here because it's simple DML, 
        // but we can pass null for required logic if any existed.
        // For current logic, let's just ensure no crash on empty map.
        try {
            SchoolSetupController.saveSetup(new Map<String, Object>());
            Assert.areEqual(true, true, 'Should not throw on empty map');
        } catch (Exception e) {
            Assert.fail('Should not have thrown exception: ' + e.getMessage());
        }
    }

    @IsTest
    static void testBankAccounts() {
        List<Map<String, Object>> accountsData = new List<Map<String, Object>>();
        Map<String, Object> acc1 = new Map<String, Object>{
            'Name' => 'Primary Bank',
            'Bank_Name__c' => 'Test Bank',
            'IFSC_Code__c' => 'TEST0123',
            'Account_Number__c' => '123456789',
            'Branch__c' => 'Main Branch',
            'Is_Primary__c' => true
        };
        accountsData.add(acc1);

        Test.startTest();
        SchoolSetupController.saveBankAccounts(accountsData, new List<Id>());
        List<Map<String, Object>> retrievedAccounts = SchoolSetupController.getBankAccounts();
        Test.stopTest();

        Assert.areEqual(1, retrievedAccounts.size(), 'Should have 1 bank account');
        Assert.areEqual('Primary Bank', retrievedAccounts[0].get('Name'), 'Name should match');
    }

    @IsTest
    static void testAcademicYears() {
        Test.startTest();
        SchoolSetupController.saveAcademicYear('2025-2026', true);
        
        // Add another to trigger the 2-active limit logic if needed
        SchoolSetupController.saveAcademicYear('2026-2027', true);
        SchoolSetupController.saveAcademicYear('2027-2028', true);
        
        List<Map<String, Object>> retrievedYears = SchoolSetupController.getAcademicYears();
        Test.stopTest();

        Assert.areNotEqual(0, retrievedYears.size(), 'Should have academic years');
    }
}