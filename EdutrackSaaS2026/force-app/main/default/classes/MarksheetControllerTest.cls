@isTest
public class MarksheetControllerTest {

    @testSetup
    static void setupData() {
        User u = EduTrackTestUtils.createAdminUser();
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'EduTrack_Full_Access' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id);

        System.runAs(u) {
            Id personRtId = [
                SELECT Id
                FROM RecordType
                WHERE SObjectType = 'Account'
                AND IsPersonType = true
                LIMIT 1
            ].Id;

            // ✅ Create Class lookup record
            Class__c cls = new Class__c(Name = 'Class-1');
            insert cls;

            // ✅ Create Section lookup record
            Section__c sec = new Section__c(Name = 'A');
            insert sec;

            // ✅ Create Teacher - PersonEmail set to user's email
            Account teacher = new Account(
                FirstName = 'Test',
                LastName = 'Teacher',
                RecordTypeId = personRtId,
                Type = 'Teacher',
                Active__c = 'Yes',
                Phone = '1234567890',
                Subject__c = 'Maths',
                PersonEmail = u.Email
            );
            insert teacher;

            // ✅ Create Student with Lookup Ids
            Account student = new Account(
                FirstName = 'Test',
                LastName = 'Student',
                RecordTypeId = personRtId,
                Type = 'Student',
                Roll_No__c = '1',
                Class__c = cls.Id,      
                Section__c = sec.Id,    
                Active__c = 'Yes'
            );
            insert student;

            // ✅ Create Period with Lookup Ids
            Period__c period = new Period__c(
                Assigned_Teacher__c = teacher.Id,
                Subject__c = 'Science',
                Start_Date__c = Date.today().addDays(-1),
                End_Date__c = Date.today().addDays(1),
                Start_Time__c = Time.newInstance(9, 0, 0, 0),
                End_Time__c = Time.newInstance(10, 0, 0, 0),
                Period_Number__c = '1'
            );
            insert period;
        }
    }

    @isTest
    static void testCheckInternalUser() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Test.startTest();
        Map<String, Object> result;
        System.runAs(u) {
            result = MarksheetController.checkInternalUser(u.Id);
        }
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('isTeacher'), 'Should be identified as a teacher');
        System.assertNotEquals(null, result.get('teacherId'), 'Teacher Id should be present');
    }

    @isTest
    static void testAuthenticateTeacher_Valid() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Test.startTest();
        Map<String, Object> result;
        System.runAs(u) {
            result = MarksheetController.authenticateTeacher('Test Teacher', '1234567890');
        }
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(true, result.get('isAuthenticated'), 'Teacher should be authenticated');
        System.assertEquals('Test Teacher', result.get('name'), 'Teacher name should match');
        System.assertNotEquals(null, result.get('subject'), 'Subject should be present');
    }

    @isTest
    static void testAuthenticateTeacher_InvalidCredentials() {
        Test.startTest();
        try {
            MarksheetController.authenticateTeacher('Wrong Name', '0000000000');
            System.assert(false, 'Should have thrown an exception for invalid credentials');
        } catch (AuraHandledException e) {
           
        }
        Test.stopTest();
    }

    @isTest
    static void testAuthenticateTeacher_BlankInputs() {
        Test.startTest();
        try {
            MarksheetController.authenticateTeacher('', '');
            System.assert(false, 'Should have thrown an exception for blank inputs');
        } catch (AuraHandledException e) {
           
        }
        Test.stopTest();
    }

    @isTest
    static void testGetAssignedClasses_Valid() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Account teacher = [
            SELECT Id
            FROM Account
            WHERE Type = 'Teacher'
            LIMIT 1
        ];

        Test.startTest();
        List<Map<String, Object>> result;
        System.runAs(u) {
            result = MarksheetController.getAssignedClasses(
                teacher.Id,
                String.valueOf(Date.today())
            );
        }
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(1, result.size(), 'Should return exactly 1 period');

        Map<String, Object> classData = result[0];
        System.assertNotEquals(null, classData.get('id'), 'Period Id should be present');
        System.assertNotEquals(null, classData.get('subjectName'), 'Subject should be present');
        System.assertEquals(false, classData.get('isCompleted'), 'Period should not be completed yet');
    }

    @isTest
    static void testGetAssignedClasses_NoResults() {
        Account teacher = [
            SELECT Id
            FROM Account
            WHERE Type = 'Teacher'
            LIMIT 1
        ];

        Test.startTest();
        // Use a past date that is outside the period's Start_Date/End_Date range
        List<Map<String, Object>> result = MarksheetController.getAssignedClasses(
            teacher.Id,
            String.valueOf(Date.today().addDays(-10))
        );
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals(0, result.size(), 'Should return 0 periods for out-of-range date');
    }

    @isTest
    static void testSaveTeachingSession_Valid() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Period__c period = [
            SELECT Id
            FROM Period__c
            LIMIT 1
        ];

        Map<String, Object> sessionData = new Map<String, Object>{
            'assignedClassId'    => period.Id,
            'topicDiscussed'     => 'Algebra',
            'teachingNotes'      => 'Students were attentive',
            'homeworkAssigned'   => 'Page 10 to 12',
            'classPerformance'   => 'Good',
            'additionalComments' => 'No issues'
        };

        Test.startTest();
        String result;
        System.runAs(u) {
            result = MarksheetController.saveTeachingSession(sessionData);
        }
        Test.stopTest();

        System.assertEquals(
            'Teaching session recorded successfully!',
            result,
            'Save should return success message'
        );

        // ✅ Verify the period was actually updated
        Period__c updated = [
            SELECT Is_Completed__c, Topic_Discussed__c, Teaching_Notes__c,
                   Homework_Assigned__c, Class_Performance__c, Additional_Comments__c
            FROM Period__c
            WHERE Id = :period.Id
        ];
        System.assertEquals(true, updated.Is_Completed__c, 'Period should be marked as completed');
        System.assertEquals('Algebra', updated.Topic_Discussed__c, 'Topic should be saved');
        System.assertEquals('Students were attentive', updated.Teaching_Notes__c, 'Notes should be saved');
        System.assertEquals('Page 10 to 12', updated.Homework_Assigned__c, 'Homework should be saved');
        System.assertEquals('Good', updated.Class_Performance__c, 'Performance should be saved');
        System.assertEquals('No issues', updated.Additional_Comments__c, 'Comments should be saved');
    }

    @isTest
    static void testSaveTeachingSession_EmptyMap() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Test.startTest();
        try {
            System.runAs(u) {
                MarksheetController.saveTeachingSession(new Map<String, Object>());
            }
            System.assert(false, 'Should have thrown an exception for empty session data');
        } catch (AuraHandledException e) {
            
        }
        Test.stopTest();
    }
}
