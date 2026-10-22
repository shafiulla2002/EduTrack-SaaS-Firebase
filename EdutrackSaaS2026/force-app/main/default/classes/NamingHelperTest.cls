@isTest
public class NamingHelperTest {
    @testSetup
    static void setup() {
        Academic_Year__c ay = new Academic_Year__c(Name='2024-2025');
        insert ay;
    }
    
    @isTest
    static void testGetAcademicYearName() {
        Academic_Year__c ay = [SELECT Id, Name FROM Academic_Year__c LIMIT 1];
        
        String name = NamingHelper.getAcademicYearName(ay.Id);
        Assert.areEqual(ay.Name, name, 'Should fetch correct referenced name');
        
        String emptyName = NamingHelper.getAcademicYearName('');
        Assert.areEqual('', emptyName, 'Should handle blank cleanly');
        
        Id dummyId = 'a07000000000000AAA';
        String dummyName = NamingHelper.getAcademicYearName(dummyId);
        Assert.areEqual(dummyId, dummyName, 'Should fallback and return original ID string if not found');
    }
}