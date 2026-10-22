@isTest
public class GradesControllerTest {
    @testSetup
    static void setupTestData() {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        String validClass = TestDataFactory.getValidClass();
        
        Account student = new Account(
            FirstName='Test', 
            LastName='Student', 
            RecordTypeId=personAccountRecordTypeId, 
            Type='Student',
            Class__c=validClass, 
            Section__c='A',
            Roll_No__c = 'ROLL002'
        );
        insert student;
        
        Class__c cls = new Class__c(Name=validClass, Class__c=validClass, Section__c='A');
        insert cls;
        
        insert new Exam__c(
            Student__c=student.Id, 
            Class__c=cls.Id,
            Section__c='A',
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
    static void testGetInitialData() {
        Map<String, Object> data = GradesController.getInitialData();
        Assert.isNotNull(data, 'Initial data should not be null');
        Assert.isTrue(((List<String>)data.get('testTypes')).size() > 0, 'Should have test types');
        Assert.isTrue(((List<Map<String, String>>)data.get('classOptions')).size() > 0, 'Should have class options');
        Assert.isTrue(((List<Map<String, String>>)data.get('sectionOptions')).size() > 0, 'Should have section options');
        Assert.isTrue(((List<Map<String, String>>)data.get('subjects')).size() > 0, 'Should identify dynamic schema subjects');
    }
    
    @isTest
    static void testGetGradesData() {
        Account student = [SELECT Id FROM Account LIMIT 1];
        String validClass = TestDataFactory.getValidClass();
        
        // Match existing exam
        List<Map<String, Object>> grades = GradesController.getGradesData(validClass, 'A', '', 'Test');
        Assert.isFalse(grades.isEmpty(), 'Should return matching student grades');
        Assert.areEqual(student.Id, grades[0].get('Id'), 'Student Id should match');
        Assert.areEqual(82, grades[0].get('Hindi__c'), 'Hindi mark should be accurately parsed');
        
        // Unmatched search case
        List<Map<String, Object>> emptyGrades = GradesController.getGradesData(validClass, 'B', 'InvalidType', 'Nonexistent');
        Assert.isTrue(emptyGrades.isEmpty(), 'Should return empty list for unmatched criteria');
    }
    
    @isTest
    static void testGetStudentExams() {
        Account student = [SELECT Id FROM Account LIMIT 1];
        
        List<Map<String, Object>> exams = GradesController.getStudentExams(student.Id);
        Assert.isFalse(exams.isEmpty(), 'Should return exams for the requested student');
    }
}