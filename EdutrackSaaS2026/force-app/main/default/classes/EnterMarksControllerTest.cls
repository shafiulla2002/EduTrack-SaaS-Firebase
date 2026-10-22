@isTest
public class EnterMarksControllerTest {

    @testSetup
    static void setup() {
        User u = EduTrackTestUtils.createAdminUser();
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = 'EduTrack_Full_Access' LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = ps.Id);

        System.runAs(u) {
            // Create Class
            Class__c cls = new Class__c(Name = 'Class-1');
            insert cls;

            // Create Section
            Section__c sec = new Section__c(Name = 'A');
            insert sec;

            // Create Subject (normal)
            Subject__c sub = new Subject__c(
                Name = 'Maths',
                Is_Active__c = true
            );
            insert sub;

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
                Roll_No__c = 'ROLL001'
            );
            insert student;
        }
    }

    @isTest
    static void testAllMethods() {
        User u = [SELECT Id FROM User WHERE Alias = 'etadmin' LIMIT 1];
        Class__c cls = [SELECT Id FROM Class__c LIMIT 1];
        Section__c sec = [SELECT Id FROM Section__c LIMIT 1];
        Account student = [SELECT Id FROM Account LIMIT 1];
        Subject__c sub = [SELECT Id, Name FROM Subject__c LIMIT 1];

        Test.startTest();
        System.runAs(u) {
            // getClasses
            EnterMarksController.getClasses();

            // getSubjects
            List<EnterMarksController.SubjectWrapper> subjects =
                EnterMarksController.getSubjects();

            // getExamTypes
            List<String> examTypes = EnterMarksController.getExamTypes();
            String examType = examTypes.isEmpty() ? 'Quarterly' : examTypes[0];

            // getSections
            EnterMarksController.getSections();

            // findSubjectField coverage
            EnterMarksController.findSubjectField(sub.Name);
            EnterMarksController.findSubjectField('Extra Marks');
            EnterMarksController.findSubjectField('Unknown');

            // getStudentsForMarksEntry (no exam yet)
            EnterMarksController.getStudentsForMarksEntry(
                cls.Id,
                sec.Id,
                sub.Name,
                examType
            );

            // saveMarks (normal insert)
            List<Map<String, Object>> marksData = new List<Map<String, Object>>{
                new Map<String, Object>{
                    'studentId' => student.Id,
                    'obtainedMarks' => 85,
                    'subjectId' => sub.Id
                }
            };

            EnterMarksController.saveMarks(
                marksData,
                examType,
                cls.Id,
                null,
                sec.Id
            );

            // getStudentsForMarksEntry (after insert → hasMarks = true)
            EnterMarksController.getStudentsForMarksEntry(
                cls.Id,
                sec.Id,
                sub.Name,
                examType
            );

            // JSON PATH coverage (subject without field)
            Subject__c jsonSub = new Subject__c(
                Name = 'CustomSub123',
                Is_Active__c = true
            );
            insert jsonSub;

            List<Map<String, Object>> jsonMarks = new List<Map<String, Object>>{
                new Map<String, Object>{
                    'studentId' => student.Id,
                    'obtainedMarks' => 95,
                    'subjectId' => jsonSub.Id
                }
            };

            try {
                EnterMarksController.saveMarks(
                    jsonMarks,
                    examType,
                    cls.Id,
                    null,
                    sec.Id
                );
            } catch (Exception e) {}

            // EMPTY students branch
            Class__c emptyClass = new Class__c(Name = 'EmptyClass');
            insert emptyClass;

            EnterMarksController.getStudentsForMarksEntry(
                emptyClass.Id,
                null,
                'Maths',
                examType
            );

            // Exception case → getStudentsForMarksEntry
            try {
                EnterMarksController.getStudentsForMarksEntry(
                    null,
                    null,
                    null,
                    null
                );
            } catch (Exception e) {}

            // saveMarks exception (null data)
            try {
                EnterMarksController.saveMarks(
                    null,
                    examType,
                    cls.Id,
                    null,
                    sec.Id
                );
            } catch (Exception e) {}

            // invalid subject
            List<Map<String, Object>> invalidData = new List<Map<String, Object>>{
                new Map<String, Object>{
                    'studentId' => student.Id,
                    'obtainedMarks' => 90,
                    'subjectId' => 'INVALID'
                }
            };

            try {
                EnterMarksController.saveMarks(
                    invalidData,
                    examType,
                    cls.Id,
                    null,
                    sec.Id
                );
            } catch (Exception e) {}

            // invalid marks (force conversion error)
            List<Map<String, Object>> badData = new List<Map<String, Object>>{
                new Map<String, Object>{
                    'studentId' => student.Id,
                    'obtainedMarks' => 'NOT_A_NUMBER',
                    'subjectId' => sub.Id
                }
            };

            try {
                EnterMarksController.saveMarks(
                    badData,
                    examType,
                    cls.Id,
                    null,
                    sec.Id
                );
            } catch (Exception e) {}
        }
        Test.stopTest();
    }
}
