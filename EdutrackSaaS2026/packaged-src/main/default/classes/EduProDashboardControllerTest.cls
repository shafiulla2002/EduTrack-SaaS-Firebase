@isTest
public class EduProDashboardControllerTest {
    @testSetup
    static void setup() {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId, Type='Student', Class__c=TestDataFactory.getValidClass(), Roll_No__c='1');
        insert student;
        
        Invoice__c inv = new Invoice__c(Student__c=student.Id, Status__c='Paid');
        insert inv;
        
        insert new Invoice_Item__c(Invoice__c=inv.Id, Amount__c=100);
        
        Invoice__c overdueInv = new Invoice__c(Student__c=student.Id, Status__c='Overdue');
        insert overdueInv;
        insert new Invoice_Item__c(Invoice__c=overdueInv.Id, Amount__c=50);
        
        Invoice__c partialInv = new Invoice__c(Student__c=student.Id, Status__c='Partial');
        insert partialInv;
        insert new Invoice_Item__c(Invoice__c=partialInv.Id, Amount__c=25);
        
        Academic_Year__c ay = new Academic_Year__c(Name='2024-2025', Is_Active__c=true, Start_Date__c=Date.today().addDays(-30), End_Date__c=Date.today().addDays(30));
        insert ay;
        
        Class__c cls = new Class__c(Name=TestDataFactory.getValidClass()); 
        insert cls;
        
        Attendance_Session__c sess = new Attendance_Session__c(Class__c=cls.Id, Date__c=Date.today());
        insert sess;
        
        insert new Attendance__c(Student__c=student.Id, Attendance_Session__c=sess.Id, Attendance_Status__c='Absent', Date__c=Date.today());
        
        insert new Exam__c(Student__c=student.Id, English__c='80', Maths__c='90', Science__c='85', Social__c='88', Computer__c='95', Telugu__c='75', Hindi__c=82);
    }
    
    @isTest
    static void testGetDashboardMetrics() {
        Map<String, Object> metrics = EduProDashboardController.getDashboardMetrics();
        Assert.isNotNull(metrics, 'Should return metrics map');
        Assert.areEqual(1, metrics.get('totalStudents'), 'Should count 1 student');
        Assert.areEqual(100, metrics.get('totalRevenue'), 'Should calculate total paid revenue only');
        
        List<Map<String, String>> admissions = (List<Map<String, String>>) metrics.get('recentAdmissions');
        Assert.isFalse(admissions.isEmpty(), 'Should have recent admissions');
        Assert.isNotNull(admissions[0].get('avatar'), 'Avatar initials should be generated');
        Assert.areEqual('TS', admissions[0].get('avatar'), 'Avatar should be TS for Test Student');
        
        List<Map<String, String>> overview = (List<Map<String, String>>) metrics.get('paymentOverview');
        Assert.areEqual(3, overview.size(), 'Should return 3 recent invoices');
    }
    @isTest
    static void testGetAllRecentRecords() {
        List<Map<String, String>> admissions = EduProDashboardController.getAllRecentAdmissions();
        Assert.isFalse(admissions.isEmpty(), 'Should return all recent admissions');
        
        List<Map<String, String>> payments = EduProDashboardController.getAllRecentPayments();
        Assert.isFalse(payments.isEmpty(), 'Should return all recent payments');
    }
    @isTest
    static void testGlobalSearch() {
        Map<String, List<Map<String, String>>> results = EduProDashboardController.globalSearch('Test');
        Assert.isTrue(results.containsKey('results'), 'Should contain results key');
        Assert.isFalse(results.get('results').isEmpty(), 'Should return some results');
        
        results = EduProDashboardController.globalSearch('T');
        Assert.isTrue(results.isEmpty(), 'Should return empty for short search term');
    }
}