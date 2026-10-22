@isTest
public class StudentControllerTest {
    @testSetup
    static void setup() {
        Academic_Year__c ay = new Academic_Year__c(Name='2024-2025', Is_Active__c=true, Start_Date__c=Date.today().addDays(-30), End_Date__c=Date.today().addDays(30));
        insert ay;
        
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId, Type='Student', Class__c=TestDataFactory.getValidClass(), Section__c='A', Roll_No__c='1');
        insert student;
        
        Opportunity opp = new Opportunity(Name='Test Opp', AccountId=student.Id, StageName='Prospecting', CloseDate=Date.today(), Academic_Year__c=ay.Id);
        insert opp;
        
        Product2 p = new Product2(Name='Fee', IsActive=true, Family='Fee');
        insert p;
        Id stdPbId = Test.getStandardPricebookId();
        PricebookEntry pbe = new PricebookEntry(Pricebook2Id=stdPbId, Product2Id=p.Id, UnitPrice=100, IsActive=true);
        insert pbe;
        
        insert new OpportunityLineItem(OpportunityId=opp.Id, PricebookEntryId=pbe.Id, Quantity=1, UnitPrice=100);
        
        Invoice__c inv = new Invoice__c(Student__c=student.Id, Opportunity__c=opp.Id, Status__c='Paid');
        insert inv;
        insert new Invoice_Item__c(Invoice__c=inv.Id, Amount__c=100);
        
        Class__c cls = new Class__c(Name=TestDataFactory.getValidClass()); insert cls;
        Attendance_Session__c sess = new Attendance_Session__c(Class__c=cls.Id, Date__c=Date.today());
        insert sess;
        insert new Attendance__c(Student__c=student.Id, Attendance_Session__c=sess.Id, Attendance_Status__c='Absent', Date__c=Date.today());
        
        insert new Case(AccountId=student.Id, Subject='Test Case', Status='New');
    }
    
    @isTest
    static void testSearchStudents() {
        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        List<StudentController.StudentListItem> results = StudentController.searchStudents('Test', ay.Id, TestDataFactory.getValidClass(), 'A');
        Assert.isFalse(results.isEmpty(), 'Should find target student dynamically');
        Assert.areEqual('TS', results[0].avatar, 'Avatar generated successfully');
        
        List<StudentController.StudentListItem> noMatch = StudentController.searchStudents('Nomatch', ay.Id, TestDataFactory.getValidClass(), 'A');
        Assert.isTrue(noMatch.isEmpty(), 'Empty search bounds obeyed');
        
        List<StudentController.StudentListItem> fallback = StudentController.searchStudents('', '', '', '');
        Assert.isFalse(fallback.isEmpty(), 'Returns unfiltered when empty params passed');
    }
    
    @isTest
    static void testGetStudentDetails() {
        Account student = [SELECT Id FROM Account LIMIT 1];
        StudentController.StudentDetail details = StudentController.getStudentDetails(student.Id);
        
        Assert.isNotNull(details.student, 'Returns hydrated student identity');
        Assert.isFalse(details.products.isEmpty(), 'Returns existing line items');
        Assert.isFalse(details.invoices.isEmpty(), 'Returns generated payments');
        Assert.isNotNull(details.exams, 'Safely builds dynamic exam schema query');
        System.debug('>>> DEBUG details.attendanceStats = ' + JSON.serialize(details.attendanceStats));
        Assert.isFalse(details.attendanceStats.isEmpty(), 'Wraps stats cleanly');
        Assert.isFalse(details.cases.isEmpty(), 'Fetches relationship cases');
        Assert.areEqual(1, details.attendanceStats[0].attendance[0].cnt, 'Correct absence count parsed');
    }
    
    @isTest
    static void testGetAcademicYearOptions() {
        List<Map<String, String>> ayOptions = StudentController.getAcademicYearOptions();
        Assert.isFalse(ayOptions.isEmpty(), 'Should return mapped dict values for AYs');
    }
    
    @isTest
    static void testApplyDiscount() {
        Account student = [SELECT Id FROM Account LIMIT 1];
        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        
        StudentController.applyDiscount(student.Id, ay.Id, 10);
        
        OpportunityLineItem oli = [SELECT Discount FROM OpportunityLineItem LIMIT 1];
        Assert.areEqual(10, oli.Discount, 'Mass discount applied correctly to Opportunity');
        
        try {
            StudentController.applyDiscount(null, ay.Id, 10);
            Assert.fail('Should intercept missing queries immediately');
        } catch(AuraHandledException e) {
            Assert.isNotNull(e.getMessage(), 'Exposed exception tracked to UI cleanly');
        }
    }
    
    @isTest
    static void testGetCandidatesByBatch() {
        List<Map<String, Object>> candidates = StudentController.getCandidatesByBatch('2024-2025', TestDataFactory.getValidClass(), 'A');
        Assert.isFalse(candidates.isEmpty(), 'Finds candidate Accounts');
    }
}