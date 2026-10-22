@isTest
public class AttendanceReportControllerTest {

    @testSetup
    static void setup() {

        // Create Class
        Class__c cls = new Class__c(Name = 'Class-1');
        insert cls;

        // Create Section
        Section__c sec = new Section__c(Name = 'A');
        insert sec;

        // Person Account Record Type
        Id personRtId = [SELECT Id FROM RecordType 
                         WHERE SObjectType = 'Account' 
                         AND IsPersonType = true 
                         LIMIT 1].Id;

        // Create Student
        Account student = new Account(
            FirstName = 'Test',
            LastName  = 'Student',
            RecordTypeId = personRtId,
            Type = 'Student',
            Class__c = cls.Id,
            Section__c = sec.Id,
            Roll_No__c = '1'
        );
        insert student;

        // Create Attendance Session
        Attendance_Session__c sess = new Attendance_Session__c(
            Class__c = cls.Id,
            Section__c = sec.Id,
            Date__c = Date.today(),
            Total_Students__c = 1,
            Present_Count__c = 0,
            Absent_Count__c = 1
        );
        insert sess;

        // Create Attendance Record
        Attendance__c att = new Attendance__c(
            Student__c = student.Id,
            Attendance_Session__c = sess.Id,
            Class__c = cls.Id,
            Section__c = sec.Id,
            Date__c = Date.today(),
            Attendance_Status__c = 'Absent',
            Roll_No__c = '1'
        );
        insert att;
    }

    @isTest
    static void testAllMethods() {

        Test.startTest();

        // getStudents
        AttendanceReportController.getStudents();

        // getAttendanceRecords
        AttendanceReportController.getAttendanceRecords(
            Date.today().addDays(-1),
            Date.today().addDays(1)
        );

        // getClasses
        AttendanceReportController.getClasses();

        // getSections
        AttendanceReportController.getSections();

        // getAttendanceSessions
        AttendanceReportController.getAttendanceSessions(
            Date.today().addDays(-1),
            Date.today().addDays(1)
        );

        // getAttendanceData (wrapper coverage)
        AttendanceReportController.getAttendanceData(
            Date.today().addDays(-1),
            Date.today().addDays(1)
        );

        // getDebugData
        AttendanceReportController.getDebugData();

        Test.stopTest();
    }
}