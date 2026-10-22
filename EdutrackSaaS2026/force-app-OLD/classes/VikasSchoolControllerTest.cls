@isTest
public class VikasSchoolControllerTest {
    @isTest
    static void testController() {
        String msg = VikasSchoolController.getWelcomeMessage();
        Assert.isNotNull(msg, 'Should return welcome message string');
        
        List<Account> accs = VikasSchoolController.getSchoolDetails();
        Assert.isNotNull(accs, 'Should safely return standard accounts query');
    }
}