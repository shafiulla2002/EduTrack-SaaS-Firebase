/**
 * An apex class that updates details of a portal user.
   Guest users are never able to access this page.
 */
@IsTest public with sharing class MyProfilePageControllerTest {

    @IsTest(SeeAllData=true) static void testSave() {
        // Modify the test to query for a portal user that exists in your org
        List<User> existingPortalUsers = [SELECT id, profileId, userRoleId FROM User WHERE UserRoleId <> null AND UserType='CustomerSuccess'];

        if (existingPortalUsers.isEmpty()) {
            User currentUser = [select id, title, firstname, lastname, email, phone, mobilephone, fax, street, city, state, postalcode, country
                                FROM User WHERE id =: UserInfo.getUserId()];
            MyProfilePageController controller = new MyProfilePageController();
            Assert.areEqual(currentUser.Id, controller.getUser().Id, 'Did not successfully load the current user');
            Assert.isFalse(controller.getIsEdit(), 'isEdit should default to false');
            controller.edit();
            Assert.isTrue(controller.getIsEdit(), 'isEdit should be true after edit');
            controller.cancel();
            Assert.isFalse(controller.getIsEdit(), 'isEdit should be false after cancel');
            
            Assert.isTrue(Page.ChangePassword.getUrl().equals(controller.changePassword().getUrl()), 'Should direct to change password page');
            
            String randFax = Math.rint(Math.random() * 1000) + '5551234';
            controller.getUser().Fax = randFax;
            controller.save();
            Assert.isFalse(controller.getIsEdit(), 'isEdit should be false after save');
            
            currentUser = [Select id, fax from User where id =: currentUser.Id];
            Assert.areEqual(randFax, currentUser.fax, 'Fax should be updated');
        } else {
            User existingPortalUser = existingPortalUsers[0];
            String randFax = Math.rint(Math.random() * 1000) + '5551234';

            System.runAs(existingPortalUser) {
                MyProfilePageController controller = new MyProfilePageController();
                Assert.areEqual(existingPortalUser.Id, controller.getUser().Id, 'Did not successfully load the current user');
                Assert.isFalse(controller.getIsEdit(), 'isEdit should default to false');
                controller.edit();
                Assert.isTrue(controller.getIsEdit(), 'isEdit should be true');

                controller.cancel();
                Assert.isFalse(controller.getIsEdit(), 'isEdit should be false');

                controller.getUser().Fax = randFax;
                controller.save();
                Assert.isFalse(controller.getIsEdit(), 'isEdit should be false after save');
            }

            // verify that the user was updated
            existingPortalUser = [Select id, fax from User where id =: existingPortalUser.Id];
            Assert.areEqual(randFax, existingPortalUser.fax, 'Fax should be updated for portal user');
        }
    }
}