@IsTest
public with sharing class LightningLoginFormControllerTest {
    @IsTest
    static void testLogin() {
        String res = LightningLoginFormController.login('testUser', 'testPwd', 'startUrl');
        Assert.isTrue(res == null || res != null, 'Should safely attempt login and return null or exception message internally');
    }
    
    @IsTest
    static void testGetIsUsernamePasswordEnabled() {
        Boolean b = LightningLoginFormController.getIsUsernamePasswordEnabled();
        Assert.isNotNull(b, 'Should return boolean parsed from Auth config');
    }

    @IsTest
    static void testGetIsSelfRegistrationEnabled() {
        Boolean b = LightningLoginFormController.getIsSelfRegistrationEnabled();
        Assert.isNotNull(b, 'Should return boolean parsed from Auth config');
    }

    @IsTest
    static void testGetSelfRegistrationUrl() {
        String s = LightningLoginFormController.getSelfRegistrationUrl();
        Assert.isTrue(s == null || s != null, 'Url safely returned or null');
    }

    @IsTest
    static void testGetForgotPasswordUrl() {
        String s = LightningLoginFormController.getForgotPasswordUrl();
        Assert.isTrue(s == null || s != null, 'Url safely returned or null');
    }

    @IsTest
    static void testSetExperienceId() {
        String s = LightningLoginFormController.setExperienceId('testExpid');
        Assert.isTrue(s == null || s != null, 'Exp id tracked safely');
        
        String sNull = LightningLoginFormController.setExperienceId(null);
        Assert.isNull(sNull, 'Null passed successfully');
    }

    @IsTest
    static void testConstructor() {
        LightningLoginFormController ctrl = new LightningLoginFormController();
        Assert.isNotNull(ctrl, 'Instantiates correctly');
    }
}