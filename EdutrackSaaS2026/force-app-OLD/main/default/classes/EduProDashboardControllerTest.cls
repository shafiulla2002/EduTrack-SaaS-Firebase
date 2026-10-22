@isTest
public class EduProDashboardControllerTest {

    @testSetup
    static void setup() {

        // Academic Year
        Academic_Year__c ay = new Academic_Year__c(
            Name='2024-2025',
            Is_Active__c=true,
            Start_Date__c=Date.today().addDays(-30),
            End_Date__c=Date.today().addDays(30)
        );
        insert ay;

        // Create Class
        Class__c cls = new Class__c(Name='Class-1');
        insert cls;

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
            Roll_No__c='1'
        );
        insert student;

        // Paid Invoice
        Invoice__c inv = new Invoice__c(
            Student__c=student.Id,
            Status__c='Paid'
        );
        insert inv;

        insert new Invoice_Item__c(
            Invoice__c=inv.Id,
            Amount__c=100
        );

        // Overdue Invoice
        Invoice__c overdueInv = new Invoice__c(
            Student__c=student.Id,
            Status__c='Overdue'
        );
        insert overdueInv;

        insert new Invoice_Item__c(
            Invoice__c=overdueInv.Id,
            Amount__c=50
        );

        // Partial Invoice
        Invoice__c partialInv = new Invoice__c(
            Student__c=student.Id,
            Status__c='Partial'
        );
        insert partialInv;

        insert new Invoice_Item__c(
            Invoice__c=partialInv.Id,
            Amount__c=25
        );

        // Attendance
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

        // Exam
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
    }

    @isTest
    static void testAllMethods() {

        Test.startTest();

        // getDashboardMetrics
        EduProDashboardController.getDashboardMetrics();

        // getAllRecentAdmissions
        EduProDashboardController.getAllRecentAdmissions();

        // getAllRecentPayments
        EduProDashboardController.getAllRecentPayments();

        // globalSearch valid
        EduProDashboardController.globalSearch('Test');

        // globalSearch short string
        EduProDashboardController.globalSearch('T');

        Test.stopTest();
    }
}