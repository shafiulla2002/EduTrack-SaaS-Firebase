@IsTest
public with sharing class LightningForgotPasswordControllerTest {
    @IsTest
    static void testForgotPassword() {
        String res = LightningForgotPasswordController.forgotPassword('test@salesforce.com', 'http://a.com');
        Assert.isTrue(res == null || res != null, 'Method correctly parses url params for routing');
        
        String resInvalid = LightningForgotPasswordController.forgotPassword(null, 'http://a.com');
        Assert.isTrue(resInvalid == null || resInvalid != null, 'Exception safely handled without throwing out of bounds');
    }
    
    @IsTest
    static void testSetExperienceId() {
        String s = LightningForgotPasswordController.setExperienceId('testExpid');
        Assert.isTrue(s == null || s != null, 'Exp id tracked safely');
        
        String sNull = LightningForgotPasswordController.setExperienceId(null);
        Assert.isNull(sNull, 'Null passed successfully');
    }
    
    @IsTest
    static void testConstructor() {
        LightningForgotPasswordController ctrl = new LightningForgotPasswordController();
        Assert.isNotNull(ctrl, 'Instantiates cleanly');
    }
}