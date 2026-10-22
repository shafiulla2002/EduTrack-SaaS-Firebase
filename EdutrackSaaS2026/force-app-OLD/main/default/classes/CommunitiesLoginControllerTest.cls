/**
 * An apex page controller that exposes the site login functionality
 */
@IsTest global with sharing class CommunitiesLoginControllerTest {
    @IsTest(SeeAllData=true) 
    global static void testCommunitiesLoginController () {
        Test.setCurrentPage(new PageReference('/'));
     	CommunitiesLoginController controller = new CommunitiesLoginController();
     	Assert.isNull(controller.forwardToAuthPage(), 'forwardToAuthPage should return null in test context');       
    }    
}