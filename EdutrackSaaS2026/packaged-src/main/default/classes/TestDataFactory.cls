@isTest
public class TestDataFactory {
    // Schema Utility Fallbacks
    public static String getValidClass() {
        try { return Account.Class__c.getDescribe().getPicklistValues()[0].getValue(); } catch(Exception e) { return 'Class 1'; }
    }
    public static String getValidNextClass() {
        try { return Account.Class__c.getDescribe().getPicklistValues()[1].getValue(); } catch(Exception e) { return 'Class 2'; }
    }
    public static String getValidSubject() {
        try { return Account.Subject__c.getDescribe().getPicklistValues()[0].getValue(); } catch(Exception e) { return 'Maths'; }
    }
    
    // Core User Creation
    public static User createTestUser(String profileName) {
        Profile p = [SELECT Id FROM Profile WHERE Name = :profileName LIMIT 1];
        String randomStr = String.valueOf(Crypto.getRandomInteger()).substring(0, 6);
        User u = new User(
            Alias = 'tst' + randomStr,
            Email = 'testuser' + randomStr + '@vikasschool.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing' + randomStr,
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'testuser' + randomStr + '@vikasschool.test.org'
        );
        insert u;
        return u;
    }

    // Account Creation (Student/Parent)
    public static Account createStudentAccount(String name) {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account acc = new Account(
            FirstName = 'Test',
            LastName = name,
            RecordTypeId = personAccountRecordTypeId,
            Type = 'Student',
            Phone = '1234567890'
        );
        insert acc;
        return acc;
    }

    // Opportunity Creation (Admission)
    public static Opportunity createAdmissionOpportunity(Id accountId, String stageName) {
        Opportunity opp = new Opportunity(
            Name = 'Admission - ' + Date.today().year(),
            AccountId = accountId,
            StageName = stageName,
            CloseDate = Date.today().addDays(30)
        );
        insert opp;
        return opp;
    }

    // Pricebook Creation
    public static Pricebook2 createCustomPricebook(String name) {
        Pricebook2 pb = new Pricebook2(
            Name = name,
            IsActive = true
        );
        insert pb;
        return pb;
    }

    // Product Creation
    public static Product2 createProduct(String name, String family) {
        Product2 prod = new Product2(
            Name = name,
            Family = family,
            IsActive = true
        );
        insert prod;
        return prod;
    }

    // PricebookEntry Creation
    public static PricebookEntry createPricebookEntry(Id pricebookId, Id productId, Decimal price) {
        PricebookEntry pbe = new PricebookEntry(
            Pricebook2Id = pricebookId,
            Product2Id = productId,
            UnitPrice = price,
            IsActive = true
        );
        insert pbe;
        return pbe;
    }

    // Exam Creation
    public static sObject createExam(Id studentAccountId, String examName) {
        // Assuming Exam__c exists. Using Schema.getGlobalDescribe to dynamically create to avoid compile errors if object doesn't exist yet in the way we expect
        SObjectType examType = Schema.getGlobalDescribe().get('Exam__c');
        if (examType == null) return null;
        
        SObject exam = examType.newSObject();
        exam.put('Name', examName);
        try {
            exam.put('Student__c', studentAccountId);
        } catch (Exception e) {
            // Field might be named differently
        }
        insert exam;
        return exam;
    }
    
    // Attendance Creation
    public static sObject createAttendance(Id studentAccountId, Date attendanceDate, String status) {
        SObjectType attendanceType = Schema.getGlobalDescribe().get('Attendance__c');
        if (attendanceType == null) return null;
        
        SObject attendance = attendanceType.newSObject();
        try {
            attendance.put('Student__c', studentAccountId);
            attendance.put('Date__c', attendanceDate);
            attendance.put('Status__c', status);
        } catch (Exception e) {}
        
        insert attendance;
        return attendance;
    }
    
    // Invoice Creation
    public static Invoice__c createInvoice(Id studentId, Id opportunityId, String status) {
        Invoice__c inv = new Invoice__c(
            Student__c = studentId,
            Opportunity__c = opportunityId,
            Status__c = status,
            Invoice_Date__c = Date.today(),
            Payment_Method__c = 'Cash'
        );
        insert inv;
        return inv;
    }

    // Invoice Item Creation
    public static Invoice_Item__c createInvoiceItem(Id invoiceId, Id oliId, Id productId, Decimal amount) {
        Invoice_Item__c item = new Invoice_Item__c(
            Invoice__c = invoiceId,
            Opportunity_Line_Item_Id__c = oliId,
            Opportunity_Product__c = oliId,
            Product__c = productId,
            Amount__c = amount
        );
        insert item;
        return item;
    }
}