@isTest
public class MarksheetControllerTest {
    @testSetup
    static void setup() {
        Id personAccountRecordTypeId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
        Account teacher = new Account(FirstName='Test', LastName='Teacher', RecordTypeId=personAccountRecordTypeId, Type='Teacher', Active__c='Yes', Phone='1234567890', Subject__c=TestDataFactory.getValidSubject());
        insert teacher;
        
        Account student = new Account(FirstName='Test', LastName='Student', RecordTypeId=personAccountRecordTypeId, Type='Student', Class__c=TestDataFactory.getValidClass());
        insert student;
        
        Period__c period = new Period__c(Assigned_Teacher__c=teacher.Id, Class__c=TestDataFactory.getValidClass(), Start_Date__c=Date.today().addDays(-1), End_Date__c=Date.today().addDays(1), Start_Time__c=Time.newInstance(9, 0, 0, 0));
        insert period;
    }
    
    @isTest
    static void testCheckInternalUser() {
        Map<String, Object> res = MarksheetController.checkInternalUser(UserInfo.getUserId());
        Assert.isNotNull(res, 'Should return map');
        Assert.isTrue((Boolean)res.get('isTeacher'), 'Should fallback to first active teacher since contact isnt found for UserInfo email');
    }
    
    @isTest
    static void testAuthenticateTeacher() {
        Map<String, Object> res = MarksheetController.authenticateTeacher('Test Teacher', '1234567890');
        Assert.isTrue((Boolean)res.get('isAuthenticated'), 'Should authenticate successfully');
        
        try {
            MarksheetController.authenticateTeacher('Invalid', '000');
            Assert.fail('Should fail auth');
        } catch(AuraHandledException e) {
            Assert.isNotNull(e.getMessage(), 'Exception message will be populated on failure');
        }
    }
    
    @isTest
    static void testGetAssignedClasses() {
        Account teacher = [SELECT Id FROM Account WHERE Type = 'Teacher' LIMIT 1];
        List<Map<String, Object>> classes = MarksheetController.getAssignedClasses(teacher.Id, String.valueOf(Date.today()));
        Assert.isFalse(classes.isEmpty(), 'Should return assigned periods');
        Assert.isTrue(classes[0].containsKey('studentCount'), 'Should calculate student count dynamically');
    }
    
    @isTest
    static void testSaveTeachingSession() {
        Period__c period = [SELECT Id FROM Period__c LIMIT 1];
        Map<String, Object> sessionData = new Map<String, Object>{
            'assignedClassId' => period.Id,
            'topicDiscussed' => 'Algebra'
        };
        
        String result = MarksheetController.saveTeachingSession(sessionData);
        Assert.areEqual('Teaching session recorded successfully!', result, 'Should save and return success message');
        
        Period__c updatedPeriod = [SELECT Is_Completed__c, Topic_Discussed__c FROM Period__c WHERE Id = :period.Id];
        Assert.isTrue(updatedPeriod.Is_Completed__c, 'Should mark as completed');
        Assert.areEqual('Algebra', updatedPeriod.Topic_Discussed__c, 'Topic should be saved');
        
        try {
            MarksheetController.saveTeachingSession(new Map<String, Object>());
            Assert.fail('Should fail cleanly');
        } catch(AuraHandledException e) {
            Assert.isNotNull(e.getMessage(), 'Exception message should be populated natively');
        }
    }
}