/**
 * Class containing tests for SiteRegisterController
 */
@IsTest public with sharing class SiteRegisterControllerTest {
    @IsTest(SeeAllData=true) static void testRegistration() {
        SiteRegisterController controller = new SiteRegisterController();
        controller.username = 'test@force.com';
        controller.email = 'test@force.com';
        controller.communityNickname = 'test';
        // registerUser will always return null when the page isn't accessed as a guest user
        Assert.isNull(controller.registerUser(), 'Should return null in test context');    
        
        controller.password = 'abcd1234';
        controller.confirmPassword = 'abcd123';
        Assert.isNull(controller.registerUser(), 'Should return null in test context');  
    }
}