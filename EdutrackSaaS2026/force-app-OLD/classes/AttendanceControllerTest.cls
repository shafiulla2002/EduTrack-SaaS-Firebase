@isTest
public class AttendanceControllerTest {

    @testSetup
    static void setup() {

        // Create Class
        Class__c cls = new Class__c(Name = 'Class-1');
        insert cls;

        // Create Section
        Section__c sec = new Section__c(Name = 'A');
        insert sec;

        // Get Person Account Record Type
        Id personRtId = [SELECT Id FROM RecordType 
                         WHERE SObjectType = 'Account' 
                         AND IsPersonType = true LIMIT 1].Id;

        // Create Teacher
        Account teacher = new Account(
            FirstName = 'Teacher',
            LastName  = 'One',
            RecordTypeId = personRtId,
            Type = 'Teacher'
        );
        insert teacher;

        // Create Student
        Account student = new Account(
            FirstName = 'Test',
            LastName  = 'Student',
            RecordTypeId = personRtId,
            Class__c = cls.Id,
            Section__c = sec.Id,
            Roll_No__c = '1'
        );
        insert student;

        // Create Session
        Attendance_Session__c sess = new Attendance_Session__c(
            Class__c = cls.Id,
            Section__c = sec.Id,
            Date__c = Date.today(),
            Attendance_Taken_By__c = teacher.Id
        );
        insert sess;

        // Create Attendance
        Attendance__c att = new Attendance__c(
            Student__c = student.Id,
            Attendance_Session__c = sess.Id,
            Class__c = cls.Id,
            Section__c = sec.Id,
            Date__c = Date.today(),
            Attendance_Status__c = 'Absent'
        );
        insert att;
    }

    @isTest
    static void testAllMethods() {

        Class__c cls = [SELECT Id, Name FROM Class__c LIMIT 1];
        Section__c sec = [SELECT Id, Name FROM Section__c LIMIT 1];
        Account student = [SELECT Id FROM Account WHERE Type = null LIMIT 1];
        Account teacher = [SELECT Id FROM Account WHERE Type = 'Teacher' LIMIT 1];

        Test.startTest();

        // getClasses
        AttendanceController.getClasses();

        // getSections
        AttendanceController.getSections();

        // getTeachers
        AttendanceController.getTeachers();

        // getStudents
        AttendanceController.getStudents(cls.Name, sec.Name);

        // getSessionData
        AttendanceController.getSessionData(cls.Name, sec.Name, Date.today());

        // saveAttendance (update existing)
        AttendanceController.saveAttendance(
            cls.Name,
            sec.Name,
            String.valueOf(Date.today()),
            new List<String>{student.Id},
            1,
            1,
            0,
            teacher.Id
        );

        // saveAttendance (new class + section creation)
        AttendanceController.saveAttendance(
            'Class-2',
            'B',
            String.valueOf(Date.today()),
            new List<String>{student.Id},
            1,
            1,
            0,
            teacher.Id
        );

        // duplicate session scenario
        insert new Attendance_Session__c(
            Class__c = cls.Id,
            Section__c = sec.Id,
            Date__c = Date.today().addDays(-1)
        );

        insert new Attendance_Session__c(
            Class__c = cls.Id,
            Section__c = sec.Id,
            Date__c = Date.today().addDays(-1)
        );

        AttendanceController.saveAttendance(
            cls.Name,
            sec.Name,
            String.valueOf(Date.today().addDays(-1)),
            new List<String>(),
            1,
            0,
            1,
            teacher.Id
        );

        // exception case
        try {
            AttendanceController.saveAttendance(null, null, '', null, 0, 0, 0, null);
        } catch (Exception e) {}

        Test.stopTest();
    }
}