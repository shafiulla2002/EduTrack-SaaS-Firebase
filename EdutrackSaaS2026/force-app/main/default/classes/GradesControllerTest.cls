@isTest
public class GradesControllerTest {

    @testSetup
    static void setupTestData() {

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
            Roll_No__c = 'ROLL002'
        );
        insert student;

        // Create Exam Record
        insert new Exam__c(
            Student__c = student.Id,
            Class__c   = cls.Id,
            Section__c = sec.Id,
            Exam_Type__c = 'Unit Test 1',

            English__c  = '80',
            Maths__c    = '90',
            Science__c  = '85',
            Social__c   = '88',
            Computer__c = '95',
            Telugu__c   = '75',
            Hindi__c    = 82
        );
    }

    @isTest
    static void testAllMethods() {
        User u = EduTrackTestUtils.createTestUser();
        System.runAs(u) {
            Account student = [SELECT Id FROM Account LIMIT 1];

            Test.startTest();

            // getInitialData
            GradesController.getInitialData();

            // getGradesData (valid case)
            GradesController.getGradesData(
                'Class-1',
                'A',
                'Test',
                ''
            );

            // unmatched case
            GradesController.getGradesData(
                'Class-1',
                'B',
                'InvalidType',
                'Nonexistent'
            );

            // getStudentExams
            GradesController.getStudentExams(student.Id);

            // exception case
            try {
                GradesController.getStudentExams(null);
            } catch (Exception e) {}

            Test.stopTest();
        }
    }
}