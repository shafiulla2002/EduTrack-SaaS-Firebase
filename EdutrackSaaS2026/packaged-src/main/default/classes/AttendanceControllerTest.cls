@isTest
public class AttendanceControllerTest {
    @testSetup
    static void setup() {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        
        // Student
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId, Class__c=TestDataFactory.getValidClass(), Section__c='A', Roll_No__c='1');
        insert student;
        
        // Teacher
        Account teacher = new Account(FirstName='Test', LastName='Teacher', RecordTypeId=personAccountRecordTypeId, Type='Teacher', Subject__c='Maths');
        insert teacher;
        
        Class__c cls = new Class__c(Name=TestDataFactory.getValidClass());
        insert cls;
        
        Attendance_Session__c sess = new Attendance_Session__c(Class__c=cls.Id, Section__c='A', Date__c=Date.today());
        insert sess;
        
        Attendance__c att = new Attendance__c(Student__c=student.Id, Attendance_Session__c=sess.Id, Date__c=Date.today(), Attendance_Status__c='Absent', Class__c=TestDataFactory.getValidClass(), Section__c='A');
        insert att;
    }
    
    @isTest
    static void testGetOptions() {
        List<AttendanceController.Option> classes = AttendanceController.getClasses();
        Assert.isFalse(classes.isEmpty(), 'Should return classes');
        
        List<AttendanceController.Option> sections = AttendanceController.getSections();
        Assert.isFalse(sections.isEmpty(), 'Should return sections');
    }
    
    @isTest
    static void testGetRecentSubmissions() {
        // Test with no submissions today (except the one in setup which might not have Attendance_Taken_By__c)
        List<Map<String, String>> pendingResults = AttendanceController.getRecentSubmissions();
        Assert.isFalse(pendingResults.isEmpty());
        
        // Update session to have teacher
        Attendance_Session__c sess = [SELECT Id FROM Attendance_Session__c LIMIT 1];
        
        // Dynamically resolve target for Attendance_Taken_By__c to avoid deployment/test failures
        Schema.DescribeFieldResult dr = Attendance_Session__c.Attendance_Taken_By__c.getDescribe();
        
        for (Schema.sObjectType targetType : dr.getReferenceTo()) {
            String targetObj = targetType.getDescribe().getName();
            if (targetObj == 'User') {
                sess.Attendance_Taken_By__c = UserInfo.getUserId();
                break;
            } else if (targetObj == 'Contact') {
                Account teacher = [SELECT PersonContactId FROM Account WHERE Type='Teacher' LIMIT 1];
                if (teacher.PersonContactId != null) {
                    sess.Attendance_Taken_By__c = teacher.PersonContactId;
                    break;
                }
            } else if (targetObj == 'Account') {
                Account teacher = [SELECT Id FROM Account WHERE Type='Teacher' LIMIT 1];
                sess.Attendance_Taken_By__c = teacher.Id;
                break;
            }
        }
        
        update sess;
        
        List<Map<String, String>> submittedResults = AttendanceController.getRecentSubmissions();
        Assert.isFalse(submittedResults.isEmpty());
        Assert.isTrue(submittedResults[0].get('text').contains('submitted by'), 'Should show submission text');
    }

    @isTest
    static void testGetTeachers() {
        List<Map<String, String>> teachers = AttendanceController.getTeachers();
        Assert.isFalse(teachers.isEmpty(), 'Should return teachers');
        Assert.areEqual('Test Teacher', teachers[0].get('name'));
    }
    
    @isTest
    static void testGetStudents() {
        List<Map<String, Object>> students = AttendanceController.getStudents(TestDataFactory.getValidClass(), 'A');
        Assert.areEqual(1, students.size(), 'Should return 1 student');
    }
    
    @isTest
    static void testGetSessionData() {
        AttendanceController.SessionData data = AttendanceController.getSessionData(TestDataFactory.getValidClass(), 'A', Date.today());
        Assert.isTrue(data.sessionExists, 'Session should exist');
        
        List<String> absents = AttendanceController.getAbsentStudents(TestDataFactory.getValidClass(), 'A', Date.today());
        Assert.areEqual(1, absents.size(), 'Should return 1 absentee from fallback method');

        // Edge case: empty values
        AttendanceController.SessionData emptyData = AttendanceController.getSessionData('', '', null);
        Assert.isFalse(emptyData.sessionExists);
    }
    
    @isTest
    static void testSaveAttendance() {
        Account student = [SELECT Id FROM Account WHERE LastName='Student' LIMIT 1];
        Account teacher = [SELECT Id FROM Account WHERE Type='Teacher' LIMIT 1];
        
        // Successful update of existing session where absent student becomes present
        AttendanceController.SessionData result = AttendanceController.saveAttendance(TestDataFactory.getValidClass(), 'A', String.valueOf(Date.today()), new List<String>(), 1, 0, 1, teacher.Id);
        Assert.isTrue(result.sessionExists, 'Should save successfully');
        
        // Successful insert of new class and session
        AttendanceController.SessionData newResult = AttendanceController.saveAttendance('Class 2', 'B', String.valueOf(Date.today()), new List<String>{student.Id}, 1, 1, 0, null);
        Assert.isTrue(newResult.sessionExists, 'Should save successfully for new class');
        
        // Duplicate session deletion branch
        Class__c existingClass = [SELECT Id FROM Class__c LIMIT 1];
        insert new Attendance_Session__c(Class__c=existingClass.Id, Section__c='A', Date__c=Date.today().addDays(-1));
        insert new Attendance_Session__c(Class__c=existingClass.Id, Section__c='A', Date__c=Date.today().addDays(-1));
        AttendanceController.saveAttendance(TestDataFactory.getValidClass(), 'A', String.valueOf(Date.today().addDays(-1)), new List<String>(), 1, 0, 1, null);
        
        try {
            AttendanceController.saveAttendance(null, null, '', null, 0, 0, 0, null);
            Assert.fail('Should throw exception for missing date');
        } catch(AuraHandledException e) {
            Assert.isNotNull(e.getMessage(), 'Exception message should be populated');
        }
    }
}