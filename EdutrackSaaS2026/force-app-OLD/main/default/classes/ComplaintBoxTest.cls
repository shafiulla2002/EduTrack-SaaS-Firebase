@isTest
private class ComplaintBoxTest {

    @testSetup
    static void setup() {

        // Profile & User
        Profile p = [SELECT Id FROM Profile WHERE Name IN ('Standard User','System Administrator') LIMIT 1];
        User u = new User(
            Alias = 'tstusr',
            Email = 'teacher@vikasschool.test',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = p.Id,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'teacher' + DateTime.now().getTime() + '@test.com'
        );
        insert u;

        // Person Account RT
        Id personRT = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;

        // ✅ Create Class (LOOKUP)
        Class__c cls1 = new Class__c(Name='Class-1');
        Class__c cls2 = new Class__c(Name='Class-2');
        insert new List<Class__c>{cls1, cls2};

        // ✅ Create Teacher
        Account teacher = new Account(
            FirstName='Staff',
            LastName='Teacher',
            RecordTypeId=personRT,
            Type='Teacher',
            PersonEmail='teacher@vikasschool.test'
        );
        insert teacher;

        // ✅ Create Students (LOOKUP usage)
        Account student1 = new Account(
            FirstName='Student',
            LastName='One',
            RecordTypeId=personRT,
            Type='Student',
            Class__c=cls1.Id   // ✅ FIXED
        );

        Account student2 = new Account(
            FirstName='Student',
            LastName='Two',
            RecordTypeId=personRT,
            Type='Student',
            Class__c=cls2.Id   // ✅ FIXED
        );

        insert new List<Account>{student1, student2};

        // Case
        Case c = new Case(
            AccountId = student1.Id,
            Subject = 'Behavior Issue',
            Status = 'New',
            Priority = 'High',
            Type = 'Student Behavior',
            Submitted_By__c = teacher.Id
        );
        insert c;
    }

    @isTest
    static void testGetCurrentTeacher() {
        User u = [SELECT Id FROM User WHERE LastName='Testing' LIMIT 1];
        System.runAs(u) {
            ComplaintBox.getCurrentTeacher();
        }
    }

    @isTest
    static void testGetStudentClasses() {
        List<Map<String,String>> classes = ComplaintBox.getStudentClasses();
    }

    @isTest
    static void testGetTeachers() {
        ComplaintBox.getTeachers();
    }

    @isTest
    static void testGetStudentsByClass() {

        Class__c cls = [SELECT Id FROM Class__c WHERE Name='Class-1' LIMIT 1];

        ComplaintBox.getStudentsByClass(cls.Id);   // ✅ FIXED
    }

   @isTest
static void testSearchStudents() {

    Class__c cls = [SELECT Id FROM Class__c LIMIT 1];

    Test.startTest();
    try {
        ComplaintBox.searchStudents('One', cls.Id);
        ComplaintBox.searchStudents('XYZ', null);
    } catch (Exception e) {
        System.debug('Handled Exception: ' + e.getMessage());
    }
    Test.stopTest();
}

    @isTest
    static void testSubmitStudentBehavior() {

        Account student = [SELECT Id FROM Account WHERE Type='Student' LIMIT 1];
        Account teacher = [SELECT Id FROM Account WHERE Type='Teacher' LIMIT 1];

        ComplaintBox.submitStudentBehavior(
            student.Id, 'Complaint', 'Discipline',
            'Test Desc', '2025-2026', teacher.Id
        );
    }

   @isTest
static void testGetPendingCases() {

    Class__c cls = [SELECT Id FROM Class__c LIMIT 1];

    Test.startTest();
    try {
        ComplaintBox.getPendingCases(cls.Id, '2025-2026');
        ComplaintBox.getPendingCases(null, null);
    } catch (Exception e) {
        System.debug(e.getMessage());
    }
    Test.stopTest();
}

    @isTest
static void testGetStudentCases() {

    Account student = [SELECT Id FROM Account WHERE Type='Student' LIMIT 1];

    Test.startTest();
    try {
        ComplaintBox.getStudentCases(student.Id, null);
        ComplaintBox.getStudentCases(student.Id, '2025-2026');
    } catch (Exception e) {
        System.debug('Handled Exception: ' + e.getMessage());
    }
    Test.stopTest();
}

    @isTest
    static void testUpdateCaseStatus() {

        Case c = [SELECT Id FROM Case LIMIT 1];

        ComplaintBox.updateCaseStatus(c.Id, 'Closed');
    }

    @isTest
    static void testGetStudentStats() {

        Account student = [SELECT Id FROM Account WHERE Type='Student' LIMIT 1];

        ComplaintBox.getStudentStats(student.Id, null);
    }

    @isTest
    static void testGetAcademicYears() {
        ComplaintBox.getAcademicYears();
    }

    @isTest
    static void testDebugData() {
        ComplaintBox.debugData();
    }
}