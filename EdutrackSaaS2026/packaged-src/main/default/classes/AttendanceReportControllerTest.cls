@isTest
public class AttendanceReportControllerTest {
    @testSetup
    static void setup() {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId, Type='Student', Class__c=TestDataFactory.getValidClass(), Section__c='A', Roll_No__c='1');
        insert student;
        
        Class__c cls = new Class__c(Name=TestDataFactory.getValidClass());
        insert cls;
        
        Attendance_Session__c sess = new Attendance_Session__c(Class__c=cls.Id, Section__c='A', Date__c=Date.today(), Total_Students__c=1, Present_Count__c=0, Absent_Count__c=1);
        insert sess;
        
        Attendance__c att = new Attendance__c(Student__c=student.Id, Attendance_Session__c=sess.Id, Class__c=TestDataFactory.getValidClass(), Section__c='A', Date__c=Date.today(), Attendance_Status__c='Absent');
        insert att;
    }
    
    @isTest
    static void testGetStudents() {
        List<AttendanceReportController.StudentWrapper> students = AttendanceReportController.getStudents();
        Assert.isFalse(students.isEmpty(), 'Should return students');
        Assert.areEqual('1', students[0].rollNo, 'Roll Number should match');
    }
    
    @isTest
    static void testGetAttendanceRecords() {
        List<AttendanceReportController.AttendanceWrapper> records = AttendanceReportController.getAttendanceRecords(Date.today().addDays(-1), Date.today().addDays(1));
        Assert.isFalse(records.isEmpty(), 'Should return records within date range');
    }
    
    @isTest
    static void testGetOptions() {
        List<String> classes = AttendanceReportController.getClasses();
        Assert.isFalse(classes.isEmpty(), 'Should return classes dynamically');
        
        List<String> sections = AttendanceReportController.getSections();
        Assert.isFalse(sections.isEmpty(), 'Should return sections dynamically');
    }
    
    @isTest
    static void testGetAttendanceSessions() {
        List<AttendanceReportController.AttendanceSessionWrapper> sessions = AttendanceReportController.getAttendanceSessions(Date.today().addDays(-1), Date.today().addDays(1));
        Assert.isFalse(sessions.isEmpty(), 'Should return sessions in range');
        Assert.areEqual(1, sessions[0].totalStudents, 'Metadata counts should match');
    }
    
    @isTest
    static void testGetAttendanceData() {
        AttendanceReportController.AttendanceDataWrapper data = AttendanceReportController.getAttendanceData(Date.today().addDays(-1), Date.today().addDays(1));
        Assert.isNotNull(data, 'Should return fully nested AttendanceDataWrapper');
        Assert.isFalse(data.students.isEmpty(), 'Nested students should exist');
        Assert.isFalse(data.attendanceRecords.isEmpty(), 'Nested records should exist');
    }
    
    @isTest
    static void testGetDebugData() {
        String debug = AttendanceReportController.getDebugData();
        Assert.isNotNull(debug, 'Should return debug string');
        Assert.isTrue(debug.contains('Total Acc'), 'Should follow debug format');
    }
}