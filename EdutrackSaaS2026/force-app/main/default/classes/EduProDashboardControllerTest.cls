@isTest
public class EduProDashboardControllerTest {

    @isTest
    static void testAllMethods() {
        User u = EduTrackTestUtils.createTestUser();
        System.runAs(u) {
            Academic_Year__c ay = new Academic_Year__c(
                Name='2024-2025',
                Is_Active__c=true,
                Start_Date__c=Date.today().addDays(-30),
                End_Date__c=Date.today().addDays(30)
            );
            insert ay;

            Class__c cls = new Class__c(Name='Class-1');
            insert cls;

            Id personRtId = [SELECT Id FROM RecordType WHERE SObjectType='Account' AND IsPersonType=true LIMIT 1].Id;

            Account student = new Account(
                FirstName='Test',
                LastName='Student',
                RecordTypeId=personRtId,
                Type='Student',
                Class__c=cls.Id,
                Roll_No__c='1'
            );
            insert student;

            Invoice__c inv = new Invoice__c(
                Student__c=student.Id,
                Status__c='Paid',
                Invoice_Date__c=Date.today()
            );
            insert inv;

            insert new Invoice_Item__c(
                Invoice__c=inv.Id,
                Amount__c=100
            );

            Attendance_Session__c sess = new Attendance_Session__c(
                Class__c=cls.Id,
                Date__c=Date.today()
            );
            insert sess;

            insert new Attendance__c(
                Student__c=student.Id,
                Attendance_Session__c=sess.Id,
                Attendance_Status__c='Absent',
                Date__c=Date.today()
            );

            insert new Exam__c(
                Student__c=student.Id,
                English__c='80',
                Maths__c='90',
                Science__c='85',
                Social__c='88',
                Computer__c='95',
                Telugu__c='75',
                Hindi__c=82
            );

            Test.startTest();
            EduProDashboardController.getDashboardMetrics();
            EduProDashboardController.getAllRecentAdmissions();
            EduProDashboardController.getAllRecentPayments();
            EduProDashboardController.globalSearch('Test');
            EduProDashboardController.globalSearch('T');
            EduProDashboardController.getSchoolSetup();
            Test.stopTest();
        }
    }
}
